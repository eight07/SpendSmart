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

# 1. Pull the connection string from environment variables (defaults to your PUBLIC Railway instance)
RAW_URL = os.environ.get(
    "DATABASE_URL",
    "mysql://root:oCfJUIRmLCQsiFITeToWAbecNBIoatqE@YOUR_PUBLIC_HOST_HERE.railway.app:YOUR_PORT/railway" # <-- Paste the PUBLIC one here!
)

# 2. Parse and format for SQLAlchemy + PyMySQL compatibility
if RAW_URL.startswith("mysql://") or RAW_URL.startswith("mysql+pymysql://"):
    # Strip existing prefix to normalize tracking
    clean_url = RAW_URL.replace("mysql+pymysql://", "").replace("mysql://", "")
    
    try:
        # Separate connection details from query parameters if any exist
        if "?" in clean_url:
            connection_part, query_params = clean_url.split("?", 1)
            query_suffix = f"?{query_params}"
        else:
            connection_part = clean_url
            query_suffix = ""
            
        # Extract credentials and host/database data
        credentials, host_db = connection_part.split("@", 1)
        username, password = credentials.split(":", 1)
        
        # Safely URL-encode the password to escape special characters automatically
        encoded_password = urllib.parse.quote_plus(password)
        
        # Reconstruct final production connection URL
        DATABASE_URL = f"mysql+pymysql://{username}:{encoded_password}@{host_db}{query_suffix}"
    except Exception:
        # Fallback formatting if manual extraction encounters a parsing edge case
        if RAW_URL.startswith("mysql://"):
            DATABASE_URL = RAW_URL.replace("mysql://", "mysql+pymysql://", 1)
        else:
            DATABASE_URL = RAW_URL
else:
    DATABASE_URL = RAW_URL

# 3. Initialize SQLAlchemy core components
# pool_pre_ping=True drops dead connections automatically before trying to use them
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()




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
