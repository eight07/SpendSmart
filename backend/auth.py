"""
auth.py — Authentication dependency for SpendSmart.

Provides:
  get_current_user(token, db) → User ORM object

Flow:
  1. The client sends a Bearer token in the Authorization header.
  2. We decode the JWT and extract the user's email (subject claim).
  3. We look up the user in the database and return the ORM object.
  4. Any route that depends on get_current_user() is automatically protected.

Token creation (for the future /auth/login route) is also handled here so
that the signing key and algorithm are defined in one place.

Environment variables:
  JWT_SECRET                  — HS256 signing secret (required in production)
  ACCESS_TOKEN_EXPIRE_MINUTES — optional, defaults to 10080 (7 days)
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

# python-jose for JWT  (pip install python-jose[cryptography])
try:
    from jose import JWTError, jwt
except ImportError:
    raise ImportError(
        "python-jose is required for authentication. "
        "Run: pip install python-jose[cryptography]"
    )

# passlib for password hashing  (pip install passlib[bcrypt])
try:
    from passlib.context import CryptContext
except ImportError:
    raise ImportError(
        "passlib is required for password hashing. "
        "Run: pip install passlib[bcrypt]"
    )

from database import get_db
from models import User

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
# JWT_SECRET must be set in production — use a long, random string.
# Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY: str = os.environ.get("JWT_SECRET", "change-me-in-production-use-a-long-random-string")
ALGORITHM: str = "HS256"
# 7 days = 60 min × 24 h × 7 d = 10080 minutes
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

# ---------------------------------------------------------------------------
# Password hashing context
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------------------------------------------------------------------------
# OAuth2 scheme — FastAPI will extract the Bearer token from the
# Authorization header and pass it to get_current_user() automatically.
# tokenUrl points to the login endpoint (to be implemented separately).
# ---------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """Return the bcrypt hash of a plaintext password."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches the stored *hashed* password."""
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT whose 'sub' claim is *subject* (the user's email).

    Parameters
    ----------
    subject      : value to store in the 'sub' claim (e.g. user email)
    expires_delta: custom lifetime; defaults to ACCESS_TOKEN_EXPIRE_MINUTES
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ---------------------------------------------------------------------------
# FastAPI dependency — used with Depends() in route handlers
# ---------------------------------------------------------------------------

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Decode the Bearer JWT and return the matching active User.

    Raises HTTP 401 for any token or DB lookup failure so the caller
    never has to handle authentication logic itself.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user: Optional[User] = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    return user
