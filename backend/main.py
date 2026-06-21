from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import pandas as pd
import os

from schemas import PredictionRequest, PredictionResponse, ComparisonResponse, ModelMetrics
from model_loader import load_artifacts, predict, get_valid_categories, get_model_name

# --- Lifespan: runs on startup and shutdown ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP — load model before accepting requests
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
