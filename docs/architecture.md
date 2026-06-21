# SpendSmart — System Architecture

## Overview
Three decoupled layers communicating over HTTP REST.
The ML model is trained offline and persisted to disk.
The API loads it once at startup and serves predictions in <100ms.

## Layer Diagram

┌─────────────────────────────────┐
│         React Frontend          │
│  Vite · TailwindCSS · Recharts  │
│       localhost:5173            │
└────────────┬────────────────────┘
             │ HTTP REST (JSON)
             │ POST /predict
             │ GET  /categories
             │ GET  /model-comparison
             │ GET  /health
┌────────────▼────────────────────┐
│        FastAPI Backend          │
│   Python · Uvicorn · Pydantic   │
│       localhost:8000            │
│                                 │
│  main.py        → routes        │
│  schemas.py     → validation    │
│  model_loader.py→ inference     │
└────────────┬────────────────────┘
             │ joblib.load() at startup
┌────────────▼────────────────────┐
│         ML Artifacts            │
│  ml/data/                       │
│  ├── model.pkl       (RF model) │
│  ├── label_encoder.pkl          │
│  ├── features.pkl               │
│  ├── category_stats.pkl         │
│  ├── best_model_name.pkl        │
│  └── model_comparison.csv       │
└─────────────────────────────────┘
             ▲
             │ trained by
┌────────────┴────────────────────┐
│      Jupyter Notebook           │
│  ml/notebooks/explore.ipynb     │
│  pandas → feature engineering   │
│  sklearn → 5 models compared    │
│  best model saved as model.pkl  │
└─────────────────────────────────┘

## Request Lifecycle
1. User fills form in React
2. React sends POST /predict with JSON body
3. FastAPI validates via Pydantic (auto 422 on bad input)
4. model_loader builds 13-feature vector
5. RandomForestLog predicts in log-space, returns expm1(pred)
6. Response JSON returned to React
7. React renders prediction in Recharts chart

## ML Pipeline (offline)
spending.csv
  → pandas: parse dates, separate debits
  → exclude Credit Card Payment (transfer, not spend)
  → groupby Year+Month+Category → MonthlySpend
  → lag features: PrevMonthSpend, PrevPrevMonthSpend, RollingAvg3
  → category stats: Mean, Median, Std (train-only, no leakage)
  → derived: LagDelta, LagToMeanRatio, MonthSin, MonthCos
  → chronological 80/20 split
  → 5 models compared: LR, Ridge, Lasso, RF, XGBoost, RFLog
  → best: RandomForestLog (R²=0.9685, MAE=$26.35)
  → saved: model.pkl + artifacts

## Key Design Decisions
- No database: single-user demo app, state lives in React
- No auth: out of scope for V1
- Model loaded at startup not per-request: latency ~1ms vs ~500ms
- Log-transform target: handles right-skewed spend distribution
- Category stats from train only: prevents data leakage
- Chronological split: simulates real deployment conditions

## Deployment (Day 7)
- Backend: Render (free tier, FastAPI + uvicorn)
- Frontend: Vercel (free tier, React + Vite)
- No managed database needed