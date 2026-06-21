const BASE_URL = "http://localhost:8000";

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