# SpendSmart — How the Backend Works

## Startup Flow

When you run `uvicorn main:app --reload`, this is what happens before the first request is ever accepted:

```
uvicorn starts
  → lifespan() runs (main.py)
    → load_artifacts() runs (model_loader.py)
      → loads model.pkl            (RandomForestLog pipeline)
      → loads best_model_name.pkl  ("RandomForestLog")
      → loads label_encoder.pkl    (category → integer mapping)
      → loads features.pkl         (exact ordered list of 13 feature names)
      → loads category_stats.pkl   (dict of per-category mean/median/std)
    → prints "API ready"
  → server starts accepting requests
```

Everything is loaded into module-level global variables — `model`, `model_name`,
`label_encoder`, `feature_columns`, `category_stats`. These stay in memory for
the entire lifetime of the server. Every request reuses them without reloading
from disk — this is why predictions are fast (~1ms inference vs ~500ms if you
reloaded the model on every request).

---

## A Prediction Request — Step by Step

React sends `POST /predict` with this JSON body:

```json
{
  "year": 2018,
  "month": 8,
  "category": "Groceries",
  "prev_month_spend": 210.50,
  "prev_prev_month_spend": 195.00,
  "rolling_avg_3": 200.00
}
```

### Step 1 — Pydantic validation (automatic, before your code runs)
FastAPI reads the `PredictionRequest` type annotation on `predict_spend(request: PredictionRequest)` and automatically:
- Checks `year` is between 2018 and 2030
- Checks `month` is between 1 and 12
- Checks all floats are >= 0
- If any check fails → returns 422 Unprocessable Entity immediately

You write zero validation logic. Pydantic handles it.

### Step 2 — Route handler (`main.py`)
```python
@app.post("/predict", response_model=PredictionResponse)
def predict_spend(request: PredictionRequest):
    predicted = predict(
        year=request.year,
        month=request.month,
        category=request.category,
        prev_month_spend=request.prev_month_spend,
        prev_prev_month_spend=request.prev_prev_month_spend,
        rolling_avg_3=request.rolling_avg_3
    )
    return PredictionResponse(predicted_spend=predicted, ...)
```

### Step 3 — Feature construction (`model_loader.py`)

```python
# a. Validate category
if category not in label_encoder.classes_:
    raise ValueError(f"Unknown category. Valid: {list(label_encoder.classes_)}")
# Why: Credit Card Payment was excluded from training — it's not in the encoder.
# This returns a clean 422 instead of a cryptic internal error.

# b. Encode category string → integer
category_encoded = label_encoder.transform([category])[0]
# "Groceries" → 6  (same mapping used during training)

# c. Look up category stats from training data
stats = category_stats["by_category"]["Groceries"]
# → {"CategoryMean": 187.3, "CategoryMedian": 182.0, "CategoryStd": 24.1}
# These were computed on TRAIN data only — no leakage.

# d. Build derived features
LagDelta       = 210.50 - 195.00          # = 15.50  (spending going up)
LagToMeanRatio = 210.50 / (187.3 + 1)     # = 1.12   (11% above average)
MonthSin       = sin(2π × 8 / 12)         # cyclical August encoding
MonthCos       = cos(2π × 8 / 12)         # cyclical August encoding

# e. Assemble all 13 features as a named DataFrame
# Named DataFrame guarantees column order matches training
# even if feature list ever changes
features = pd.DataFrame([[...]], columns=feature_columns)

# f. Run prediction
prediction = model.predict(features)[0]
# RandomForestLog internally: expm1(rf.predict(log1p_features))

# g. Clip negative predictions (can't spend negative money)
return max(0.0, round(float(prediction), 2))
```

### Step 4 — Response
FastAPI wraps the result in `PredictionResponse`, validates it against the
schema, serialises to JSON, and returns:

```json
{
  "predicted_spend": 69.19,
  "category": "Groceries",
  "month": 8,
  "year": 2018,
  "model_used": "RandomForestLog"
}
```

---

## All Four Endpoints

| Method | Route | What it does | Used by |
|--------|-------|--------------|---------|
| GET | `/health` | Returns server status + model name | Monitoring |
| GET | `/categories` | Returns list of valid category names | Frontend dropdown |
| POST | `/predict` | Takes spend history, returns prediction | Core feature |
| GET | `/model-comparison` | Returns all 5 models + their metrics | Frontend table |

---

## Why Each File Exists

### `main.py`
The entry point. Defines the FastAPI app, registers CORS middleware, registers
all routes, and sets up the lifespan (startup/shutdown) hook. It delegates
actual ML work to `model_loader.py` — main.py only handles HTTP concerns.

### `schemas.py`
Pydantic models that define the shape of every request and response. Keeping
these in a separate file means:
- `main.py` stays clean (imports schemas, doesn't define them)
- Schemas are reusable across routes
- FastAPI reads them to auto-generate the `/docs` Swagger page

### `model_loader.py`
All ML inference logic lives here, isolated from HTTP logic. Responsibilities:
- Load all artifacts at startup into module-level globals
- Build the 13-feature vector for every prediction
- Apply the same transforms used during training (encoding, stats lookup, trig)
- Return a single float — no HTTP knowledge, no FastAPI imports

This separation means you could swap FastAPI for Flask tomorrow and
`model_loader.py` would not change at all.

### `requirements.txt`
Lists all Python dependencies. Render (deployment) reads this file and installs
them automatically. Without it, the server would start and immediately crash
with `ModuleNotFoundError`.

---

## Why `pd.DataFrame` Instead of `np.array` for Inference

```python
# Fragile — column order depends on list order
features = np.array([[year, month, category_encoded, ...]])

# Safe — columns matched by name, order guaranteed
features = pd.DataFrame([[...]], columns=feature_columns)
```

Named DataFrame construction is defensive coding. If `feature_columns` ever
has a different order than you expect, the DataFrame assignment by column name
catches it. `np.array` would silently pass wrong values to wrong features.

---

## Why CORS Middleware Is Required

Browsers enforce a security rule: JavaScript on `localhost:5173` cannot call
APIs on `localhost:8000` (different port = different "origin") unless the
server explicitly allows it.

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://your-vercel-app.vercel.app"],
    ...
)
```

This adds `Access-Control-Allow-Origin` headers to every response. Without it:
- Postman works fine (not a browser, ignores CORS)
- curl works fine (not a browser)
- React in the browser → blocked, CORS error in console

In production, replace `"https://your-vercel-app.vercel.app"` with your actual
Vercel URL after deployment.

---

## The Log-Transform — How RandomForestLog Actually Works

The model saved in `model.pkl` is not a plain Random Forest. It is a wrapper
that applies a log transform to the target before training and reverses it on
prediction:

```
Training:
  MonthlySpend → log1p(MonthlySpend) → RandomForest.fit()

Prediction:
  RandomForest.predict() → expm1(result) → predicted_spend
```

Why `log1p` and not `log`? Because `log(0)` is undefined. `log1p(x) = log(x+1)`
handles zero-spend months safely.

The model never sees raw dollar values during training — it sees log-space
values. This compresses the gap between Mortgage ($1,200) and Music ($11):

```
Raw:    Music=11,   Mortgage=1200  → ratio = 109x apart
Log1p:  Music=2.48, Mortgage=7.09  → ratio = 2.86x apart
```

The model learns proportional patterns instead of being dominated by
high-value categories. `expm1` converts back to real dollars on the way out.

---

*Part of SpendSmart technical documentation. See also: decisions.md, architecture.md*