from datetime import date as PyDate, datetime as PyDatetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

# --- INPUT: what the frontend sends to /predict ---
class PredictionRequest(BaseModel):
    year: int = Field(..., ge=2018, le=2030, description="Year of prediction")
    month: int = Field(..., ge=1, le=12, description="Month (1-12)")
    category: str = Field(..., description="Spending category name e.g. Groceries")
    prev_month_spend: float = Field(..., ge=0, description="Last month's spend in this category")
    prev_prev_month_spend: float = Field(..., ge=0, description="Two months ago spend")
    rolling_avg_3: float = Field(..., ge=0, description="3-month rolling average spend")

# --- OUTPUT: what the API sends back ---
class PredictionResponse(BaseModel):
    predicted_spend: float
    category: str
    month: int
    year: int
    model_used: str

# --- OUTPUT: model comparison table row ---
class ModelMetrics(BaseModel):
    model: str
    mae: float
    rmse: float
    r2: float

# --- OUTPUT: full comparison table ---
class ComparisonResponse(BaseModel):
    models: List[ModelMetrics]
    best_model: str


# ---------------------------------------------------------------------------
# Expense schemas
# ---------------------------------------------------------------------------

# --- INPUT: body for POST /expenses ---
class ExpenseCreate(BaseModel):
    date: PyDate = Field(..., description="Date of the expense (YYYY-MM-DD)")
    category: str = Field(..., description="Spending category, must match a model category")
    amount: float = Field(..., gt=0, description="Expense amount, must be greater than 0")
    description: Optional[str] = Field(None, max_length=255, description="Optional note")

    @field_validator("category")
    @classmethod
    def category_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("category must not be blank")
        return v.strip()


# --- OUTPUT: single expense record returned to the client ---
class ExpenseOut(BaseModel):
    id: int
    date: PyDate
    category: str
    amount: float
    description: Optional[str]
    created_at: PyDatetime

    model_config = {"from_attributes": True}   # enables ORM-mode (Pydantic v2)


# --- OUTPUT: per-category total for a given month (GET /expenses/summary) ---
class MonthlySummary(BaseModel):
    category: str
    total: float


# --- OUTPUT: one row of the monthly history series (GET /expenses/history/{category}) ---
class CategoryHistory(BaseModel):
    year: int
    month: int
    total: float


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

# --- INPUT: body for POST /auth/register ---
class UserCreate(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="Password (minimum 8 characters)")

    @field_validator("email")
    @classmethod
    def email_must_be_valid(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def password_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Password must not be blank")
        return v


# --- INPUT: body for POST /auth/login ---
class UserLogin(BaseModel):
    email: str = Field(..., description="Registered email address")
    password: str = Field(..., description="Account password")

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


# --- OUTPUT: JWT token returned after register / login ---
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- OUTPUT: current user's public profile (GET /auth/me) ---
class UserOut(BaseModel):
    id: int
    email: str
    created_at: PyDatetime

    model_config = {"from_attributes": True}  # enables ORM-mode (Pydantic v2)
