"""
MEMO Backend — FastAPI application entry point.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import auth, github, projects, memos, tasks, catchmeup, webhooks, intelligence

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("MEMO backend starting up...")
    from app.core.config import settings
    from app.core.database import create_db_and_tables
    if settings.DATABASE_URL.startswith("sqlite"):
        # Auto-create tables for local SQLite dev — no Alembic needed
        await create_db_and_tables()
        logger.info("SQLite tables created/verified.")
    yield
    logger.info("MEMO backend shutting down...")


app = FastAPI(
    title="MEMO API",
    description="Developer handoff and team context API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,  # Required for cookie auth
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(github.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(memos.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(catchmeup.router, prefix="/api/v1")
app.include_router(intelligence.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "memo-api"}
