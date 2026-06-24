import { useEffect, useState } from "react";
import { createExpense, deleteExpense, fetchCategories, fetchExpenses } from "../api";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(dateStr) {
  // Treat the date string as local to avoid off-by-one from UTC conversion
  const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export default function LogExpensePage() {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();

  const [period, setPeriod] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dateError, setDateError] = useState("");
  const [form, setForm] = useState({
    amount: "",
    category: "",
    description: "",
    date: today,
  });

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [cats, rows] = await Promise.all([
        fetchCategories(),
        fetchExpenses(period.year, period.month),
      ]);
      setCategories(cats);
      setForm((f) => ({
        ...f,
        category: f.category || cats[0] || "",
      }));
      setExpenses([...rows].sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.year, period.month]);

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (name === "date") {
      setDateError(value > today ? "Cannot log future expenses" : "");
    }
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    if (form.date > today) {
      setDateError("Cannot log future expenses");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createExpense({
        amount: Number(form.amount),
        category: form.category,
        description: form.description || null,
        date: form.date,
      });
      setForm((f) => ({ ...f, amount: "", description: "" }));
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setError("");
    try {
      await deleteExpense(id);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  const isFutureDate = form.date > today;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Expenses</p>
        <h1 className="mt-1 text-3xl font-semibold text-gray-900">Log Expense</h1>
        <p className="mt-2 text-sm text-gray-500">
          Add a new expense or review past transactions by month.
        </p>
      </div>

      {/* Add expense form */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
        <h2 className="mb-5 text-base font-semibold text-gray-900">Add Expense</h2>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleAddExpense} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Amount */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Amount ($)</label>
              <input
                type="number"
                name="amount"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={handleFormChange}
                placeholder="0.00"
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Category */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Category</label>
              <select
                name="category"
                value={form.category}
                onChange={handleFormChange}
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Description */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Description{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                name="description"
                value={form.description}
                onChange={handleFormChange}
                placeholder="What was this for?"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Date */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleFormChange}
                max={today}
                required
                className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 ${
                  isFutureDate
                    ? "border-red-300 bg-red-50 text-red-700 focus:border-red-400 focus:ring-red-100"
                    : "border-gray-200 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-100"
                }`}
              />
              {dateError && (
                <p className="mt-1.5 text-xs font-medium text-red-600">{dateError}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || isFutureDate}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {saving ? "Adding…" : "Add Expense"}
          </button>
        </form>
      </section>

      {/* Transactions table */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-gray-900">Recent Transactions</h2>
          <div className="flex gap-3">
            <select
              value={period.month}
              onChange={(e) => setPeriod({ ...period, month: Number(e.target.value) })}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
            >
              {MONTHS_SHORT.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="2018"
              max="2030"
              value={period.year}
              onChange={(e) => setPeriod({ ...period, year: Number(e.target.value) })}
              className="w-24 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-3 py-3 font-medium">Amount</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium">Description</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="border-b border-gray-50 transition last:border-0 hover:bg-gray-50"
                >
                  <td className="px-3 py-4 font-semibold text-gray-900">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-3 py-4">
                    <span className="inline-flex items-center rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-gray-500">
                    {expense.description || "—"}
                  </td>
                  <td className="px-3 py-4 text-gray-500">
                    {formatDate(expense.date)}
                  </td>
                  <td className="px-3 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(expense.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && expenses.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-3 py-12 text-center text-gray-400">
                    No transactions logged for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
