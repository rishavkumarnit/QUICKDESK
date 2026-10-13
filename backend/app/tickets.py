from statistics import median
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import current_user, agent, public_user
from app.models import User, Ticket, Draft, Audit, Event, now
from app.schemas import CreateTicket, Override, Reply, Category, Priority
from app import ai

router = APIRouter(prefix='/api', tags=['tickets'])

def visible_ticket(db, ticket_id, user, lock=False):
    query = select(Ticket).where(Ticket.id == ticket_id)
    if user.role != 'agent':
        query = query.where(Ticket.employee_id == user.id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    ticket = db.scalar(query)
    if not ticket:
        raise HTTPException(404, 'Ticket not found')
    return ticket

def event(db, ticket, kind):
    db.add(Event(employee_id=ticket.employee_id, ticket_id=ticket.id, kind=kind))

def summary(ticket):
    return {key: getattr(ticket, key) for key in (
        'id', 'title', 'status', 'category', 'priority', 'created_at', 'resolved_at',
        'ai_category', 'ai_priority', 'classification_status')}

def detail(db, ticket, user):
    result = summary(ticket) | {'description': ticket.description,
        'attachment': ticket.attachment, 'final_reply': ticket.final_reply,
        'employee': public_user(db.get(User, ticket.employee_id))}
    if user.role == 'agent':
        result['drafts'] = [{'id': d.id, 'body': d.body, 'citations': d.citations, 'created_at': d.created_at}
                            for d in db.scalars(select(Draft).where(Draft.ticket_id == ticket.id).order_by(Draft.created_at.desc()))]
        result['audit'] = [{'field': a.field, 'old_value': a.old_value, 'new_value': a.new_value,
                            'actor': actor.name, 'created_at': a.created_at}
                          for a, actor in db.execute(select(Audit, User).join(User, User.id == Audit.actor_id)
                            .where(Audit.ticket_id == ticket.id).order_by(Audit.created_at.desc()))]
    return result

@router.get('/tickets')
def list_tickets(status: str | None = Query(None, pattern='^(Open|Resolved)$'),
                 category: Category | None = None, priority: Priority | None = None,
                 search: str = Query('', max_length=200), page: int = Query(1, ge=1),
                 user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = select(Ticket)
    if user.role != 'agent':
        query = query.where(Ticket.employee_id == user.id)
    for field, value in [('status', status), ('category', category), ('priority', priority)]:
        if value:
            query = query.where(getattr(Ticket, field) == value)
    if search:
        query = query.where(Ticket.title.icontains(search, autoescape=True))
    count = db.scalar(select(func.count()).select_from(query.subquery()))
    tickets = db.scalars(query.order_by(Ticket.created_at.desc(), Ticket.id).offset((page-1)*20).limit(20))
    return {'items': [summary(t) for t in tickets], 'total': count, 'page': page}

@router.post('/tickets', status_code=201)
def create_ticket(data: CreateTicket, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != 'employee':
        raise HTTPException(403, 'Employee access required')
    employee_id = user.id
    db.commit()  # Do not hold a database connection during an LLM request.
    ticket = Ticket(employee_id=employee_id, **data.model_dump())
    try:
        suggestion = ai.classify(data.title, data.description)
        ticket.ai_category = ticket.category = suggestion.category
        ticket.ai_priority = ticket.priority = suggestion.priority
        ticket.classification_status = 'complete'
    except Exception:
        ticket.category, ticket.priority = 'Other', 'Medium'
        ticket.classification_status = 'failed'
    db.add(ticket)
    db.flush()
    event(db, ticket, 'created')
    db.commit()
    return detail(db, ticket, user)

@router.get('/tickets/{ticket_id}')
def get_ticket(ticket_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return detail(db, visible_ticket(db, ticket_id, user), user)

@router.patch('/tickets/{ticket_id}')
def override(ticket_id: str, data: Override, user: User = Depends(agent), db: Session = Depends(get_db)):
    ticket = visible_ticket(db, ticket_id, user, lock=True)
    if ticket.status == 'Resolved':
        raise HTTPException(409, 'Resolved tickets cannot be changed')
    for field, value in data.model_dump().items():
        previous = getattr(ticket, field)
        if previous != value:
            db.add(Audit(ticket_id=ticket.id, actor_id=user.id, field=field, old_value=previous, new_value=value))
            setattr(ticket, field, value)
    event(db, ticket, 'updated')
    db.commit()
    return detail(db, ticket, user)

@router.post('/tickets/{ticket_id}/drafts', status_code=201)
def generate_draft(ticket_id: str, user: User = Depends(agent), db: Session = Depends(get_db)):
    ticket = visible_ticket(db, ticket_id, user)
    if ticket.status == 'Resolved':
        raise HTTPException(409, 'Ticket is already resolved')
    title, description = ticket.title, ticket.description
    db.commit()
    try:
        body, citations = ai.draft_reply(title, description)
    except Exception:
        raise HTTPException(503, 'AI draft unavailable. You can still write and send a manual reply.')
    ticket = visible_ticket(db, ticket_id, user, lock=True)
    if ticket.status == 'Resolved':
        raise HTTPException(409, 'Another agent has resolved this ticket')
    db.add(Draft(ticket_id=ticket.id, body=body, citations=citations))
    event(db, ticket, 'updated')
    db.commit()
    return detail(db, ticket, user)

@router.post('/tickets/{ticket_id}/reply')
def reply(ticket_id: str, data: Reply, user: User = Depends(agent), db: Session = Depends(get_db)):
    ticket = visible_ticket(db, ticket_id, user, lock=True)
    if ticket.status == 'Resolved':
        raise HTTPException(409, 'Another agent has already resolved this ticket')
    ticket.final_reply, ticket.replied_by = data.body, user.id
    ticket.status, ticket.resolved_at = 'Resolved', now()
    event(db, ticket, 'resolved')
    db.commit()
    return detail(db, ticket, user)

@router.get('/metrics', tags=['metrics'])
def metrics(user: User = Depends(agent), db: Session = Depends(get_db)):
    statuses = dict(db.execute(select(Ticket.status, func.count()).group_by(Ticket.status)).all())
    categories = dict(db.execute(select(Ticket.category, func.count()).group_by(Ticket.category)).all())
    times = [(end-start).total_seconds()/3600 for start, end in db.execute(
        select(Ticket.created_at, Ticket.resolved_at).where(Ticket.status == 'Resolved', Ticket.resolved_at.is_not(None)))]
    classified = db.scalar(select(func.count()).select_from(Ticket).where(Ticket.ai_category.is_not(None)))
    overridden = db.scalar(select(func.count(func.distinct(Audit.ticket_id))).join(Ticket, Ticket.id == Audit.ticket_id)
                          .where(Audit.field == 'category', Ticket.ai_category.is_not(None)))
    return {'statuses': {k: statuses.get(k, 0) for k in ['Open', 'Resolved']},
            'categories': {k: categories.get(k, 0) for k in ['IT', 'HR', 'Finance', 'Admin', 'Other']},
            'median_resolution_hours': median(times) if times else None,
            'category_override_percentage': round(overridden / classified * 100, 1) if classified else 0,
            'classified_tickets': classified, 'overridden_tickets': overridden}
