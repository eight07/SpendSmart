import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { fetchModelComparison } from "../api";

// ─── Pastel color per model ──────────────────────────────────────────────────
const MODEL_COLORS = {
  RandomForestLog: "#93c5fd",  // blue-300   — best (slightly saturated)
  Ridge: "#c4b5fd",            // violet-300
  LinearRegression: "#f9a8d4", // pink-300
  Lasso: "#fde68a",            // amber-200
  RandomForest: "#6ee7b7",     // emerald-300
  XGBoost: "#fca5a5",          // red-300
};

// Fallback palette for unexpected model names (also pastel)
const FALLBACK_PALETTE = [
  "#7dd3fc", "#86efac", "#d8b4fe", "#fdba74", "#67e8f9",
];

function getModelColor(modelName, index) {
  return MODEL_COLORS[modelName] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

// Custom tick for Y-axis — wraps long names cleanly
function CustomYTick({ x, y, payload, bestModel }) {
  const isBest = payload.value === bestModel;
  return (
    <text
      x={x - 6}
      y={y}
      dy={4}
      textAnchor="end"
      fill={isBest ? "#2563eb" : "#64748b"}
      fontWeight={isBest ? 700 : 400}
      fontSize={11}
    >
      {payload.value}
    </text>
  );
}

export default function ModelComparison() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchModelComparison()
      .then(setData)
      .catch(() => setError("Could not load model comparison."));
  }, []);

  if (error)
    return (
      <section className="rounded-2xl border border-red-200 bg-white p-5 text-sm text-red-600 shadow-sm">
        {error}
      </section>
    );

  if (!data)
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-400 shadow-sm">
        Loading model comparison…
      </section>
    );

  const sorted = [...data.models].sort((a, b) => a.mae - b.mae);
  const best = sorted.find((m) => m.model === data.best_model) ?? sorted[0];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
      {/* ── Section header ── */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          Forecast quality
        </p>
        <h2 className="mt-1 text-lg font-semibold text-gray-900">
          Model Comparison — How we chose RandomForestLog
        </h2>
      </div>

      {/* ── Chart with best-model badge overlaid ── */}
      <div className="relative">
        {/* 🏆 Top-right corner badge */}
        <div className="absolute right-0 top-0 z-10 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 shadow-sm">
          <span className="text-sm leading-none">🏆</span>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">
              Best Model
            </p>
            <p className="text-sm font-bold leading-tight text-blue-800">
              RandomForestLog
            </p>
            <p className="text-[11px] font-medium text-blue-600">
              MAE&nbsp;{formatCurrency(best.mae)}
            </p>
          </div>
        </div>

        {/* Bar chart */}
        <ResponsiveContainer width="100%" height={230}>
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 8, right: 110, left: 8, bottom: 38 }}
          >
            {/* Subtle vertical grid lines only */}
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f1f5f9"
              horizontal={false}
            />

            {/* X-axis — values (MAE in $) with axis label at bottom */}
            <XAxis
              type="number"
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickFormatter={(v) => `$${v}`}
              label={{
                value: "MAE — Mean Absolute Error ($)",
                position: "insideBottomLeft",
                offset: -28,
                dx: 8,
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />

            {/* Y-axis — model names with "Model" axis label */}
            <YAxis
              dataKey="model"
              type="category"
              axisLine={false}
              tickLine={false}
              width={138}
              tick={(props) => (
                <CustomYTick {...props} bestModel={data.best_model} />
              )}
              label={{
                value: "Model",
                angle: -90,
                position: "insideLeft",
                dx: -2,
                dy: 22,
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />

            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.08)" }}
              formatter={(v, name, props) => [
                formatCurrency(v),
                `MAE — ${props.payload.model}`,
              ]}
              contentStyle={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                fontSize: 12,
              }}
            />

            {/* Thin bars (barSize=16) with per-model colours + right-side labels */}
            <Bar dataKey="mae" radius={[0, 6, 6, 0]} barSize={16}>
              {sorted.map((m, i) => (
                <Cell key={m.model} fill={getModelColor(m.model, i)} />
              ))}

              {/* Bar value labels — right of each bar */}
              <LabelList
                dataKey="mae"
                position="right"
                formatter={(v) => `$${Number(v).toFixed(2)}`}
                style={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Comparison table ── */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400">
              <th className="pb-2 font-medium">Model</th>
              <th className="pb-2 text-right font-medium">MAE ($)</th>
              <th className="pb-2 text-right font-medium">RMSE ($)</th>
              <th className="pb-2 text-right font-medium">R²</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, i) => {
              const isBest = m.model === data.best_model;
              const color = getModelColor(m.model, i);
              return (
                <tr
                  key={m.model}
                  className={`border-b last:border-0 ${
                    isBest ? "bg-blue-50 font-semibold" : ""
                  }`}
                >
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {/* Colour swatch */}
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: color }}
                      />
                      <span
                        className={isBest ? "text-blue-700" : "text-gray-800"}
                      >
                        {m.model}
                      </span>
                      {isBest && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          Best
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className={`py-2 text-right ${
                      isBest ? "text-blue-700" : "text-gray-600"
                    }`}
                  >
                    {formatCurrency(m.mae)}
                  </td>
                  <td
                    className={`py-2 text-right ${
                      isBest ? "text-blue-700" : "text-gray-600"
                    }`}
                  >
                    {formatCurrency(m.rmse)}
                  </td>
                  <td
                    className={`py-2 text-right ${
                      isBest ? "text-blue-700" : "text-gray-600"
                    }`}
                  >
                    {(m.r2 * 100).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
