from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List
from datetime import date as PyDate, datetime, timezone, timedelta
import pandas as pd
import os

from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from schemas import (
    PredictionRequest, PredictionResponse, ComparisonResponse, ModelMetrics,
    ExpenseCreate, ExpenseOut, MonthlySummary, CategoryHistory,
    UserCreate, UserLogin, Token, UserOut,
)
from model_loader import load_artifacts, predict, get_valid_categories, get_model_name
from database import get_db, init_db
from models import Expense
from auth import get_current_user
from models import User

# --- Lifespan: runs on startup and shutdown ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP — initialise database tables, then load ML model
    print("Initialising database...")
    init_db()
    print("Loading ML artifacts...")
    load_artifacts()
    print("API ready")
    yield
    # SHUTDOWN — cleanup if needed (nothing here)
    print("Shutting down")

# --- App instance ---
app = FastAPI(
    title="SpendSmart API",
    description="Predicts monthly spending per category using the selected best regression model",
    version="1.0.0",
    lifespan=lifespan
)

# --- CORS: allow React frontend to call this API ---
# In development React runs on localhost:5173, API on localhost:8000
# Without CORS the browser blocks cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://your-vercel-app.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------
# ROUTE 1: Health check — always build this first
# GET /health → { "status": "ok" }
# -----------------------------------------------------------
@app.get("/health")
def health_check():
    return {"status": "ok", "model": get_model_name(), "version": "1.0.0"}

# -----------------------------------------------------------
# ROUTE 2: Get valid categories
# GET /categories → ["Groceries", "Restaurants", ...]
# Frontend uses this to populate the dropdown
# -----------------------------------------------------------
@app.get("/categories")
def get_categories():
    return {"categories": get_valid_categories()}

# -----------------------------------------------------------
# ROUTE 3: Predict monthly spend — the core endpoint
# POST /predict
# Body: PredictionRequest
# Returns: PredictionResponse
# -----------------------------------------------------------
@app.post("/predict", response_model=PredictionResponse)
def predict_spend(request: PredictionRequest):
    try:
        predicted = predict(
            year=request.year,
            month=request.month,
            category=request.category,
            prev_month_spend=request.prev_month_spend,
            prev_prev_month_spend=request.prev_prev_month_spend,
            rolling_avg_3=request.rolling_avg_3
        )
        return PredictionResponse(
            predicted_spend=predicted,
            category=request.category,
            month=request.month,
            year=request.year,
            model_used=get_model_name()
        )
    except ValueError as e:
        # Known error — invalid category name
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        # Unknown error — don't expose internals
        raise HTTPException(status_code=500, detail="Prediction failed. Check server logs.")

# -----------------------------------------------------------
# ROUTE 4: Model comparison table
# GET /model-comparison
# Returns candidate models with their metrics
# Frontend uses this to render the comparison table
# -----------------------------------------------------------
@app.get("/model-comparison", response_model=ComparisonResponse)
def model_comparison():
    csv_path = os.path.join(
        os.path.dirname(__file__), '..', 'ml', 'data', 'model_comparison.csv'
    )
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail="model_comparison.csv not found. Run the notebook first.")
    
    df = pd.read_csv(csv_path)
    
    models = [
        ModelMetrics(
            model=row['Model'],
            mae=round(row['MAE ($)'], 2),
            rmse=round(row['RMSE ($)'], 2),
            r2=round(row['R²'], 4)
        )
        for _, row in df.iterrows()
    ]
    
    # Best model = lowest MAE
    best = df.loc[df['MAE ($)'].idxmin(), 'Model']
    
    return ComparisonResponse(models=models, best_model=best)


# ===========================================================================
# AUTH ROUTES — /auth/register, /auth/login, /auth/me
# These are public except /auth/me which requires a valid Bearer token.
# ===========================================================================

# -----------------------------------------------------------
# ROUTE 5: Register a new user
# POST /auth/register
# Body : UserCreate { email, password }
# Returns: Token { access_token, token_type }
# Errors : 400 if email already registered
# -----------------------------------------------------------
@app.post("/auth/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(
    body: UserCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new user account and return a JWT so the client is
    immediately authenticated after registration.
    """
    from auth import hash_password, create_access_token

    # 400 (not 404 or 409) — spec requirement for duplicate email
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.email)
    return Token(access_token=token, token_type="bearer")


# -----------------------------------------------------------
# ROUTE 6: Login
# POST /auth/login
# Body : UserLogin { email, password }
# Returns: Token { access_token, token_type }
# Errors : 401 for any credential failure (never 404)
# -----------------------------------------------------------
@app.post("/auth/login", response_model=Token)
def login(
    body: UserLogin,
    db: Session = Depends(get_db),
):
    """
    Verify credentials and return a signed JWT.

    Always returns HTTP 401 on failure — never reveals whether the email
    exists, preventing user enumeration attacks.
    """
    from auth import verify_password, create_access_token

    invalid_creds = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user: User | None = db.query(User).filter(User.email == body.email).first()
    # Use verify_password even when user is None to prevent timing attacks
    if user is None or not verify_password(body.password, user.hashed_password):
        raise invalid_creds

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact support.",
        )

    token = create_access_token(subject=user.email)
    return Token(access_token=token, token_type="bearer")


# -----------------------------------------------------------
# ROUTE 7: Get current user profile
# GET /auth/me
# Returns: UserOut { id, email, created_at }
# Errors : 401 if token missing / invalid
# -----------------------------------------------------------
@app.get("/auth/me", response_model=UserOut)
def me(
    current_user: User = Depends(get_current_user),
):
    """Return the authenticated user's public profile."""
    return current_user


# ===========================================================================
# EXPENSE ROUTES — all require a valid Bearer token
# Route ordering matters: static paths (summary, last-known, history)
# MUST be declared before the parameterised path (/expenses/{id})
# so FastAPI doesn't treat "summary" as an expense id.
# ===========================================================================


# -----------------------------------------------------------
# ROUTE 5: Log a new expense
# POST /expenses
# Body : ExpenseCreate
# Returns: ExpenseOut (the saved record with id + created_at)
# -----------------------------------------------------------
@app.post("/expenses", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    body: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log a single expense for the authenticated user."""
    # Validate category against ML model's known categories
    valid = get_valid_categories()
    if body.category not in valid:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown category '{body.category}'. Valid: {valid}",
        )

    expense = Expense(
        user_id=current_user.id,
        date=datetime.combine(body.date, datetime.min.time()),  # date → datetime
        category=body.category,
        amount=body.amount,
        description=body.description,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


# -----------------------------------------------------------
# ROUTE 6: List expenses for a month
# GET /expenses?year=2024&month=3
# Returns: List[ExpenseOut]
# -----------------------------------------------------------
@app.get("/expenses", response_model=List[ExpenseOut])
def list_expenses(
    year: int = Query(..., ge=2018, le=2030),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all expenses the user logged in the given month."""
    rows = (
        db.query(Expense)
        .filter(
            Expense.user_id == current_user.id,
            extract("year",  Expense.date) == year,
            extract("month", Expense.date) == month,
        )
        .order_by(Expense.date)
        .all()
    )
    return rows


# -----------------------------------------------------------
# ROUTE 7: Monthly spend per category (summary)
# GET /expenses/summary?year=2024&month=3
# Returns: List[MonthlySummary]
# NOTE: declared BEFORE /expenses/{id} to avoid routing clash
# -----------------------------------------------------------
@app.get("/expenses/summary", response_model=List[MonthlySummary])
def monthly_summary(
    year: int = Query(..., ge=2018, le=2030),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the total spend per category for a given month."""
    rows = (
        db.query(Expense.category, func.sum(Expense.amount).label("total"))
        .filter(
            Expense.user_id == current_user.id,
            extract("year",  Expense.date) == year,
            extract("month", Expense.date) == month,
        )
        .group_by(Expense.category)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )
    return [MonthlySummary(category=r.category, total=round(r.total, 2)) for r in rows]


# -----------------------------------------------------------
# ROUTE 8: Last-known feature values for a category
# GET /expenses/last-known/{category}
# Returns: { prev_month_spend, prev_prev_month_spend,
#            rolling_avg_3, last_year, last_month }
# Used to auto-fill the prediction form.
# NOTE: declared BEFORE /expenses/{id}
# -----------------------------------------------------------
@app.get("/expenses/last-known/{category}")
def last_known(
    category: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compute the ML feature values the frontend needs to pre-fill the
    prediction form, derived entirely from the user's own logged data.

    Returns the three most recent calendar-month totals for *category*,
    labelled as prev_month_spend / prev_prev_month_spend / rolling_avg_3.
    """
    valid = get_valid_categories()
    if category not in valid:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown category '{category}'. Valid: {valid}",
        )

    # Aggregate monthly totals for this user + category, newest first
    monthly_rows = (
        db.query(
            extract("year",  Expense.date).label("yr"),
            extract("month", Expense.date).label("mo"),
            func.sum(Expense.amount).label("total"),
        )
        .filter(
            Expense.user_id == current_user.id,
            Expense.category == category,
        )
        .group_by("yr", "mo")
        .order_by(extract("year", Expense.date).desc(),
                  extract("month", Expense.date).desc())
        .limit(3)
        .all()
    )

    if not monthly_rows:
        raise HTTPException(
            status_code=404,
            detail=f"No logged expenses found for category '{category}'.",
        )

    # Most-recent month is row 0
    totals = [float(r.total) for r in monthly_rows]

    prev_month_spend      = totals[0]
    prev_prev_month_spend = totals[1] if len(totals) > 1 else totals[0]
    rolling_avg_3         = round(sum(totals) / len(totals), 2)

    last_year  = int(monthly_rows[0].yr)
    last_month = int(monthly_rows[0].mo)

    return {
        "prev_month_spend":      round(prev_month_spend,      2),
        "prev_prev_month_spend": round(prev_prev_month_spend, 2),
        "rolling_avg_3":         rolling_avg_3,
        "last_year":             last_year,
        "last_month":            last_month,
    }


# -----------------------------------------------------------
# ROUTE 9: Category spending history over N months
# GET /expenses/history/{category}?months=6
# Returns: List[CategoryHistory]
# NOTE: declared BEFORE /expenses/{id}
# -----------------------------------------------------------
@app.get("/expenses/history/{category}", response_model=List[CategoryHistory])
def category_history(
    category: str,
    months: int = Query(6, ge=1, le=60, description="How many months of history to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return monthly spend totals for a category over the last N months."""
    valid = get_valid_categories()
    if category not in valid:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown category '{category}'. Valid: {valid}",
        )

    # Compute the cutoff date so we only look at the last N full months
    now = datetime.now(timezone.utc)
    # First day of the month N months ago
    cutoff_month = now.month - months
    cutoff_year  = now.year + cutoff_month // 12
    cutoff_month = cutoff_month % 12 or 12
    cutoff = datetime(cutoff_year, cutoff_month, 1)

    rows = (
        db.query(
            extract("year",  Expense.date).label("yr"),
            extract("month", Expense.date).label("mo"),
            func.sum(Expense.amount).label("total"),
        )
        .filter(
            Expense.user_id == current_user.id,
            Expense.category == category,
            Expense.date >= cutoff,
        )
        .group_by("yr", "mo")
        .order_by(extract("year", Expense.date),
                  extract("month", Expense.date))
        .all()
    )

    return [
        CategoryHistory(year=int(r.yr), month=int(r.mo), total=round(r.total, 2))
        for r in rows
    ]


# -----------------------------------------------------------
# ROUTE 10: Delete an expense (owner only)
# DELETE /expenses/{id}
# Returns: 204 No Content
# NOTE: declared LAST so static sub-paths match first
# -----------------------------------------------------------
@app.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an expense — only if it belongs to the authenticated user."""
    expense: Expense | None = db.query(Expense).filter(Expense.id == expense_id).first()

    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")

    # Ownership check — never let user A delete user B's data
    if expense.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorised to delete this expense",
        )

    db.delete(expense)
    db.commit()
    # 204 → return nothing
