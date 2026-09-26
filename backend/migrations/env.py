import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from sqlmodel import SQLModel

# Import all models so Alembic can detect them
from app.models.models import (  # noqa: F401
    User, GitHubAccount, GitHubInstallation, Repository,
    Project, ProjectMember, Memo, MemoGitHubActivity, Task, GitHubEvent,
)

config = context.config

# Override URL from environment
db_url = os.getenv("DATABASE_URL", config.get_main_option("sqlalchemy.url"))
# Alembic sync driver for migrations (psycopg2), convert asyncpg URL
if db_url and "asyncpg" in db_url:
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    # Use psycopg2 sync engine for Alembic
    from sqlalchemy import create_engine
    url = config.get_main_option("sqlalchemy.url")
    connectable = create_engine(url)
    with connectable.connect() as connection:
        do_run_migrations(connection)


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
