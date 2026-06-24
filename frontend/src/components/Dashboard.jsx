import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchCategories,
  fetchCategoryHistory,
  fetchExpenses,
  fetchExpenseSummary,
} from "../api";
import { useAuth } from "../context/auth";
import LogExpensePage from "./LogExpensePage";
import PredictPage from "./PredictPage";
import SettingsPage from "./SettingsPage";

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const NAV_ITEMS = [
  { label: "Dashboard",   page: "dashboard",  icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { label: "Log Expense", page: "log",         icon: "M12 4v16m8-8H4" },
  { label: "Predict",     page: "predict",     icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { label: "Settings",    page: "settings",    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

// ─── Helper functions ─────────────────────────────────────────────────────────

function getInitialPeriod() {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

function previousPeriod(year, month) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function getInitials(value = "User") {
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function sumCategories(rows) {
  return rows.reduce((total, row) => total + Number(row.total || 0), 0);
}

function getChangeText(current, previous) {
  if (!previous && !current) return "0% change";
  if (!previous) return "New spend";
  const percent = ((current - previous) / previous) * 100;
  return `${Math.abs(percent).toFixed(1)}% ${percent >= 0 ? "more" : "less"}`;
}

function getInsightText(current, previous) {
  if (!previous && !current) return "the same as last month";
  if (!previous) return "new spending compared with last month";
  const percent = ((current - previous) / previous) * 100;
  if (Math.abs(percent) < 0.1) return "about the same as last month";
  return `${Math.abs(percent).toFixed(1)}% ${percent >= 0 ? "more" : "less"} than last month`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, subtext }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-2 text-xs text-gray-400">{subtext}</p>
    </div>
  );
}

function NavIcon({ path }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className="h-5 w-5 shrink-0"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { logout, user: authUser } = useAuth();
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [period, setPeriod] = useState(getInitialPeriod());
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState([]);
  const [previousSummary, setPreviousSummary] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryHistory, setCategoryHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Derived values
  const totalThisMonth = useMemo(() => sumCategories(summary), [summary]);
  const totalLastMonth = useMemo(() => sumCategories(previousSummary), [previousSummary]);
  const biggestCategory = summary[0] || { category: "No category", total: 0 };
  const selectedCurrent =
    summary.find((r) => r.category === selectedCategory)?.total || 0;
  const selectedPrevious =
    previousSummary.find((r) => r.category === selectedCategory)?.total || 0;
  const insightText = getInsightText(selectedCurrent, selectedPrevious);

  // ─── Data loading ─────────────────────────────────────────────────────────

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const prev = previousPeriod(period.year, period.month);
      const monthlyRequests = MONTHS.map((_, index) =>
        fetchExpenseSummary(period.year, index + 1)
          .then((rows) => ({ month: MONTHS[index], total: sumCategories(rows) }))
          .catch(() => ({ month: MONTHS[index], total: 0 }))
      );

      const [categoryList, summaryRows, previousRows, expenseRows, monthlyRows] =
        await Promise.all([
          fetchCategories(),
          fetchExpenseSummary(period.year, period.month),
          fetchExpenseSummary(prev.year, prev.month),
          fetchExpenses(period.year, period.month),
          Promise.all(monthlyRequests),
        ]);

      setCategories(categoryList);
      setSummary(summaryRows);
      setPreviousSummary(previousRows);
      setExpenses([...expenseRows].sort((a, b) => new Date(b.date) - new Date(a.date)));
      setMonthlyData(monthlyRows);

      const nextCategory =
        selectedCategory || summaryRows[0]?.category || categoryList[0] || "";
      setSelectedCategory(nextCategory);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const run = async () => {
      await Promise.resolve();
      await loadDashboard();
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.year, period.month]);

  useEffect(() => {
    if (!selectedCategory) return;
    fetchCategoryHistory(selectedCategory, 12)
      .then((rows) =>
        setCategoryHistory(
          rows.map((row) => ({
            name: `${MONTHS[row.month - 1]} ${String(row.year).slice(-2)}`,
            total: row.total,
          }))
        )
      )
      .catch(() => setCategoryHistory([]));
  }, [selectedCategory]);

  // ─── Dashboard page content ───────────────────────────────────────────────

  function renderDashboardContent() {
    return (
      <div className="space-y-6">
        {/* Page title + period selector */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              Dashboard
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-gray-900">Spending overview</h1>
            <p className="mt-2 text-sm text-gray-500">
              Track expenses, spot category trends, and keep this month under control.
            </p>
          </div>
          <div className="flex gap-3">
            <select
              value={period.month}
              onChange={(e) => setPeriod({ ...period, month: Number(e.target.value) })}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="2018"
              max="2030"
              value={period.year}
              onChange={(e) => setPeriod({ ...period, year: Number(e.target.value) })}
              className="w-24 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          {/* Left column */}
          <div className="space-y-6">
            {/* Summary cards */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Total this month"
                value={formatCurrency(totalThisMonth)}
                subtext={`${MONTHS[period.month - 1]} ${period.year}`}
              />
              <SummaryCard
                label="Biggest category"
                value={biggestCategory.category}
                subtext={formatCurrency(biggestCategory.total)}
              />
              <SummaryCard
                label="Transactions count"
                value={expenses.length}
                subtext="Logged expenses"
              />
              <SummaryCard
                label="vs last month"
                value={getChangeText(totalThisMonth, totalLastMonth)}
                subtext={`${formatCurrency(totalLastMonth)} last month`}
              />
            </section>

            {/* Monthly bar chart */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-gray-900">
                  Monthly Spending Overview
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Total expense volume across all categories.
                </p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(56,189,248,0.08)" }}
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      color: "#1e293b",
                    }}
                    formatter={(value) => [formatCurrency(value), "Spent"]}
                  />
                  <Bar dataKey="total" fill="#38bdf8" radius={[8, 8, 3, 3]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          {/* Right panel */}
          <aside className="hidden space-y-5 xl:block">
            {/* Category trend card */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow">
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500">Selected category</p>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl bg-blue-50 px-4 py-3">
                <p className="text-2xl font-semibold text-blue-700">
                  {formatCurrency(selectedCurrent)}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-blue-600">
                  This month you spent{" "}
                  <span className="font-semibold">{formatCurrency(selectedCurrent)}</span>{" "}
                  on {selectedCategory || "this category"} — {insightText}.
                </p>
              </div>

              {/* Line chart — 160px */}
              <div className="mt-4 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={categoryHistory}>
                    <CartesianGrid stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        color: "#1e293b",
                      }}
                      formatter={(value) => [formatCurrency(value), selectedCategory]}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#2563eb" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Category breakdown */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow">
              <h3 className="text-sm font-semibold text-gray-900">Category breakdown</h3>
              <div className="mt-4 space-y-2">
                {summary.slice(0, 5).map((row) => (
                  <button
                    key={row.category}
                    type="button"
                    onClick={() => setSelectedCategory(row.category)}
                    className="flex w-full items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-left transition hover:bg-blue-50"
                  >
                    <span className="text-sm text-gray-700">{row.category}</span>
                    <span className="text-sm font-semibold text-blue-600">
                      {formatCurrency(row.total)}
                    </span>
                  </button>
                ))}
                {summary.length === 0 && !loading && (
                  <p className="py-4 text-center text-sm text-gray-400">
                    No data for this period.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    );
  }

  // ─── Page switcher ────────────────────────────────────────────────────────

  function renderContent() {
    switch (currentPage) {
      case "log":
        return <LogExpensePage />;
      case "predict":
        return <PredictPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return renderDashboardContent();
    }
  }

  // ─── Shell layout ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top header bar ── */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white">
            SS
          </div>
          <div>
            <span className="text-base font-bold text-gray-900">SpendSmart</span>
            <span className="ml-2 hidden text-xs text-gray-400 sm:inline">
              Personal Finance
            </span>
          </div>
        </div>

        {/* Right: email + logout */}
        <div className="flex items-center gap-3">
          <span className="hidden max-w-[200px] truncate text-sm text-gray-500 sm:block">
            {authUser?.email}
          </span>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-1.08a.75.75 0 10-1.04-1.08l-2.5 2.574a.75.75 0 000 1.072l2.5 2.574a.75.75 0 101.04-1.08L8.704 10.75H18.25A.75.75 0 0019 10z"
                clipRule="evenodd"
              />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* ── Below header ── */}
      <div className="flex pt-16">
        {/* ── Sidebar ── */}
        <aside className="fixed bottom-0 left-0 top-16 hidden w-64 flex-col border-r border-gray-200 bg-white p-4 lg:flex">
          <nav className="mt-2 space-y-1">
            {NAV_ITEMS.map(({ label, page, icon }) => {
              const isActive = currentPage === page;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                    isActive
                      ? "border-l-4 border-blue-600 bg-blue-50 pl-3 text-blue-600"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <NavIcon path={icon} />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* User avatar at bottom */}
          <div className="mt-auto rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {getInitials(authUser?.email)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {authUser?.email?.split("@")[0] || "Guest"}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {authUser?.email || "Sign in required"}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:ml-64 lg:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
