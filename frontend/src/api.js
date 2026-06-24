const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getAuthToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("spendsmart_token")
  );
}

export function getAuthHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function requestJson(path, options = {}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Please sign in to view your dashboard.");
  }

  const headers = {
    ...getAuthHeaders(),
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (res.status === 204) return null;

  if (!res.ok) {
    let message = "Request failed";
    try {
      const err = await res.json();
      message = err.detail || message;
    } catch {
      message = res.statusText || message;
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return res.json();
}

async function requestPublicJson(path, payload) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const err = await res.json();
      message = err.detail || message;
    } catch {
      message = res.statusText || message;
    }
    throw new Error(message);
  }

  return res.json();
}

export async function fetchCategories() {
  const res = await fetch(`${BASE_URL}/categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  const data = await res.json();
  return data.categories;
}

export async function fetchPrediction(payload) {
  const res = await fetch(`${BASE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Prediction failed");
  }
  return res.json();
}

export async function fetchModelComparison() {
  const res = await fetch(`${BASE_URL}/model-comparison`);
  if (!res.ok) throw new Error("Failed to fetch model comparison");
  return res.json();
}

export async function loginUser(payload) {
  return requestPublicJson("/auth/login", payload);
}

export async function registerUser(payload) {
  return requestPublicJson("/auth/register", payload);
}

export async function fetchCurrentUser() {
  return requestJson("/auth/me");
}

export async function fetchLastKnownExpense(category) {
  return requestJson(`/expenses/last-known/${encodeURIComponent(category)}`);
}

export async function fetchExpenseSummary(year, month) {
  return requestJson(`/expenses/summary?year=${year}&month=${month}`);
}

export async function fetchCategoryHistory(category, months = 12) {
  return requestJson(
    `/expenses/history/${encodeURIComponent(category)}?months=${months}`
  );
}

export async function fetchExpenses(year, month) {
  return requestJson(`/expenses?year=${year}&month=${month}`);
}

export async function createExpense(payload) {
  return requestJson("/expenses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteExpense(id) {
  return requestJson(`/expenses/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Named aliases matching the spec (both old and new names are usable)
// ---------------------------------------------------------------------------
export const addExpense = createExpense;
export const getExpenses = fetchExpenses;
export const getMonthlySummary = fetchExpenseSummary;
export const getCategoryHistory = fetchCategoryHistory;
export const getLastKnownSpend = fetchLastKnownExpense;
