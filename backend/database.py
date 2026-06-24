"""
database.py — SQLAlchemy engine, session factory, and dependency.

Usage in routes:
    from database import get_db
    from sqlalchemy.orm import Session

    @app.get("/example")
    def example(db: Session = Depends(get_db)):
        ...
"""

import os
# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import sessionmaker, declarative_base
# pyrefly: ignore [missing-import]
from sqlalchemy.exc import OperationalError
import urllib.parse

# ---------------------------------------------------------------------------
# DATABASE_URL — read from environment variable.
# Expected format: mysql+pymysql://user:password@host:port/dbname
#
# Example (development .env or shell export):
#   DATABASE_URL=mysql+pymysql://root:secret@localhost:3306/spendsmart
# ---------------------------------------------------------------------------

raw_password = "Bb786***0000"
encoded_password = urllib.parse.quote_plus(raw_password)

#DATABASE_URL = os.environ.get(
#  "DATABASE_URL",
#   f"mysql+pymysql://root:{encoded_password}@127.0.0.1:3306/spendsmart"
#)

DATABASE_URL = "mysql+pymysql://root:{encoded_password}@localhost:3306/spendsmart"
DATABASE_URL = "mysql+pymysql://root:@127.0.0.1:3307/spendsmart"


# ---------------------------------------------------------------------------
# Engine — pool_pre_ping keeps idle connections from going stale.
# pool_recycle avoids MySQL's 8-hour "wait_timeout" disconnect.
# ---------------------------------------------------------------------------
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,       # test connection health before each checkout
    pool_recycle=1800,        # recycle connections after 30 minutes
    echo=False,               # set True to log all SQL statements (dev only)
)

# ---------------------------------------------------------------------------
# SessionLocal — each request gets its own session, committed/closed in get_db()
# ---------------------------------------------------------------------------
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ---------------------------------------------------------------------------
# Base — all ORM models inherit from this; metadata holds table definitions
# ---------------------------------------------------------------------------
Base = declarative_base()


# ---------------------------------------------------------------------------
# get_db() — FastAPI dependency that yields a DB session per request.
# The session is always closed in the finally block, even on errors.
#
# Usage:
#   from fastapi import Depends
#   from database import get_db
#   from sqlalchemy.orm import Session
#
#   @router.get("/users")
#   def list_users(db: Session = Depends(get_db)):
#       return db.query(User).all()
# ---------------------------------------------------------------------------
def get_db():
    """Yield a SQLAlchemy session; close it when the request is done."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# init_db() — creates all tables defined via Base subclasses if they don't
# exist yet. Called once at application startup from main.py's lifespan hook.
# ---------------------------------------------------------------------------
def init_db() -> None:
    """
    Import all model modules *before* calling create_all so that their
    Table objects are registered on Base.metadata.

    Using Base.metadata.create_all is appropriate for development / small
    projects. For production, prefer Alembic migrations (see alembic/).
    """
    # Import models here to ensure they are registered on Base.metadata
    import models  # noqa: F401  (side-effect import)

    try:
        Base.metadata.create_all(bind=engine)
        print("[DB] Tables created / verified successfully.")
    except OperationalError as exc:
        # Surface a helpful message instead of a raw stack trace
        print(
            f"[DB] WARNING: Could not connect to the database.\n"
            f"       Check DATABASE_URL and ensure MySQL is running.\n"
            f"       Detail: {exc}"
        )
