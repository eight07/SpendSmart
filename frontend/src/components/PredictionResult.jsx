import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function PredictionResult({ result, history }) {
  if (!result) return null;

  const recentAverage = result.inputs?.rolling_avg_3 ?? null;
  const differenceFromAverage =
    recentAverage === null ? null : result.predicted_spend - recentAverage;
  const differenceText =
    differenceFromAverage === null || Math.abs(differenceFromAverage) < 0.01
      ? "in line with recent spending"
      : differenceFromAverage > 0
        ? `${formatCurrency(differenceFromAverage)} above your recent average`
        : `${formatCurrency(Math.abs(differenceFromAverage))} below your recent average`;
  const suggestedBudget = Math.ceil(result.predicted_spend / 10) * 10;

  const chartData = history.slice(-6).map((r) => ({
    name: `${MONTH_NAMES[r.month]} ${r.year}`,
    predicted: r.predicted_spend,
    category: r.category,
  }));

  return (
    <div className="space-y-4">
      {/* Main result card */}
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          Forecast for {MONTH_NAMES[result.month]} {result.year}
        </p>
        <p className="mt-2 text-4xl font-bold text-blue-900">
          {formatCurrency(result.predicted_spend)}
        </p>
        <p className="mt-2 text-sm font-medium text-blue-700">
          {result.category} is expected to be {differenceText}.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white px-4 py-3 shadow">
            <p className="text-xs font-medium text-gray-500">Set aside</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatCurrency(suggestedBudget)}
            </p>
          </div>
          <div className="rounded-xl bg-white px-4 py-3 shadow">
            <p className="text-xs font-medium text-gray-500">Recent average</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {recentAverage === null ? "Not available" : formatCurrency(recentAverage)}
            </p>
          </div>
          <div className="rounded-xl bg-white px-4 py-3 shadow">
            <p className="text-xs font-medium text-gray-500">Model</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{result.model_used}</p>
          </div>
        </div>
      </section>

      {/* Recent forecasts chart */}
      {chartData.length > 1 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Recent forecasts</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                formatter={(v, _, props) => [formatCurrency(v), props.payload.category]}
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                }}
              />
              <Bar dataKey="predicted" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === chartData.length - 1 ? "#2563eb" : "#bfdbfe"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  );
}
