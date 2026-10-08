import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, Gauge, ShieldCheck, Wrench } from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api";

type Machine = { id: number; machine_code: string; machine_name: string };
type PredictionInput = {
  machine_id: string;
  temperature_c: string;
  vibration_mm_s: string;
  pressure_bar: string;
  load_percent: string;
  power_kw: string;
};
type PredictionMetadata = {
  model_version: string;
  risk_thresholds: Record<string, number>;
  feature_ranges: Record<string, { min: number; max: number }>;
};
type PredictionResult = {
  id: number | null;
  prediction: string;
  probability: number;
  risk_level: string;
  recommended_action: string;
  model_version: string;
  created_at: string | null;
  warnings: string[];
};

const initialForm: PredictionInput = {
  machine_id: "",
  temperature_c: "",
  vibration_mm_s: "",
  pressure_bar: "",
  load_percent: "",
  power_kw: "",
};
const sensorFields: { key: keyof Omit<PredictionInput, "machine_id">; label: string; unit: string }[] = [
  { key: "temperature_c", label: "Temperature", unit: "°C" },
  { key: "vibration_mm_s", label: "Vibration", unit: "mm/s" },
  { key: "pressure_bar", label: "Pressure", unit: "bar" },
  { key: "load_percent", label: "Load", unit: "%" },
  { key: "power_kw", label: "Power", unit: "kW" },
];

export default function PredictionPage() {
  const [form, setForm] = useState(initialForm);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [metadata, setMetadata] = useState<PredictionMetadata | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");

  const loadOptions = async () => {
    setLoadingOptions(true);
    setOptionsError("");
    try {
      const [machinesResponse, metadataResponse] = await Promise.all([
        api.get<Machine[]>("/machines"),
        api.get<PredictionMetadata>("/predictions/metadata"),
      ]);
      setMachines(machinesResponse.data);
      setMetadata(metadataResponse.data);
      setForm((current) => ({
        ...current,
        machine_id: current.machine_id || String(machinesResponse.data[0]?.id ?? ""),
      }));
    } catch (err) {
      setOptionsError(getApiErrorMessage(err, "Gagal memuat mesin atau informasi model."));
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    void loadOptions();
  }, []);

  const updateForm = (field: keyof PredictionInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setResult(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const payload = {
        machine_id: Number(form.machine_id),
        temperature_c: Number(form.temperature_c),
        vibration_mm_s: Number(form.vibration_mm_s),
        pressure_bar: Number(form.pressure_bar),
        load_percent: Number(form.load_percent),
        power_kw: Number(form.power_kw),
      };
      const response = await api.post<PredictionResult>("/predictions", payload);
      setResult(response.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Prediksi gagal diproses. Periksa koneksi dan nilai sensor."));
    } finally {
      setLoading(false);
    }
  };

  const fieldWarnings = metadata
    ? sensorFields.flatMap(({ key, label }) => {
        const value = Number(form[key]);
        const range = metadata.feature_ranges[key];
        if (!form[key] || !range || value >= range.min && value <= range.max) return [];
        return [`${label}: rentang pelatihan ${range.min.toFixed(1)}–${range.max.toFixed(1)}`];
      })
    : [];

  const getStatusTone = (prediction: string) => {
    if (prediction === "NORMAL") return "status-badge status-normal";
    if (["WARNING", "HIGH_RISK"].includes(prediction)) return "status-badge status-warning";
    return "status-badge status-failure";
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-7 md:space-y-9">
      <section className="border-b border-white/10 pb-6">
        <p className="eyebrow">Condition assessment</p>
        <h1 className="page-title">Machine prediction</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Evaluate current sensor readings and review the model&apos;s maintenance recommendation.
        </p>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="glass-card min-w-0 rounded-2xl p-5 sm:p-7">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-2.5 text-emerald-300">
              <Gauge className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="section-title">Prediction input</h2>
              <p className="mt-1 text-sm text-slate-400">Choose a machine and enter its current readings.</p>
            </div>
          </div>

          {loadingOptions ? (
            <div role="status" className="space-y-3 py-4">
              <div className="h-11 animate-pulse rounded-xl bg-white/[0.05]" />
              <div className="grid gap-3 sm:grid-cols-2">
                {sensorFields.map(({ key }) => <div key={key} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />)}
              </div>
              <span className="sr-only">Memuat mesin dan informasi model…</span>
            </div>
          ) : optionsError ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-200" role="alert">
              <p>{optionsError}</p>
              <button type="button" onClick={() => void loadOptions()} className="mt-3 font-semibold underline underline-offset-4">Try again</button>
            </div>
          ) : machines.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 px-5 py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
                <Wrench className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold text-white">Ready when your machines are</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
                Ask an administrator to register a machine before submitting sensor readings for a prediction.
              </p>
              <Link to="/machines" className="button-secondary mt-5">View machine registry <ArrowRight className="h-4 w-4" /></Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid min-w-0 gap-4 sm:grid-cols-2">
              <label className="min-w-0 text-sm text-slate-300 sm:col-span-2">
                <span className="mb-2 block font-medium">Machine</span>
                <select required value={form.machine_id}
                  onChange={(event) => updateForm("machine_id", event.target.value)}
                  className="field-control">
                  {machines.map((machine) => (
                    <option key={machine.id} value={machine.id}>{machine.machine_code} — {machine.machine_name}</option>
                  ))}
                </select>
              </label>
              {sensorFields.map(({ key, label, unit }) => {
                const range = metadata?.feature_ranges[key];
                return (
                  <label key={key} className="min-w-0 text-sm text-slate-300">
                    <span className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 font-medium">
                      <span>{label}</span><span className="text-xs font-normal text-slate-500">{unit}</span>
                    </span>
                    <input required min="0" step="any" type="number" inputMode="decimal"
                      value={form[key]} onChange={(event) => updateForm(key, event.target.value)}
                      aria-describedby={range ? `${key}-range` : undefined}
                      className="field-control" />
                    {range && (
                      <span id={`${key}-range`} className="mt-1.5 block text-xs text-slate-500">
                        Model range: {range.min.toFixed(1)}–{range.max.toFixed(1)} {unit}
                      </span>
                    )}
                  </label>
                );
              })}
              {fieldWarnings.length > 0 && (
                <div role="status" className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100 sm:col-span-2">
                  <p className="mb-2 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-amber-300" />Outside the model training range</p>
                  <ul className="list-inside list-disc space-y-1 text-amber-100/90">
                    {fieldWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                  <p className="mt-2 text-xs text-amber-100/70">Prediction remains available, but the result may be less reliable.</p>
                </div>
              )}
              <div className="sm:col-span-2">
                <button disabled={loading} type="submit" className="button-primary w-full">
                  <Activity className="h-4 w-4" />
                  {loading ? "Processing prediction…" : "Run prediction"}
                </button>
              </div>
            </form>
          )}

          {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-200">{error}</p>}
        </section>

        <section className="glass-card min-w-0 rounded-2xl p-5 sm:p-7">
        {result ? (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Assessment complete</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Prediction result</h2>
              </div>
              <span className={getStatusTone(result.prediction)}>
                {result.prediction === "NORMAL" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {result.prediction}
              </span>
            </div>

            <div className={`rounded-2xl border p-5 ${result.prediction === "NORMAL" ? "border-emerald-400/20 bg-emerald-400/[0.06]" : ["WARNING", "HIGH_RISK"].includes(result.prediction) ? "border-amber-400/25 bg-amber-400/[0.06]" : "border-red-400/25 bg-red-400/[0.06]"}`}>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                Failure probability
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className="text-4xl font-semibold tracking-tight tabular-nums text-white">{(result.probability * 100).toFixed(1)}<span className="text-2xl text-slate-300">%</span></span>
                <span className={getStatusTone(result.prediction)}>{result.risk_level}</span>
              </div>
            </div>

            {result.warnings.length > 0 && (
              <div role="alert" className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm leading-6 text-amber-100">
                {result.warnings.join(" ")}
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
              <div className="mb-2 flex items-center gap-2 text-emerald-300">
                <ArrowRight className="h-4 w-4" />
                Recommendation
              </div>
              <p className="text-sm leading-6 text-slate-200">{result.recommended_action}</p>
            </div>

            <div className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
              <div className="flex items-start gap-2 text-xs text-slate-400">
                <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span>Model version<strong className="mt-1 block font-medium text-slate-200">{result.model_version}</strong></span>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-400">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span>Created at<strong className="mt-1 block font-medium text-slate-200">{result.created_at ? new Date(result.created_at).toLocaleString() : "Not provided"}</strong></span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/25 px-5 py-10 text-center sm:min-h-[420px]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300">
              <Activity className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-white">Ready for prediction</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
              Select a machine and enter its sensor readings. The model result and recommended action will appear here.
            </p>
            {metadata && (
              <p className="mt-5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
                Active model <span className="font-medium text-slate-200">{metadata.model_version}</span>
              </p>
            )}
          </div>
        )}
        </section>
      </div>
    </div>
  );
}
