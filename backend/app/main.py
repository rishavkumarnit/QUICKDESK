from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from app.api.router import api_router
from app.core.config import settings
from app.services.knowledge import initialize_knowledge_base, knowledge_status

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.app_env == "test":
        yield
        return
    try:
        count = await run_in_threadpool(initialize_knowledge_base)
        logger.info("Knowledge base ready with %s chunks", count)
    except Exception:
        # Keep the manual helpdesk usable if the embedding provider is unavailable.
        logger.exception("Knowledge-base startup ingestion failed")
    yield


app = FastAPI(title="QuickDesk API", version="0.1.0", lifespan=lifespan)
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
)


@app.get("/api/health", tags=["health"])
def health() -> dict:
    """Report process liveness and the process-local knowledge index state."""
    return {"status": "ok", "service": "quickdesk-api", "knowledge_base": knowledge_status()}
