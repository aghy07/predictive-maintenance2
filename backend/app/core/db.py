import os
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()


def _engine_options(database_url: str, *, serverless: bool) -> dict[str, Any]:
    parsed_url = make_url(database_url)
    is_sqlite = parsed_url.get_backend_name() == "sqlite"
    options = {
        "connect_args": {"check_same_thread": False} if is_sqlite else {},
        "pool_pre_ping": not is_sqlite,
    }
    if serverless:
        options["poolclass"] = NullPool
    if (
        parsed_url.drivername == "postgresql+psycopg"
        and parsed_url.port == 6543
    ):
        options["connect_args"] = {
            **options["connect_args"],
            "prepare_threshold": None,
        }
    return options


is_sqlite = settings.database_url.startswith("sqlite")
is_vercel = os.environ.get("VERCEL") == "1"
engine = create_engine(
    settings.database_url,
    **_engine_options(settings.database_url, serverless=is_vercel),
)
if is_sqlite:
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
