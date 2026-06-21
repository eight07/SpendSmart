import { useEffect, useMemo, useState } from "react";
import { fetchCategories, fetchPrediction } from "../api";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getDefaultTarget() {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return {
    year: Math.min(Math.max(nextMonth.getFullYear(), 2018), 2030),
    month: nextMonth.getMonth() + 1,
  };
}

function shiftMonth(year, month, offset) {
  const date = new Date(year, month - 1 + offset, 1);
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    label: `${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
  };
}

function parseAmount(value) {
  if (value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function PredictionForm({ onResult, onLoading }) {
  const defaultTarget = getDefaultTarget();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    year: defaultTarget.year,
    month: defaultTarget.month,
    category: "",
    lastMonthSpend: "",
    twoMonthsAgoSpend: "",
    threeMonthsAgoSpend: "",
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCategories()
      .then((cats) => {
        setCategories(cats);
        setForm((f) => ({ ...f, category: cats[0] || "" }));
      })
      .catch(() =>
        setError("Could not load categories. Check that the backend is running.")
      );
  }, []);

  const recentMonths = useMemo(
    () => [
      shiftMonth(Number(form.year), Number(form.month), -1),
      shiftMonth(Number(form.year), Number(form.month), -2),
      shiftMonth(Number(form.year), Number(form.month), -3),
    ],
    [form.month, form.year]
  );

  const amounts = [
    parseAmount(form.lastMonthSpend),
    parseAmount(form.twoMonthsAgoSpend),
    parseAmount(form.threeMonthsAgoSpend),
  ];
  const hasAllAmounts = amounts.every((amount) => amount !== null);
  const rollingAverage = hasAllAmounts
    ? amounts.reduce((total, amount) => total + amount, 0) / amounts.length
    : null;
  const latestChange =
    amounts[0] !== null && amounts[1] !== null ? amounts[0] - amounts[1] : null;
  const trendLabel =
    latestChange === null || Math.abs(latestChange) < 0.01
      ? "No recent change yet"
      : latestChange > 0
        ? `${formatCurrency(latestChange)} higher than the month before`
        : `${formatCurrency(Math.abs(latestChange))} lower than the month before`;
  const isReady = Boolean(form.category) && hasAllAmounts;

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isReady) return;

    setError(null);
    onLoading(true);
    try {
      const payload = {
        year: Number(form.year),
        month: Number(form.month),
        category: form.category,
        prev_month_spend: amounts[0],
        prev_prev_month_spend: amounts[1],
        rolling_avg_3: Number(rollingAverage.toFixed(2)),
      };
      const result = await fetchPrediction(payload);
      onResult({
        ...result,
        inputs: {
          ...payload,
          three_months_ago_spend: amounts[2],
          recent_months: recentMonths,
          latest_change: latestChange,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      onLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Spending forecast
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">
          Plan the next month
        </h2>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={labelClass}>Category</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className={inputClass}
            required
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Forecast year</label>
            <input
              type="number"
              name="year"
              value={form.year}
              onChange={handleChange}
              min={2018}
              max={2030}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Forecast month</label>
            <select
              name="month"
              value={form.month}
              onChange={handleChange}
              className={inputClass}
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Recent spending
              </h3>
              <p className="text-xs text-slate-500">
                Enter the amount spent in this category for each month.
              </p>
            </div>
            <div className="hidden rounded-md bg-slate-100 px-3 py-2 text-right text-xs text-slate-600 sm:block">
              <span className="block font-semibold text-slate-900">
                {rollingAverage === null
                  ? "$0.00"
                  : formatCurrency(rollingAverage)}
              </span>
              3-month average
            </div>
          </div>

          {[
            ["lastMonthSpend", recentMonths[0].label],
            ["twoMonthsAgoSpend", recentMonths[1].label],
            ["threeMonthsAgoSpend", recentMonths[2].label],
          ].map(([name, label]) => (
            <div
              key={name}
              className="grid grid-cols-[minmax(0,1fr)_minmax(120px,160px)] items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <label htmlFor={name} className="text-sm font-medium text-slate-700">
                {label}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  $
                </span>
                <input
                  id={name}
                  type="number"
                  name={name}
                  value={form[name]}
                  onChange={handleChange}
                  placeholder="0.00"
                  min={0}
                  step="0.01"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-7 pr-3 text-right text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  required
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-medium text-emerald-700">
              Calculated average
            </p>
            <p className="mt-1 text-lg font-semibold text-emerald-950">
              {rollingAverage === null ? "$0.00" : formatCurrency(rollingAverage)}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-500">Recent trend</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {trendLabel}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={!isReady}
          className="w-full rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Predict my spend
        </button>
      </form>
    </section>
  );
}
