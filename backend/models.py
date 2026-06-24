"""
models.py — SQLAlchemy ORM models for SpendSmart.

Tables
------
users    — registered application users
expenses — individual expense records linked to a user

Indexes
-------
ix_expenses_user_date      on (user_id, date)      → fast monthly queries
ix_expenses_user_category  on (user_id, category)  → category history queries
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from database import Base


# ---------------------------------------------------------------------------
# User model
# ---------------------------------------------------------------------------
class User(Base):
    """
    Represents an application user.

    Columns
    -------
    id              : int, primary key, auto-increment
    email           : str, unique, not null  — used as login identity
    hashed_password : str, not null          — bcrypt / argon2 hash, never plain-text
    created_at      : datetime (UTC)         — account creation timestamp
    is_active       : bool (default True)    — soft-disable without deleting
    """

    __tablename__ = "users"

    id: int = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email: str = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password: str = Column(String(255), nullable=False)
    created_at: datetime = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    is_active: bool = Column(Boolean, nullable=False, default=True)

    # One-to-many: a user owns many expenses
    expenses = relationship(
        "Expense",
        back_populates="owner",
        cascade="all, delete-orphan",  # deleting a user removes their expenses
        lazy="dynamic",                # don't load all expenses automatically
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} active={self.is_active}>"


# ---------------------------------------------------------------------------
# Expense model
# ---------------------------------------------------------------------------
class Expense(Base):
    """
    Represents a single expense entry recorded by a user.

    Columns
    -------
    id          : int, primary key, auto-increment
    user_id     : int, FK → users.id, not null
    date        : datetime — when the expense was incurred
    category    : str(100) — e.g. "Groceries", "Restaurants"
    amount      : float    — expense amount in the user's currency
    description : str(255), nullable — optional free-text note
    created_at  : datetime (UTC) — when the record was inserted

    Indexes
    -------
    ix_expenses_user_date      (user_id, date)     — range queries by month
    ix_expenses_user_category  (user_id, category) — category history / aggregates
    """

    __tablename__ = "expenses"

    id: int = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id: int = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    date: datetime = Column(DateTime, nullable=False)
    category: str = Column(String(100), nullable=False)
    amount: float = Column(Float, nullable=False)
    description: str | None = Column(String(255), nullable=True)
    created_at: datetime = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Many-to-one: each expense belongs to one user
    owner = relationship("User", back_populates="expenses")

    # ------------------------------------------------------------------
    # Composite indexes — defined at table level for multi-column support
    # ------------------------------------------------------------------
    __table_args__ = (
        # Optimises: "show me all expenses for user X in month Y"
        Index("ix_expenses_user_date", "user_id", "date"),
        # Optimises: "show me user X's history for category Y"
        Index("ix_expenses_user_category", "user_id", "category"),
    )

    def __repr__(self) -> str:
        return (
            f"<Expense id={self.id} user_id={self.user_id} "
            f"category={self.category!r} amount={self.amount}>"
        )
