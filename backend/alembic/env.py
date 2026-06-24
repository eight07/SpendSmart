"""
alembic/env.py — Alembic migration environment for SpendSmart.

Key changes from the generated default:
- Reads DATABASE_URL from environment (no hard-coded credentials).
- Imports Base + all models so autogenerate can detect schema changes.
- Supports both offline (SQL script) and online (live DB) migration modes.
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# ---------------------------------------------------------------------------
# Ensure the backend/ directory is on sys.path so we can import our modules
# (database.py, models.py) regardless of where alembic is invoked from.
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ---------------------------------------------------------------------------
# Alembic Config object — provides access to values in alembic.ini
# ---------------------------------------------------------------------------
config = context.config

# Set up Python logging from the alembic.ini [loggers] section
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ---------------------------------------------------------------------------
# Override sqlalchemy.url with the DATABASE_URL environment variable.
# This keeps credentials out of alembic.ini / version control.
# ---------------------------------------------------------------------------
database_url = os.environ.get(
    "DATABASE_URL",
    "mysql+pymysql://root:password@localhost:3306/spendsmart",  # local dev fallback
)
config.set_main_option("sqlalchemy.url", database_url)

# ---------------------------------------------------------------------------
# Import Base and all models so Alembic's autogenerate can detect table changes.
# Both imports must happen AFTER sys.path is set.
# ---------------------------------------------------------------------------
from database import Base   # noqa: E402
import models               # noqa: E402, F401  (side-effect: registers ORM tables)

target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# OFFLINE mode — emits raw SQL without a live DB connection.
# Useful for generating migration scripts to review before applying.
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generates SQL without connecting)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# ONLINE mode — connects to a live database and runs migrations directly.
# ---------------------------------------------------------------------------
def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connects to DB and applies changes)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


# ---------------------------------------------------------------------------
# Entry point — Alembic decides which mode to use based on the CLI flag
# ---------------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
