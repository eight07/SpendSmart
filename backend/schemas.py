from pydantic import BaseModel, Field
from typing import List

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