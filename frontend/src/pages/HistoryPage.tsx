import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Clock3, RefreshCw } from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api";

type PredictionHistoryItem = {
  id: number;
  machine: string;
  prediction: string;
  probability: number;
  risk_level: string;
  created_at: string | null;
};

function predictionTone(prediction: string): string {
  if (prediction === "NORMAL") return "status-badge status-normal";
  if (["WARNING", "HIGH_RISK"].includes(prediction)) return "status-badge status-warning";
  return "status-badge status-failure";
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

export default function HistoryPage() {
  const [items, setItems] = useState<PredictionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<PredictionHistoryItem[]>("/predictions");
      setItems(response.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Gagal memuat riwayat prediksi."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-7 md:space-y-9">
      <section className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Assessment records</p>
          <h1 className="page-title">Prediction history</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Review recorded model assessments, risk levels, and timestamps.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!loading && !error && (
            <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
              <Clock3 className="h-4 w-4 text-cyan-300" />
              {items.length} {items.length === 1 ? "record" : "records"}
            </span>
          )}
          <button type="button" onClick={() => void fetchHistory()} disabled={loading} className="button-secondary">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-500/25 bg-red-500/5 p-5 text-sm text-red-200">
          <p>{error}</p>
          <button type="button" onClick={() => void fetchHistory()} className="mt-3 font-semibold underline underline-offset-4">Try again</button>
        </div>
      ) : loading ? (
        <div role="status" className="glass-card space-y-3 overflow-hidden rounded-2xl p-5 sm:p-6">
          <span className="sr-only">Loading prediction history…</span>
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-white/[0.04]" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card rounded-2xl px-6 py-10 text-center sm:px-10 sm:py-14">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
            <Activity className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-white">No prediction history yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
            Run your first machine assessment to see the result, probability, and recommendation recorded here.
          </p>
          <Link to="/predict" className="button-primary mt-6">
            Run a prediction <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <section className="glass-card overflow-hidden rounded-2xl" aria-label="Prediction history">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
            <div>
              <h2 className="section-title">Recorded assessments</h2>
              <p className="mt-1 text-xs text-slate-500">Newest results appear first</p>
            </div>
            <Activity className="h-5 w-5 text-slate-500" aria-hidden="true" />
          </div>
          <div
            className="max-w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
            role="region"
            aria-label="Scrollable prediction history table"
            tabIndex={0}
          >
            <table className="w-full min-w-[680px] divide-y divide-white/[0.07] text-left text-sm text-slate-200">
              <thead className="bg-slate-950/40">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-medium text-slate-400 sm:px-6">Machine</th>
                  <th scope="col" className="px-5 py-3.5 font-medium text-slate-400">Prediction</th>
                  <th scope="col" className="px-5 py-3.5 font-medium text-slate-400">Probability</th>
                  <th scope="col" className="px-5 py-3.5 font-medium text-slate-400">Risk level</th>
                  <th scope="col" className="px-5 py-3.5 font-medium text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {items.map((item) => (
                  <tr key={item.id} className="transition hover:bg-white/[0.025]">
                    <td className="max-w-64 px-5 py-4 font-medium text-white sm:px-6">
                      <span className="block truncate">{item.machine}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={predictionTone(item.prediction)}>{item.prediction}</span>
                    </td>
                    <td className="px-5 py-4 font-medium tabular-nums text-slate-200">{(item.probability * 100).toFixed(1)}%</td>
                    <td className="px-5 py-4 text-slate-300">{item.risk_level}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-400">{formatTimestamp(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-white/[0.06] px-5 py-3 text-xs text-slate-500 sm:px-6">
            On smaller screens, scroll within the table to view all columns.
          </p>
        </section>
      )}
    </div>
  );
}
