import { useState } from "react";
import Header from "./components/Header";
import PredictionForm from "./components/PredictionForm";
import PredictionResult from "./components/PredictionResult";
import ModelComparison from "./components/ModelComparison";

export default function App() {
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  function handleResult(res) {
    setResult(res);
    setHistory((prev) => [...prev, res]);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Header />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <PredictionForm onResult={handleResult} onLoading={setLoading} />

          <div>
            {loading && (
              <div className="flex min-h-80 items-center justify-center rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <p className="animate-pulse text-sm font-medium text-emerald-700">
                  Preparing your forecast...
                </p>
              </div>
            )}
            {!loading && result && (
              <PredictionResult result={result} history={history} />
            )}
            {!loading && !result && (
              <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Your forecast will appear here
                  </p>
                  <p className="mt-2 max-w-sm text-sm text-slate-500">
                    Pick a category, enter the last three monthly amounts, and
                    SpendSmart will calculate the rest.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <ModelComparison />
      </main>

      <footer className="py-6 text-center text-xs text-slate-400">
        SpendSmart personal spending forecast
      </footer>
    </div>
  );
}
