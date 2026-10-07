import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Factory, ShieldCheck, TrendingUp } from "lucide-react";
import { BarChart, Bar, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { getApiErrorMessage } from "../lib/api";

type DashboardStats = {
  total_machines: number;
  total_predictions: number;
  normal_machines: number;
  at_risk_machines: number;
  failure_machines: number;
  machines_without_predictions: number;
};

const chartColors = ["#34d399", "#fbbf24", "#f87171", "#94a3b8"];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<DashboardStats>("/predictions/dashboard");
      setStats(response.data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(getApiErrorMessage(err, "Gagal memuat ringkasan dashboard."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const chartData = stats ? [
    { name: "Normal", value: stats.normal_machines },
    { name: "At risk", value: stats.at_risk_machines },
    { name: "Failure", value: stats.failure_machines },
    { name: "No prediction", value: stats.machines_without_predictions },
  ] : [];

  const cards = stats ? [
    { label: "Total machines", value: stats.total_machines, icon: Factory, accent: "emerald" },
    { label: "Total predictions", value: stats.total_predictions, icon: TrendingUp, accent: "cyan" },
    { label: "Normal (latest)", value: stats.normal_machines, icon: ShieldCheck, accent: "green" },
    { label: "Failures (latest)", value: stats.failure_machines, icon: AlertTriangle, accent: "amber" },
  ] : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Overview</p>
          <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">Maintenance dashboard</h1>
          <p className="mt-2 text-sm text-slate-400">Status mesin memakai prediksi terbaru untuk tiap mesin.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="text-sm text-slate-400">Diperbarui {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button type="button" onClick={() => void fetchDashboard()} disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50">
            {loading ? "Memuat…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
          <p>{error}</p>
          <button type="button" onClick={() => void fetchDashboard()} className="mt-3 font-semibold underline">Coba lagi</button>
        </div>
      ) : loading && !stats ? (
        <p role="status" className="py-12 text-center text-slate-400">Memuat ringkasan mesin…</p>
      ) : stats && stats.total_machines === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center">
          <Factory className="mx-auto h-8 w-8 text-slate-500" />
          <h2 className="mt-4 text-lg font-semibold text-white">Belum ada mesin</h2>
          <p className="mt-2 text-sm text-slate-400">Tambahkan mesin terlebih dahulu agar ringkasan kondisi dapat ditampilkan.</p>
        </div>
      ) : stats ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ label, value, icon: Icon, accent }) => (
              <div key={label} className="glass-card metric-glow rounded-3xl p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-sm text-slate-400">{label}</span>
                  <div className={`rounded-2xl p-2 ${accent === "emerald" ? "bg-emerald-500/10 text-emerald-300" : accent === "cyan" ? "bg-cyan-500/10 text-cyan-300" : accent === "green" ? "bg-green-500/10 text-green-300" : "bg-amber-500/10 text-amber-300"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.5fr_0.5fr]">
            <div className="glass-card rounded-3xl p-6">
              <div className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
                <Activity className="h-5 w-5 text-emerald-400" />
                Latest machine risk distribution
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <BarChart data={chartData} barSize={38}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                    <XAxis dataKey="name" stroke="#cbd5e1" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} stroke="#cbd5e1" tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} contentStyle={{ background: "rgba(15, 23, 42, 0.96)", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 12 }} />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {chartData.map((entry, index) => <Cell key={entry.name} fill={chartColors[index]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {stats.total_predictions === 0 && <p className="text-center text-sm text-slate-400">Belum ada prediksi tersimpan untuk mesin-mesin ini.</p>}
            </div>

            <div className="glass-card rounded-3xl p-6">
              <div className="mb-5 text-lg font-semibold text-white">Latest status per machine</div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-center justify-between"><span className="text-sm text-slate-300">Normal</span><span className="status-badge status-normal">{stats.normal_machines}</span></div>
                </div>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="flex items-center justify-between"><span className="text-sm text-slate-300">At risk</span><span className="status-badge status-warning">{stats.at_risk_machines}</span></div>
                </div>
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                  <div className="flex items-center justify-between"><span className="text-sm text-slate-300">Failure</span><span className="status-badge status-failure">{stats.failure_machines}</span></div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between"><span className="text-sm text-slate-300">No prediction</span><span className="text-sm font-semibold text-slate-200">{stats.machines_without_predictions}</span></div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
