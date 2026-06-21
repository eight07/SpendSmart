# SpendSmart — Technical Decisions & Documentation

## Project Overview
SpendSmart is a personal finance ML web app that predicts monthly spending per category using the best selected regression model. This document explains every significant decision made during the project — from data cleaning to model selection. 

---

## 1. Dataset Understanding

### Columns
| Column | Type | Meaning |
|---|---|---|
| Date | string → datetime | Transaction date |
| Description | string | Merchant name |
| Amount | float | Transaction amount in dollars |
| Transaction Type | string | 'debit' (expense) or 'credit' (income/repayment) |
| Category | string | Spending category (Groceries, Restaurants, etc.) |
| Account Name | string | Which card/account was used |

### Key Observation
The dataset contains both debits and credits. A credit card payment of $2,298 appears as a 'credit' — it is NOT income, it is a repayment. Including credits in spend prediction would corrupt the target variable. We filter to debits only.

**Interview answer:** "I separated debits from credits because credits represent repayments and income, not actual spending behaviour. Including them would mean the model learns to predict repayments rather than expenditure patterns."

---

## 2. EDA — What the Charts Tell Us

### 2a. Total Spend by Category (Bar Chart)
**What it shows:** Which categories consume the most money in absolute terms.  
**What to look for:** Mortgage & Rent will almost certainly dominate — it's a fixed, recurring, high-value expense. This is important for the model because it means category identity (CategoryEncoded) is a very strong feature — the model needs to know "this is a Mortgage row" to predict correctly.  
**Interview insight:** "The high variance between categories (Mortgage = $1,200/month vs Music = $10/month) means a single global model must learn very different spending scales for each category. This is why CategoryEncoded is a critical feature."

### 2b. Average Transaction Size by Category (Bar Chart)
**What it shows:** The typical size of a single transaction per category.  
**What to look for:** Mortgage has 1 large transaction/month. Groceries has many smaller ones. This tells us our aggregation (sum per month per category) is the right approach — we're not sensitive to transaction count, only total spend.

### 2c. Monthly Spending Trend (Line Chart)
**What it shows:** How total monthly spending changes over time.  
**What to look for:**
- Seasonal spikes (December = Shopping spike, January = lower spend)
- An overall upward or downward trend
- Any anomalous months (a month with unusually high spend might indicate a one-time purchase)

**Why it matters for ML:** If there's a clear time trend, the Year and Month features will be informative. If spending is flat over time, those features add little value.

### 2d. Monthly Spend Heatmap by Category (Heatmap)
**What it shows:** A grid of Month (rows) vs Category (columns), with colour intensity = total spend.  
**What to look for:**
- Dark cells = high spend that month in that category
- Consistent dark rows across all categories = generally high-spend months
- Category-specific seasonal patterns (Utilities dark in winter months)

**Interview insight:** "The heatmap revealed category-specific seasonality — for example Utilities spending increases in winter months. This justifies including Month as a feature and suggests that a model treating all months equally (like simple linear regression) may underperform versus tree-based models that can learn non-linear seasonal interactions."

---

## 3. The ML Problem Statement

> **Given the year, month, category, and that category's recent spending history — predict the total amount spent in that category for that month.**

Each row in `ml_df` represents **one category in one specific month**. For example:
- Row: Year=2018, Month=3, Category=Groceries, PrevMonthSpend=210 → Predict: MonthlySpend=198

### Why NOT predict all categories together with cross-category features?
At prediction time (beginning of a new month), we don't yet know how much will be spent on *other* categories. Using them as features would be **data leakage** — training would work but real-world prediction would be impossible. Only the same category's own historical data is available at prediction time.

**Interview answer:** "I deliberately excluded cross-category features to avoid data leakage. In production, when predicting March Grocery spend, you only know February and January history — not what was spent on Restaurants in March simultaneously."

---

## 4. Feature Engineering Decisions

### Final features used by the model
| Feature | What it is | Why it helps |
|---|---|---|
| `Year` | 2018, 2019, etc. | Captures inflation and lifestyle changes over years |
| `Month` | 1–12 | Captures seasonality (Utilities up in winter, Shopping up in December) |
| `CategoryEncoded` | Integer representing the category | Tells the model which category this row is about |
| `PrevMonthSpend` | This category's spend last month | Strongest predictor — habits are sticky |
| `PrevPrevMonthSpend` | This category's spend two months ago | Second data point to smooth noise |
| `RollingAvg3` | 3-month rolling average for this category | Robust smoothed baseline, reduces outlier sensitivity |
| `CategoryMean` | Training-set mean spend for the category | Gives the model category-scale context |
| `CategoryMedian` | Training-set median spend for the category | Robust category baseline |
| `CategoryStd` | Training-set spend volatility for the category | Captures whether the category is stable or variable |
| `LagDelta` | Last month minus two months ago | Captures short-term direction of change |
| `LagToMeanRatio` | Last month relative to category mean | Shows whether recent spend is above/below normal |
| `MonthSin`, `MonthCos` | Cyclical month encoding | Represents seasonality without treating December and January as far apart |

**Target:** `MonthlySpend` — total spent in this category this month.

### Why we aggregated to monthly level
Raw transactions are too granular for monthly prediction. We group by Year + Month + Category and sum Amount. This creates one row per category per month — the right granularity for our prediction task.

### Why lag features work
Human spending is habitual. If you spent $200 on Groceries last month, you'll very likely spend a similar amount this month. The category's own recent history is far more predictive than the calendar month alone. This is the same principle behind autoregressive models in time series forecasting (AR models).

### Why RollingAvg3 specifically
A single previous month could be an outlier (holiday, travel, one-off purchase). The 3-month rolling average provides a smoothed baseline that's more robust to spikes. It's calculated on shifted data (`shift(1)`) so it never includes the current month — no leakage.

### Why LabelEncoder for Category
ML models require numerical inputs. LabelEncoder converts strings to integers (Groceries=3, Restaurants=7, etc.). We save the encoder so the API applies the **same mapping** at inference time.  
**Caveat:** LabelEncoder implies ordinal relationship (3 < 7) which tree-based models handle fine but linear models may misinterpret. V2 improvement: use OneHotEncoding for linear models.

### Why we dropped NaN lag feature rows
The first 1–2 months per category have no previous month to reference. We drop these rather than impute with zeros/means because imputed values would give the model false historical signals. Cost: a few rows lost. Benefit: clean, truthful training data.

---

## 5. Train/Test Split Decision

### Why no shuffle — temporal data leakage
Shuffling time-series data would allow the model to see November data while training on October — predicting the past using the future. This produces misleadingly good training metrics that completely fail in production.

**Correct approach:** Chronological split — first 80% of rows (earliest months) for training, last 20% (most recent months) for testing. This simulates real deployment.

### Why 80/20
With a small aggregated dataset (~few hundred rows), 80/20 gives enough training data while keeping a meaningful test set. For larger datasets, 70/30 or 60/40 is common.

---

## 6. Model Decisions & Equations

### Model 1: Linear Regression (Baseline)
**Why first:** Start with the simplest model. Sets a performance floor — every more complex model should beat it or the complexity isn't justified.

**Equation:**
```
MonthlySpend = w1*Year + w2*Month + w3*CategoryEncoded
             + w4*PrevMonthSpend + w5*PrevPrevMonthSpend
             + w6*RollingAvg3 + bias
```
The model learns weights w1–w6 that minimise total squared error.  
**Weakness:** Assumes spending changes *linearly* with each feature. Can't capture interactions like "December AND Shopping = spike".

---

### Model 2: Ridge Regression
**What it adds:** L2 regularisation.

**Loss function:**
```
Loss = MSE + α * (w1² + w2² + w3² + w4² + w5² + w6²)
```
**Effect:** Shrinks all weights toward zero without eliminating any. Reduces overfitting when features are correlated (PrevMonthSpend and RollingAvg3 are highly correlated — Ridge handles this gracefully).  
**α hyperparameter:** Higher = more regularisation = simpler model = less overfitting but more bias.

---

### Model 3: Lasso Regression
**What it adds:** L1 regularisation.

**Loss function:**
```
Loss = MSE + α * (|w1| + |w2| + |w3| + |w4| + |w5| + |w6|)
```
**Key difference from Ridge:** The L1 penalty's geometry pushes some weights to *exactly* zero — automatic feature selection. If Year has no predictive power, Lasso zeroes its weight entirely.  
**Tradeoff:** Can be unstable when features are highly correlated — may arbitrarily zero one of two correlated features.

---

### Model 4: Random Forest
**What it is:** 100 decision trees, each trained on a random bootstrap sample of rows and random subset of features (bagging). Final prediction = average across all trees.

**Why it outperforms linear models:** Learns non-linear relationships and feature interactions automatically. The December + Shopping interaction is captured without explicitly engineering it.

**Key hyperparameters:**
- `n_estimators=100`: More trees = more stable predictions. Diminishing returns after ~100.
- `max_depth=6`: Tree depth. Too deep = memorises training data (overfitting). Too shallow = misses patterns (underfitting).

**Feature importance:** RF ranks features by how much they reduce prediction error across all splits. PrevMonthSpend typically ranks highest — this validates our feature engineering decision.

---

### Model 5: XGBoost
**What it is:** Gradient boosted trees. Starts with a naive prediction (mean of all targets). Then builds Tree 1 to predict the residual errors. Tree 2 corrects Tree 1's residuals. And so on for 200 trees.

**Final prediction:**
```
MonthlySpend = base_score + Tree1(X) + Tree2(X) + ... + Tree200(X)
```

**Why it usually beats RF on tabular data:** Boosting focuses learning on hard-to-predict rows. Built-in L1/L2 regularisation on tree weights.

**Key hyperparameters:**
- `learning_rate=0.05`: Small steps, needs more trees, less overfitting
- `n_estimators=200`: More trees to compensate for small learning rate
- `max_depth=4`: Shallower than RF — boosting prefers weak learners
- `subsample=0.8`: Uses 80% of rows per tree — adds randomness, reduces overfitting

**Tradeoff vs RF:** More hyperparameters to tune. More sensitive to outliers. Slower to train but typically achieves lower error on structured tabular data.

---

### Model 6: RandomForestLog
**What it is:** A Random Forest wrapped in a log-target transform. The model learns on `log1p(MonthlySpend)` and predictions are transformed back with `expm1`.

**Why log target helps:** Monthly spending is right-skewed: many categories are small and a few categories are large. The log transform compresses large values during training, reducing the impact of outliers while preserving positive predictions.

### Why log-transform the target?
MonthlySpend is right-skewed — most categories spend $20-200/month
but Mortgage spends $1,200/month. Training directly on raw values means
the model optimises heavily for large-value categories.

log1p(x) = log(x + 1) compresses large values:
  log1p(1200) = 7.09   vs   log1p(50) = 3.93
  Raw ratio: 24x apart → Log ratio: 1.8x apart

The model learns proportional patterns in log-space, then we recover
real dollar predictions with expm1(prediction).

Why +1? log(0) is undefined. Adding 1 handles zero-spend months safely.

Tradeoff: Errors in log-space don't directly translate to dollar errors.
A log-space error of 0.1 means ~10% dollar error regardless of category
size — which is actually fairer than raw-space MAE.

**Final prediction shape:**
```
prediction = expm1(RandomForest(log1p(MonthlySpend)))
```

**Why it won:** After excluding `Credit Card Payment` and adding category-scale features, `RandomForestLog` achieved the best combination of high R² and low MAE on the chronological test split.

**Tradeoff:** Less directly interpretable than Ridge, and SHAP is generated from the plain Random Forest candidate for simpler tree-based interpretation.

---

## 7. Evaluation Metrics

### How metrics are computed
Metrics are computed across **ALL rows in the test set** — all categories, all test months combined. A model that's terrible at predicting Mortgage ($1,200/month) will have much higher MAE than one that's bad at Music ($10/month), because errors are in dollars.

**Per-category metrics:** Filter test set by category and compute MAE separately for each. Tells you where the model struggles specifically.

### MAE — Mean Absolute Error
```
MAE = (1/n) * Σ |actual_i - predicted_i|
```
**Units:** dollars  
**Interpretation:** "On average, predictions are off by $X"  
**When to prefer:** When all errors matter equally. Most interpretable for stakeholders.

### RMSE — Root Mean Squared Error
```
RMSE = sqrt( (1/n) * Σ (actual_i - predicted_i)² )
```
**Units:** dollars  
**Interpretation:** Similar to MAE but penalises large errors disproportionately  
**When to prefer:** When large errors are especially bad (e.g. predicting $1,200 Mortgage as $400 is worse than 4× predicting $50 as $40)  
**RMSE > MAE always.** If RMSE >> MAE, you have outlier predictions — investigate which categories the model struggles with.

### R² — Coefficient of Determination
```
R² = 1 - (Σ(actual - predicted)²) / (Σ(actual - mean(actual))²)
```
**Range:** -∞ to 1.0  
**Interpretation:** "Model explains X% of variance in monthly spending"  
- R² = 1.0: Perfect predictions
- R² = 0: No better than always predicting the mean
- R² < 0: Worse than predicting the mean (model is harmful)

**Caveat:** R² can be misleading on small datasets. Always report alongside MAE and RMSE.

### Why report all three
No single metric tells the full story:
- Good R², high RMSE → a few large errors
- Good MAE, poor R² → consistently slightly off everywhere
- Good RMSE, poor MAE → errors concentrated on a few rows

---

## 8. SHAP — Explainability

### What SHAP is
SHAP (SHapley Additive exPlanations) assigns each feature a contribution value for each individual prediction. Derived from cooperative game theory — each feature's SHAP value is its average marginal contribution across all possible feature orderings.

### What the SHAP Summary Plot shows
- **X-axis:** SHAP value — positive means it pushed the prediction higher, negative means lower
- **Y-axis:** Features ranked by total importance (top = most impactful)
- **Colour:** Feature value (red = high value, blue = low value)

**Expected finding:** PrevMonthSpend will be the top feature. Red dots (high PrevMonthSpend) will have positive SHAP values — if you spent a lot last month, the model expects high spend this month. This aligns with real-world spending behaviour and validates our feature engineering.

**Interview answer:** "I used SHAP to validate that the model learned meaningful patterns. The top feature was PrevMonthSpend — consistent with the intuition that spending is habitual. This gave me confidence the model was learning genuine signals rather than spurious correlations in the training data."

---

## 9. Model Persistence

### Why joblib over pickle
joblib is optimised for numpy arrays and sklearn objects — significantly faster serialisation for large models. pickle is Python's general-purpose serialiser; joblib is the sklearn-recommended approach for model persistence.

### What we saved and why
| File | Why |
|---|---|
| `model.pkl` | The trained best model — loaded by FastAPI at startup |
| `label_encoder.pkl` | Must apply identical category→integer mapping at inference time |
| `features.pkl` | Enforces correct feature order — ML models are sensitive to column order |
| `category_stats.pkl` | Stores train-only category means/medians/stds used for inference features |
| `best_model_name.pkl` | Stores the selected model name returned by the API |
| `model_comparison.csv` | Served by the API to the frontend's model comparison table |

---

*Document maintained throughout build. Last updated: Day 2.*

## 10. Improving R²

The original global model had low R² because it mixed normal spending with
`Credit Card Payment`, which behaves like a payoff/transfer category rather
than day-to-day spend. That category dominated the target variance and made
the model look worse globally.

The updated training pipeline excludes `Credit Card Payment` from the ML
target and adds train-only category statistics (`CategoryMean`,
`CategoryMedian`, `CategoryStd`) plus lag-derived features. This keeps the
prediction task focused on spend categories and gives the model category-scale
context without leaking test data.

Final selected model: `RandomForestLog`, a Random Forest wrapped in a
log-target transform. On the chronological test split it achieved:

- MAE: ~$26.35
- RMSE: ~$50.29
- R²: ~0.9685

Interview answer: "The low R² came from treating credit card payoff transfers
as ordinary expenses. After excluding that transfer category and adding
train-only category statistics, the best model explained most of the test-set
variance while keeping MAE low."
