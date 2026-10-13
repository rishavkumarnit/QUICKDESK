import asyncio
import json
import time
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from starlette.concurrency import run_in_threadpool
from app.auth import current_user
from app.db import SessionLocal, get_db
from app.models import Event, LoginSession, User

router = APIRouter()

def event_batch(user_id, role, session_id, cursor):
    with SessionLocal() as db:
        if not db.get(LoginSession, session_id):
            return None
        query = select(Event).where(Event.id > cursor).order_by(Event.id).limit(100)
        if role != 'agent':
            query = query.where(Event.employee_id == user_id)
        return [{'id': e.id, 'ticket_id': e.ticket_id, 'kind': e.kind} for e in db.scalars(query)]

@router.get('/api/events', tags=['events'])
def events(request: Request, user: User = Depends(current_user), db = Depends(get_db)):
    auth = request.state.auth
    user_id, role = user.id, user.role
    db.commit()  # Release the auth query's pooled connection before streaming.
    with SessionLocal() as db:
        cursor = db.scalar(select(func.max(Event.id))) or 0
    # Opening/reopening the stream always causes the client to refetch current state.
    async def stream():
        nonlocal cursor
        yield 'event: ready\ndata: {}\n\n'
        reconciled_at = time.monotonic()
        while time.time() < auth['exp']:
            if await request.is_disconnected():
                return
            rows = await run_in_threadpool(event_batch, user_id, role, auth['jti'], cursor)
            if rows is None:
                return
            for row in rows:
                cursor = row['id']
                yield f"id: {cursor}\nevent: ticket\ndata: {json.dumps(row)}\n\n"
            # Reconcile even if concurrent transactions commit event IDs out of order.
            if time.monotonic() - reconciled_at >= 15:
                yield 'event: ready\ndata: {}\n\n'
                reconciled_at = time.monotonic()
            yield ': heartbeat\n\n'
            await asyncio.sleep(2)
    return StreamingResponse(stream(), media_type='text/event-stream',
                             headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})
