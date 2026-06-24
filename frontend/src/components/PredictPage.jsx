import { useState } from "react";
import PredictionForm from "./PredictionForm";
import PredictionResult from "./PredictionResult";
import ModelComparison from "./ModelComparison";

export default function PredictPage() {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);

  function handleResult(newResult) {
    setResult(newResult);
    setHistory((prev) => [...prev, newResult].slice(-10));
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">ML Forecast</p>
        <h1 className="mt-1 text-3xl font-semibold text-gray-900">Predict Spending</h1>
        <p className="mt-2 text-sm text-gray-500">
          Use your expense history to forecast next month's spending with our trained ML model.
        </p>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-600">
          Running prediction…
        </div>
      )}

      {/* Prediction form */}
      <PredictionForm onResult={handleResult} onLoading={setIsLoading} />

      {/* Prediction result */}
      {result && <PredictionResult result={result} history={history} />}

      {/* Model comparison */}
      <ModelComparison />
    </div>
  );
}
