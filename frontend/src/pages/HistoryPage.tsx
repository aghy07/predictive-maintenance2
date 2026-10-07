import { useCallback, useEffect, useState } from "react";
import { Activity, Clock3 } from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api";

type PredictionHistoryItem = {
  id: number;
  machine: string;
  prediction: string;
  probability: number;
  risk_level: string;
  created_at: string;
};

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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">Records</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Prediction history</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
          <Clock3 className="h-4 w-4 text-cyan-300" />
          {items.length} entries
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          <p>{error}</p>
          <button type="button" onClick={() => void fetchHistory()} className="mt-3 font-semibold underline">Coba lagi</button>
        </div>
      )}

      <div className="glass-card overflow-hidden rounded-3xl">
        {loading ? (
          <p role="status" className="px-6 py-10 text-center text-slate-400">Memuat riwayat prediksi…</p>
        ) : !error && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-6 py-10 text-slate-400">
            <Activity className="h-4 w-4" />
            Belum ada riwayat prediksi.
          </div>
        ) : !error ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
              <thead className="bg-slate-900/80">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-300">Machine</th>
                  <th className="px-4 py-3 font-medium text-slate-300">Prediction</th>
                  <th className="px-4 py-3 font-medium text-slate-300">Probability</th>
                  <th className="px-4 py-3 font-medium text-slate-300">Risk level</th>
                  <th className="px-4 py-3 font-medium text-slate-300">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {items.map((item) => (
                  <tr key={item.id} className="bg-slate-950/20 transition hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-white">{item.machine}</td>
                    <td className="px-4 py-3">
                      <span className={`status-badge ${item.prediction === "NORMAL" ? "status-normal" : ["WARNING", "HIGH_RISK"].includes(item.prediction) ? "status-warning" : "status-failure"}`}>
                        {item.prediction}
                      </span>
                    </td>
                    <td className="px-4 py-3">{(item.probability * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3">{item.risk_level}</td>
                    <td className="px-4 py-3 text-slate-300">{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
