# SpendSmart 💸

A full-stack personal finance app that tracks your expenses and uses a trained ML model to predict next month's spending — per category.

---

## Features

| Area | What it does |
|---|---|
| **Authentication** | JWT-based register / login. All expense and prediction routes are protected. |
| **Expense logging** | Add, list, and delete expenses by date, category, and amount. |
| **Dashboard** | Monthly summary charts, category history sparklines, and a real-time expense table. |
| **ML Prediction** | POST `/predict` runs a trained regression model (auto-selected best from Ridge, Random Forest, XGBoost, etc.) to forecast your next month's spend for any category. |
| **Auto-fill prediction form** | Selecting a category fetches your last 3 months of real data via `GET /expenses/last-known/{category}` and pre-fills the form — one-click prediction for categories you already track. |
| **Model comparison** | `/model-comparison` returns MAE / RMSE / R² for every candidate model so you can see which one was picked and why. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite, TailwindCSS |
| Backend | FastAPI (Python 3.11+) |
| Database | MySQL via SQLAlchemy + PyMySQL |
| ML | scikit-learn / XGBoost, trained offline in `ml/` |
| Auth | JWT (python-jose), bcrypt password hashing |

---

## Environment Variables

### Backend — `backend/.env`

Copy `backend/.env.example` → `backend/.env` and fill in your values:

```env
# MySQL connection string
DATABASE_URL=mysql+pymysql://user:password@host:port/dbname

# Secret key used to sign JWT tokens — use a long random string in production
JWT_SECRET=your-secret-key-here
```

### Frontend — `frontend/.env`

Copy `frontend/.env.example` → `frontend/.env`:

```env
# Base URL of the FastAPI backend
VITE_API_URL=http://localhost:8000
```

> **Production**: set `VITE_API_URL` to your deployed API URL (e.g. a Railway / Render service) in your Vercel project's environment variable settings.

---

## Setup & Running Locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- MySQL server running locally (or a remote connection string)

### 1. Clone the repo

```bash
git clone https://github.com/your-username/SpendSmart.git
cd SpendSmart
```

### 2. Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env        # Windows
# cp .env.example .env        # macOS / Linux
# Edit .env with your DATABASE_URL and JWT_SECRET

# Start the API (tables are created automatically on startup)
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### 3. Train the ML model (first time only)

```bash
cd ml
pip install -r requirements.txt   # if separate, otherwise already installed above
jupyter notebook                  # open and run the training notebook
```

This writes `ml/data/model_comparison.csv` and the serialised model artifacts that the backend loads on startup.

### 4. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
copy .env.example .env        # Windows
# cp .env.example .env        # macOS / Linux

# Start the dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Project Structure

```
SpendSmart/
├── backend/
│   ├── main.py          # FastAPI app, all routes
│   ├── models.py        # SQLAlchemy ORM models (User, Expense)
│   ├── schemas.py       # Pydantic request/response schemas
│   ├── database.py      # Engine, session factory, init_db()
│   ├── auth.py          # JWT creation & verification, password hashing
│   ├── model_loader.py  # Loads trained ML artifacts, exposes predict()
│   ├── requirements.txt
│   ├── .env.example
│   └── alembic/         # Database migration scripts
│
├── frontend/
│   ├── src/
│   │   ├── api.js               # All fetch helpers (uses VITE_API_URL)
│   │   ├── context/             # AuthContext + useAuth hook
│   │   └── components/
│   │       ├── AuthPage.jsx
│   │       ├── Dashboard.jsx
│   │       ├── PredictionForm.jsx   # Auto-fills from expense history
│   │       └── PredictionResult.jsx
│   ├── .env.example
│   └── vite.config.js
│
├── ml/
│   ├── data/            # Training CSV + model_comparison.csv (git-ignored)
│   └── *.ipynb          # Training & evaluation notebooks
│
└── README.md
```

---

## Deployment

### Backend (e.g. Railway / Render)

1. Set `DATABASE_URL` and `JWT_SECRET` as environment variables in your hosting dashboard.
2. Set the start command to: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Update the CORS `allow_origins` list in `backend/main.py` to include your Vercel frontend URL.

### Frontend (Vercel)

1. Import the repo and set the **root directory** to `frontend`.
2. Add `VITE_API_URL` environment variable pointing to your deployed backend URL.
3. Vercel auto-detects Vite and builds with `npm run build`.

---

## API Reference (highlights)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create account, returns JWT |
| POST | `/auth/login` | — | Login, returns JWT |
| GET | `/auth/me` | ✅ | Current user profile |
| POST | `/expenses` | ✅ | Log an expense |
| GET | `/expenses?year&month` | ✅ | List expenses for a month |
| GET | `/expenses/summary?year&month` | ✅ | Category totals for a month |
| GET | `/expenses/last-known/{category}` | ✅ | Last 3-month feature values (prediction auto-fill) |
| DELETE | `/expenses/{id}` | ✅ | Delete an expense |
| POST | `/predict` | — | Run ML prediction |
| GET | `/categories` | — | Valid category list |
| GET | `/model-comparison` | — | Candidate model metrics |

Full interactive docs available at `/docs` when the backend is running.
