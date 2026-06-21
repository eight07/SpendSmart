import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const MONTH_NAMES = [
  "","Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
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
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Forecast for {MONTH_NAMES[result.month]} {result.year}
        </p>
        <p className="mt-2 text-4xl font-bold text-emerald-950">
          {formatCurrency(result.predicted_spend)}
        </p>
        <p className="mt-2 text-sm font-medium text-emerald-800">
          {result.category} is expected to be {differenceText}.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-500">Set aside</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              {formatCurrency(suggestedBudget)}
            </p>
          </div>
          <div className="rounded-md bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-500">Recent average</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              {recentAverage === null ? "Not available" : formatCurrency(recentAverage)}
            </p>
          </div>
          <div className="rounded-md bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-500">Model</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              {result.model_used}
            </p>
          </div>
        </div>
      </section>

      {chartData.length > 1 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">
            Recent forecasts
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                formatter={(v, _, props) => [
                  formatCurrency(v),
                  props.payload.category,
                ]}
              />
              <Bar dataKey="predicted" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === chartData.length - 1 ? "#059669" : "#a7f3d0"}
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
