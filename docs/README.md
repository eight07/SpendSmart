# SpendSmart

> **Full-stack ML personal finance tracker** — log expenses, forecast next month's spend, and compare model accuracy, all in one place.

---

## Features

| Feature | Description |
|---|---|
| 🔐 **JWT Auth** | Register / login with email + password; token stored in localStorage |
| 💸 **Expense Logging** | Add, browse, and delete expenses with category & date validation |
| 🤖 **ML Spend Prediction** | RandomForestLog model forecasts category spend for any month |
| 📊 **Dashboard with Charts** | Monthly bar chart, category line trend, summary KPI cards |
| 🔬 **Model Comparison** | MAE / RMSE / R² table comparing all candidate models |
| ✨ **Auto-fill from History** | Prediction form pre-populates from the user's own expense history |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI · SQLAlchemy · PyMySQL · python-jose (JWT) · Pydantic |
| **Database** | MySQL (dev: local, prod: Railway) |
| **ML** | scikit-learn · XGBoost · pandas · joblib |
| **Best Model** | `RandomForestLog` — R²=0.9685, MAE=$26.35 |
| **Frontend** | React 18 · Vite · TailwindCSS · Recharts |

---

## Live Demo

| Service | URL |
|---|---|
| Frontend | [YOUR_VERCEL_URL](https://YOUR_VERCEL_URL) |
| Backend API | [YOUR_RENDER_URL](https://YOUR_RENDER_URL) |
| Swagger docs | `YOUR_RENDER_URL/docs` |

---

## Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- MySQL running locally (or connection string to a remote instance)

---

### Backend

```bash
cd backend

# 1. Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate       # Windows
# source venv/bin/activate    # macOS / Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
#   Edit .env and fill in DATABASE_URL and JWT_SECRET

# 4. Start the server
python -m uvicorn main:app --reload --port 8000
```

Open **http://localhost:8000/docs** — all 10 routes should be listed.

---

### Frontend

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   Set VITE_API_URL=http://localhost:8000

# 3. Start dev server
npm run dev
```

Open **http://localhost:5173**.

---

### ML Model (one-time training)

```bash
cd ml
.\venv\Scripts\activate
jupyter notebook notebooks/explore.ipynb
# Run all cells → saves model.pkl and artifacts to ml/data/
```

The backend loads `ml/data/model.pkl` at startup. If it's missing, the `/predict` endpoint will fail.

---

## Environment Variables

### `backend/.env`

| Variable | Example | Required |
|---|---|---|
| `DATABASE_URL` | `mysql+pymysql://user:pass@localhost:3306/spendsmart` | ✅ |
| `JWT_SECRET` | `any-long-random-string` | ✅ |

### `frontend/.env`

| Variable | Example | Required |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | ✅ |

---

## API Reference (summary)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Health check |
| `GET` | `/categories` | No | List expense categories |
| `POST` | `/predict` | No | Run ML prediction |
| `GET` | `/model-comparison` | No | Model metrics table |
| `POST` | `/auth/register` | No | Register new user |
| `POST` | `/auth/login` | No | Login → returns JWT |
| `GET` | `/auth/me` | Yes | Current user info |
| `POST` | `/expenses` | Yes | Create expense |
| `GET` | `/expenses` | Yes | List expenses for month |
| `DELETE` | `/expenses/{id}` | Yes | Delete expense |
| `GET` | `/expenses/summary` | Yes | Category totals for month |
| `GET` | `/expenses/history/{cat}` | Yes | 12-month trend for category |
| `GET` | `/expenses/last-known/{cat}` | Yes | Last 3 months data (auto-fill) |

---

## Deployment

| Layer | Platform | Notes |
|---|---|---|
| Backend | **Render** | Free tier, set env vars in dashboard |
| Frontend | **Vercel** | Set `VITE_API_URL` to Render URL |
| Database | **Railway** | Free MySQL, connection string → `DATABASE_URL` |
