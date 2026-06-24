# SpendSmart — System Architecture

## Overview

Three decoupled layers communicating over HTTP REST.
The ML model is trained offline and persisted to disk.
The API loads it once at startup and serves predictions in <100ms.
All user data is persisted to a MySQL database with JWT-protected routes.

---

## Layer Diagram

```
┌──────────────────────────────────────────────────┐
│              React Frontend (Vite)               │
│  TailwindCSS · Recharts · localhost:5173         │
│                                                  │
│  Pages                                           │
│  ├── /dashboard  → KPI cards + charts            │
│  ├── /log        → Add expense + transactions    │
│  ├── /predict    → ML form + model comparison    │
│  └── /settings   → Placeholder (v2)             │
└────────────────────┬─────────────────────────────┘
                     │ HTTP REST (JSON)
                     │ Authorization: Bearer <jwt>
┌────────────────────▼─────────────────────────────┐
│            FastAPI Backend (Uvicorn)             │
│  Python · Pydantic · python-jose · localhost:8000│
│                                                  │
│  main.py         → all routes + CORS             │
│  schemas.py      → Pydantic request/response     │
│  models.py       → SQLAlchemy ORM models         │
│  database.py     → engine, SessionLocal, init_db │
│  auth.py         → JWT encode/decode/verify      │
│  model_loader.py → ML inference                  │
└───────────┬────────────────┬─────────────────────┘
            │                │ joblib.load() at startup
    ┌───────▼───────┐  ┌─────▼──────────────────────┐
    │  MySQL DB     │  │      ML Artifacts           │
    │  (Railway)    │  │  ml/data/                   │
    │               │  │  ├── model.pkl (RF model)   │
    │  tables:      │  │  ├── label_encoder.pkl      │
    │  ├── users    │  │  ├── features.pkl           │
    │  └── expenses │  │  ├── category_stats.pkl     │
    └───────────────┘  │  ├── best_model_name.pkl   │
                       │  └── model_comparison.csv  │
                       └────────────────────────────┘
                                    ▲ trained by
                       ┌────────────┴───────────────┐
                       │      Jupyter Notebook      │
                       │  ml/notebooks/explore.ipynb│
                       │  pandas → feature eng.     │
                       │  sklearn → 5 models        │
                       │  best model → model.pkl    │
                       └────────────────────────────┘
```

---

## Database Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK | Auto-increment |
| `email` | VARCHAR | Unique |
| `hashed_password` | VARCHAR | bcrypt |
| `created_at` | DATETIME | Auto |

### `expenses`
| Column | Type | Notes |
|---|---|---|
| `id` | INT PK | Auto-increment |
| `user_id` | INT FK | → users.id |
| `amount` | FLOAT | USD |
| `category` | VARCHAR | From /categories list |
| `description` | TEXT | Nullable |
| `date` | DATE | User-selected, ≤ today |
| `created_at` | DATETIME | Auto |

---

## Auth Flow

```
1. POST /auth/register   → hash password, insert user
2. POST /auth/login      → verify password, return { access_token, token_type }
3. Frontend stores JWT in localStorage
4. Every protected request sends:
       Authorization: Bearer <access_token>
5. FastAPI verifies JWT signature and expiry on each request
6. GET /auth/me          → returns { id, email, created_at }
```

---

## ML Prediction Flow (online)

```
1. User selects category + enters last 3 months of spend
   (or auto-filled from GET /expenses/last-known/{category})
2. Frontend sends POST /predict with:
   { category, year, month, prev_month_spend,
     prev_prev_month_spend, rolling_avg_3 }
3. FastAPI validates via Pydantic (auto 422 on bad input)
4. model_loader builds 13-feature vector:
   PrevMonthSpend, PrevPrevMonthSpend, RollingAvg3,
   LagDelta, LagToMeanRatio, CategoryMean, CategoryMedian,
   CategoryStd, MonthSin, MonthCos, Year, Month, CategoryEncoded
5. RandomForestLog predicts in log-space → expm1(pred)
6. Response: { predicted_spend, category, month, year, model_used }
7. Frontend renders result card + recent forecasts chart
```

---

## ML Pipeline (offline training)

```
spending.csv
  → pandas: parse dates, separate debits
  → exclude Credit Card Payment (transfer, not spend)
  → groupby Year+Month+Category → MonthlySpend
  → lag features: PrevMonthSpend, PrevPrevMonthSpend, RollingAvg3
  → category stats: Mean, Median, Std (train-only, no leakage)
  → derived: LagDelta, LagToMeanRatio, MonthSin, MonthCos
  → chronological 80/20 split
  → 6 models compared: LR, Ridge, Lasso, RF, XGBoost, RFLog
  → winner: RandomForestLog (R²=0.9685, MAE=$26.35)
  → saved: model.pkl + all artifacts to ml/data/
```

---

## Key Design Decisions

- **Log-transform target**: handles right-skewed spend distribution; model predicts log(spend+1) and we return expm1(pred)
- **Category stats from train set only**: prevents data leakage into validation
- **Chronological split**: simulates real deployment (train on old, test on new)
- **Model loaded at startup**: latency ~1ms per prediction vs ~500ms cold load
- **JWT in localStorage**: simple single-user SPA pattern; for multi-user production consider httpOnly cookies
- **DB init at startup**: `Base.metadata.create_all(bind=engine)` ensures tables exist before first request

---

## Deployment Targets

| Layer | Platform | Plan |
|---|---|---|
| **Backend** | [Render](https://render.com) | Free tier — FastAPI + uvicorn |
| **Frontend** | [Vercel](https://vercel.com) | Free tier — React + Vite static build |
| **Database** | [Railway](https://railway.app) | Free tier — MySQL |

### Environment variables

**Render (backend):**
```
DATABASE_URL = mysql+pymysql://user:pass@host:port/spendsmart
JWT_SECRET   = <long-random-secret>
```

**Vercel (frontend):**
```
VITE_API_URL = https://YOUR_RENDER_APP.onrender.com
```