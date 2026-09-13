"""
Database setup for PromptAssistor.

SQLAlchemy engine, session management, and database initialization.
Uses SQLite with WAL mode for better concurrent read performance.
"""

import logging
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
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


def _migrate_schema(engine) -> None:
    """轻量 schema 迁移（SQLite 无 Alembic）/ Lightweight schema migration (SQLite, no Alembic).

    `create_all` 只会创建缺失的表，不会给已存在的表新增列。这里对新增列做
    幂等的 `ALTER TABLE ... ADD COLUMN`，保证升级后旧库也能读到新字段。
    / `create_all` only creates missing tables, it won't add columns to an
    existing table. This idempotently runs `ALTER TABLE ... ADD COLUMN` for
    newly added columns so existing databases gain them after an upgrade.
    """
    insp = inspect(engine)
    tables = set(insp.get_table_names())

    # datasets.reverse_requirement / datasets 表新增反推需求描述列
    if "datasets" in tables:
        existing = {col["name"] for col in insp.get_columns("datasets")}
        if "reverse_requirement" not in existing:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE datasets "
                        "ADD COLUMN reverse_requirement TEXT NOT NULL DEFAULT ''"
                    )
                )
            logger.info("Migration: added datasets.reverse_requirement")

    _migrate_label_tags(engine)


def _migrate_label_tags(engine) -> None:
    """迁移 label_tags 表：两级(first/second) → 任意深度(path)。

    / Migrate label_tags: two-level (first/second) → arbitrary-depth (path).

    The F6 feature originally used a fixed two-level hierarchy
    (first_category / second_category). Sub-category support changed it to a
    single `path` column holding the parent folder's relative path. If the old
    table exists with the old columns, rebuild it in place and backfill.
    / F6 最初用固定的两级层级（first_category/second_category）。子分类支持改为单一 `path` 列，
    存放父文件夹相对路径。若旧表存在旧列，则原地重建并回填数据。
    """
    insp = inspect(engine)
    if "label_tags" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("label_tags")}
    if "path" in cols:
        return  # 已是新 schema / already the new schema

    from . import models  # noqa: F401 - ensure models are registered

    # 重命名旧表 → 新建新表 → 回填 → 删除旧表
    # / rename old table → create new table → backfill → drop old table
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE label_tags RENAME TO label_tags_old"))
    models.Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO label_tags (path, name, content, note, created_at, updated_at) "
                "SELECT first_category || '/' || second_category, name, content, note, "
                "created_at, updated_at FROM label_tags_old"
            )
        )
        conn.execute(text("DROP TABLE label_tags_old"))
    logger.info("Migration: rebuilt label_tags with path column")


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
    _migrate_schema(engine)
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
