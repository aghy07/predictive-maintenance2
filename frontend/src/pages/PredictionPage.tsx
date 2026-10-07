import { FormEvent, useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Gauge, ShieldCheck } from "lucide-react";
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
  prediction: string;
  probability: number;
  risk_level: string;
  recommended_action: string;
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
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="glass-card rounded-3xl p-6 md:p-7">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-emerald-400">Diagnostics</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Machine prediction</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
            <Gauge className="h-4 w-4 text-cyan-300" />
            {metadata ? `Model ${metadata.model_version}` : "Model"}
          </div>
        </div>

        {loadingOptions ? (
          <p role="status" className="py-8 text-center text-slate-400">Memuat mesin dan informasi model…</p>
        ) : optionsError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300" role="alert">
            <p>{optionsError}</p>
            <button type="button" onClick={() => void loadOptions()} className="mt-3 font-semibold underline">Coba lagi</button>
          </div>
        ) : machines.length === 0 ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
            Belum ada mesin terdaftar. Minta administrator menambahkan mesin sebelum menjalankan prediksi.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-300 md:col-span-2">
              <span className="mb-2 block">Mesin</span>
              <select
                required
                value={form.machine_id}
                onChange={(event) => updateForm("machine_id", event.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-white outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
              >
                {machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>{machine.machine_code} — {machine.machine_name}</option>
                ))}
              </select>
            </label>
            {sensorFields.map(({ key, label, unit }) => (
              <label key={key} className="text-sm text-slate-300">
                <span className="mb-2 block">{label} ({unit})</span>
                <input
                  required
                  min="0"
                  step="any"
                  type="number"
                  value={form[key]}
                  onChange={(event) => updateForm(key, event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-white outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
                />
              </label>
            ))}
            {fieldWarnings.length > 0 && (
              <div role="status" className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-200 md:col-span-2">
                <p className="mb-2 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" />Nilai di luar rentang data pelatihan</p>
                <ul className="list-inside list-disc space-y-1">
                  {fieldWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
                <p className="mt-2 text-amber-100/80">Prediksi tetap dapat dijalankan, tetapi probabilitasnya mungkin kurang andal.</p>
              </div>
            )}
            <div className="md:col-span-2">
              <button
                disabled={loading}
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
              >
                <Activity className="h-4 w-4" />
                {loading ? "Memproses prediksi…" : "Run prediction"}
              </button>
            </div>
          </form>
        )}

        {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      </div>

      <div className="glass-card rounded-3xl p-6 md:p-7">
        {result ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-white">Prediction result</h2>
              <span className={getStatusTone(result.prediction)}>{result.prediction}</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Estimated failure probability
              </div>
              <div className="mt-3 text-3xl font-bold text-white">{(result.probability * 100).toFixed(1)}%</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex items-center gap-2 text-slate-400">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                Risk level
              </div>
              <div className="mt-3 text-xl font-semibold text-white">{result.risk_level}</div>
            </div>

            {result.warnings.length > 0 && (
              <div role="alert" className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-200">
                {result.warnings.join(" ")}
              </div>
            )}

            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-cyan-300">
                <ArrowRight className="h-4 w-4" />
                Recommendation
              </div>
              <p className="text-sm leading-6 text-slate-200">{result.recommended_action}</p>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 text-center text-slate-400">
            Pilih mesin dan isi data sensor untuk melihat probabilitas risiko serta rekomendasi perawatan.
          </div>
        )}
      </div>
    </div>
  );
}
