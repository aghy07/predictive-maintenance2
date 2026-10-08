import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock3,
  Cpu,
  Factory,
  Gauge,
  MapPin,
  Plus,
  ShieldCheck,
  ThermometerSun,
  TrendingUp,
  Waves,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api, { getApiErrorMessage } from "../lib/api";

type DashboardStats = {
  total_machines: number;
  total_predictions: number;
  normal_machines: number;
  at_risk_machines: number;
  failure_machines: number;
  machines_without_predictions: number;
};

type Machine = {
  id: number;
  machine_code: string;
  machine_name: string;
  location: string;
  temperature_c: number;
  vibration_mm_s: number;
  status: string;
  created_at: string | null;
};

type Prediction = {
  id: number;
  machine: string;
  prediction: string;
  probability: number;
  risk_level: string;
  created_at: string | null;
};

type DashboardData = {
  stats: DashboardStats;
  machines: Machine[];
  predictions: Prediction[];
};

const chartColors = ["#34d399", "#fbbf24", "#f87171", "#64748b"];

function formatTimestamp(value: string | null): string {
  if (!value) return "Waktu tidak tersedia";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Waktu tidak tersedia" : date.toLocaleString();
}

function machineStatusTone(status: string): string {
  if (status.toLowerCase() === "healthy") return "status-badge status-normal";
  if (status.toLowerCase() === "offline") return "status-badge status-failure";
  if (status.toLowerCase() === "maintenance") return "status-badge status-warning";
  return "status-badge border border-white/10 bg-white/5 text-slate-300";
}

function machineStatusIndicator(status: string): string {
  if (status.toLowerCase() === "healthy") return "bg-emerald-400";
  if (status.toLowerCase() === "offline") return "bg-red-400";
  if (status.toLowerCase() === "maintenance") return "bg-amber-400";
  return "bg-slate-400";
}

function predictionTone(prediction: string): string {
  if (prediction === "NORMAL") return "status-badge status-normal";
  if (["WARNING", "HIGH_RISK"].includes(prediction)) return "status-badge status-warning";
  return "status-badge status-failure";
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsResponse, machinesResponse, predictionsResponse] = await Promise.all([
        api.get<DashboardStats>("/predictions/dashboard"),
        api.get<Machine[]>("/machines"),
        api.get<Prediction[]>("/predictions"),
      ]);
      setData({
        stats: statsResponse.data,
        machines: machinesResponse.data.slice(0, 4),
        predictions: predictionsResponse.data.slice(0, 5),
      });
      setLastUpdated(new Date());
    } catch (err) {
      setError(getApiErrorMessage(err, "Gagal memuat data monitoring."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const stats = data?.stats;
  const chartData = stats ? [
    { name: "Healthy", value: stats.normal_machines },
    { name: "At risk", value: stats.at_risk_machines },
    { name: "Failure", value: stats.failure_machines },
    { name: "No prediction", value: stats.machines_without_predictions },
  ] : [];
  const cards = stats ? [
    { label: "Total machines", value: stats.total_machines, icon: Factory, tone: "text-cyan-300", detail: "Registered assets" },
    { label: "Healthy", value: stats.normal_machines, icon: ShieldCheck, tone: "text-emerald-300", detail: "Latest prediction" },
    { label: "At risk", value: stats.at_risk_machines, icon: AlertTriangle, tone: "text-amber-300", detail: "Needs attention" },
    { label: "Failure", value: stats.failure_machines, icon: Activity, tone: "text-red-300", detail: "Latest prediction" },
    { label: "Predictions", value: stats.total_predictions, icon: TrendingUp, tone: "text-sky-300", detail: "All recorded results" },
  ] : [];

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-7 md:space-y-9">
      <section className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Industrial monitoring</p>
          <h1 className="page-title">Maintenance overview</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Monitor machine conditions and detect early failure risks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && (
            <span className="flex items-center gap-2 text-xs text-slate-400" title={lastUpdated.toLocaleString()}>
              <Clock3 className="h-4 w-4 text-slate-500" />
              Refreshed {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button type="button" onClick={() => void fetchDashboard()} disabled={loading} className="button-secondary">
            <Activity className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </section>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-500/25 bg-red-500/5 p-5 text-sm text-red-200">
          <p>{error}</p>
          <button type="button" onClick={() => void fetchDashboard()} className="mt-3 font-semibold underline underline-offset-4">
            Try again
          </button>
        </div>
      ) : loading && !data ? (
        <div role="status" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="glass-card h-32 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      ) : stats ? (
        <>
          <section aria-label="Maintenance key metrics" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map(({ label, value, icon: Icon, tone, detail }) => (
              <article key={label} className="glass-card rounded-2xl p-4 transition duration-200 hover:-translate-y-0.5 hover:border-white/20 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-400">{label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-white tabular-nums">{value}</p>
                  </div>
                  <div className={`rounded-xl border border-white/10 bg-white/[0.03] p-2.5 ${tone}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">{detail}</p>
              </article>
            ))}
          </section>

          {stats.total_machines === 0 ? (
            <section className="glass-card rounded-3xl px-6 py-10 text-center sm:px-10 sm:py-14">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                <Factory className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-white">No machines registered yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                Ask an administrator to add equipment before machine monitoring and sensor-based predictions can begin.
              </p>
              <Link to="/machines" className="button-primary mt-6">
                <Factory className="h-4 w-4" />
                Open machine registry
              </Link>
            </section>
          ) : (
            <>
              <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
                <div className="glass-card min-w-0 rounded-2xl p-5 sm:p-6">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="section-title">Risk overview</h2>
                      <p className="mt-1 text-sm text-slate-400">Latest prediction for each active machine</p>
                    </div>
                    <span className="text-xs text-slate-500">{stats.total_machines} machines</span>
                  </div>
                  {stats.total_predictions === 0 ? (
                    <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center">
                      <Gauge className="h-8 w-8 text-slate-500" aria-hidden="true" />
                      <p className="mt-3 font-medium text-slate-200">No predictions to summarize</p>
                      <p className="mt-1 text-sm text-slate-400">Run a prediction to see the machine risk distribution.</p>
                      <Link to="/predict" className="button-secondary mt-4">Run prediction <ArrowRight className="h-4 w-4" /></Link>
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 h-64 w-full min-w-0 sm:h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} />
                            <YAxis allowDecimals={false} stroke="#94a3b8" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                            <Tooltip
                              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
                              contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12 }}
                            />
                            <Bar dataKey="value" name="Machines" radius={[6, 6, 0, 0]} maxBarSize={52}>
                              {chartData.map((entry, index) => <Cell key={entry.name} fill={chartColors[index]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-4">
                        {chartData.map((entry, index) => (
                          <span key={entry.name} className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColors[index] }} />
                            {entry.name} <strong className="font-semibold text-slate-200">{entry.value}</strong>
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="glass-card rounded-2xl p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="section-title">Machine status</h2>
                      <p className="mt-1 text-sm text-slate-400">Current registered equipment</p>
                    </div>
                    <Link to="/machines" aria-label="View all machines" className="icon-link">
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="mt-5 divide-y divide-white/[0.07]">
                    {data?.machines.map((machine) => (
                      <article key={machine.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="mt-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-cyan-300">
                            <Cpu className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3 className="truncate font-medium text-white">{machine.machine_name}</h3>
                              <span className={machineStatusTone(machine.status)}>
                                <span className={`h-1.5 w-1.5 rounded-full ${machineStatusIndicator(machine.status)}`} />
                                {machine.status}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs text-slate-500">{machine.machine_code}</p>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
                              <span className="flex min-w-0 items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" /><span className="truncate">{machine.location}</span></span>
                              <span className="flex items-center gap-1.5"><ThermometerSun className="h-3.5 w-3.5 text-amber-300" />{machine.temperature_c}°C</span>
                              <span className="flex items-center gap-1.5"><Waves className="h-3.5 w-3.5 text-sky-300" />{machine.vibration_mm_s} mm/s</span>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  <Link to="/machines" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 transition hover:text-emerald-200">
                    View all machines <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </section>

              <section className="glass-card overflow-hidden rounded-2xl">
                <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <h2 className="section-title">Recent predictions</h2>
                    <p className="mt-1 text-sm text-slate-400">Most recently recorded assessment results</p>
                  </div>
                  <Link to="/history" className="button-secondary self-start sm:self-auto">
                    View history <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                {data?.predictions.length ? (
                  <div className="divide-y divide-white/[0.07]">
                    {data.predictions.map((prediction) => (
                      <article key={prediction.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-slate-300">
                            <Activity className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">{prediction.machine}</p>
                            <p className="mt-1 text-xs text-slate-500">{formatTimestamp(prediction.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 pl-11 sm:pl-0">
                          <span className={predictionTone(prediction.prediction)}>{prediction.risk_level}</span>
                          <span className="text-sm font-semibold tabular-nums text-slate-200">{(prediction.probability * 100).toFixed(1)}%</span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center px-5 py-10 text-center">
                    <Activity className="h-8 w-8 text-slate-500" aria-hidden="true" />
                    <h3 className="mt-3 font-medium text-slate-200">No prediction history yet</h3>
                    <p className="mt-1 text-sm text-slate-400">Run your first prediction to see the result here.</p>
                    <Link to="/predict" className="button-primary mt-4">Run prediction <ArrowRight className="h-4 w-4" /></Link>
                  </div>
                )}
              </section>

              <section aria-label="Quick actions" className="grid gap-3 sm:grid-cols-3">
                <Link to="/predict" className="quick-action">
                  <Activity className="h-5 w-5 text-emerald-300" />
                  <span className="min-w-0 flex-1"><strong className="block font-medium text-white">Run prediction</strong><span className="mt-1 block text-xs text-slate-400">Assess sensor readings</span></span>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </Link>
                <Link to="/machines" className="quick-action">
                  <Cpu className="h-5 w-5 text-cyan-300" />
                  <span className="min-w-0 flex-1"><strong className="block font-medium text-white">Manage machines</strong><span className="mt-1 block text-xs text-slate-400">Review registered assets</span></span>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </Link>
                <Link to="/history" className="quick-action">
                  <Clock3 className="h-5 w-5 text-amber-300" />
                  <span className="min-w-0 flex-1"><strong className="block font-medium text-white">View history</strong><span className="mt-1 block text-xs text-slate-400">Browse recorded results</span></span>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </Link>
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
