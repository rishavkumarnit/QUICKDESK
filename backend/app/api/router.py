"""Top-level API router assembly."""

from fastapi import APIRouter

from app.api.routes import auth, events, tickets


api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(tickets.router)
api_router.include_router(events.router)
