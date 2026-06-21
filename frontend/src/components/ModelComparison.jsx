import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { fetchModelComparison } from "../api";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
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
      <section className="rounded-lg border border-red-200 bg-white p-5 text-sm text-red-600 shadow-sm">
        {error}
      </section>
    );

  if (!data)
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Loading model health...
      </section>
    );

  const sorted = [...data.models].sort((a, b) => a.mae - b.mae);
  const best = sorted.find((model) => model.model === data.best_model) ?? sorted[0];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Forecast quality
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            Best model: {data.best_model}
          </h2>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-medium text-emerald-700">
            Typical miss by about
          </p>
          <p className="mt-1 text-lg font-semibold text-emerald-950">
            {formatCurrency(best.mae)}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={sorted} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `$${v}`}
          />
          <YAxis
            dataKey="model"
            type="category"
            tick={{ fontSize: 11 }}
            width={120}
          />
          <Tooltip formatter={(v) => [formatCurrency(v), "Typical error"]} />
          <Bar dataKey="mae" radius={[0, 4, 4, 0]}>
            {sorted.map((m, i) => (
              <Cell
                key={i}
                fill={m.model === data.best_model ? "#059669" : "#cbd5e1"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="pb-2 font-medium">Model</th>
              <th className="pb-2 font-medium text-right">Typical error</th>
              <th className="pb-2 font-medium text-right">Large-error check</th>
              <th className="pb-2 font-medium text-right">Fit score</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr
                key={m.model}
                className={`border-b last:border-0 ${
                  m.model === data.best_model
                    ? "bg-emerald-50 font-semibold"
                    : ""
                }`}
              >
                <td className="py-2 text-slate-800">{m.model}</td>
                <td className="py-2 text-right text-slate-600">
                  {formatCurrency(m.mae)}
                </td>
                <td className="py-2 text-right text-slate-600">
                  {formatCurrency(m.rmse)}
                </td>
                <td className="py-2 text-right text-slate-600">
                  {(m.r2 * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
