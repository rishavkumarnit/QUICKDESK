from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.auth import router as auth_router
from app.tickets import router as ticket_router
from app.events import router as event_router

app = FastAPI(title="QuickDesk API", version="0.1.0")
app.include_router(auth_router)
app.include_router(ticket_router)
app.include_router(event_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    """Process liveness only; does not assert database/provider readiness."""
    return {"status": "ok", "service": "quickdesk-api"}
