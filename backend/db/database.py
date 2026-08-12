"""
Database setup for PromptAssistor.

SQLAlchemy engine, session management, and database initialization.
Uses SQLite with WAL mode for better concurrent read performance.
"""

import logging
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.constants import DATA_DIR

logger = logging.getLogger(__name__)

# Database file path
DATABASE_PATH = DATA_DIR / "prompts.db"

# SQLAlchemy engine
_engine = None

# Session factory
SessionLocal: sessionmaker | None = None


def get_engine():
    """Get or create the SQLAlchemy engine."""
    global _engine
    if _engine is None:
        _engine = create_engine(
            f"sqlite:///{DATABASE_PATH}",
            echo=False,  # Set to True for SQL debugging
            connect_args={"check_same_thread": False},  # Required for SQLite + async
        )

        # Enable WAL mode for better concurrent performance
        @event.listens_for(_engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.close()

        logger.info(f"Database engine created: {DATABASE_PATH}")

    return _engine


def get_session() -> Session:
    """Create a new database session."""
    global SessionLocal
    if SessionLocal is None:
        engine = get_engine()
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    return SessionLocal()


def init_db() -> None:
    """
    Initialize the database: create all tables if they don't exist.

    Called at application startup before serving requests.
    """
    from . import models  # noqa: F401 - Import to register models

    engine = get_engine()

    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Create all tables
    models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")


def get_db():
    """
    FastAPI dependency for database session.

    Usage:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            ...
    """
    db = get_session()
    try:
        yield db
    finally:
        db.close()
