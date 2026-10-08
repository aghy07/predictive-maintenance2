import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Cpu, MapPin, Plus, ServerCog, ThermometerSun, Waves } from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api";

type Machine = {
  id: number;
  machine_code: string;
  machine_name: string;
  location: string;
  temperature_c: number;
  vibration_mm_s: number;
  status: string;
};
type MachineForm = Omit<Machine, "id">;

const emptyForm: MachineForm = {
  machine_code: "",
  machine_name: "",
  location: "",
  temperature_c: 0,
  vibration_mm_s: 0,
  status: "healthy",
};

function isAdmin(): boolean {
  try {
    const user = JSON.parse(localStorage.getItem("user") ?? "null") as { role?: string } | null;
    return user?.role === "admin";
  } catch {
    return false;
  }
}

function statusPresentation(status: string): { label: string; tone: string; indicator: string } {
  const normalized = status.toLowerCase();
  if (normalized === "healthy") {
    return { label: "Healthy", tone: "status-badge status-normal", indicator: "bg-emerald-400" };
  }
  if (normalized === "offline") {
    return { label: "Offline", tone: "status-badge status-failure", indicator: "bg-red-400" };
  }
  if (normalized === "maintenance") {
    return { label: "Maintenance", tone: "status-badge status-warning", indicator: "bg-amber-400" };
  }
  return { label: status, tone: "status-badge border border-white/10 bg-white/5 text-slate-300", indicator: "bg-slate-400" };
}

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [form, setForm] = useState<MachineForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const canManage = isAdmin();

  const fetchMachines = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<Machine[]>("/machines");
      setMachines(response.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Gagal memuat daftar mesin."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMachines();
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setSuccess("");
    setSaving(true);
    try {
      await api.post("/machines", form);
      setForm(emptyForm);
      setSuccess("Mesin berhasil ditambahkan.");
      await fetchMachines();
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Mesin gagal ditambahkan."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-7 md:space-y-9">
      <section className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Asset registry</p>
          <h1 className="page-title">Machines</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Review registered equipment, current condition, and sensor readings.
          </p>
        </div>
        {canManage && (
          <a href="#add-machine-form" className="button-primary self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            Add machine
          </a>
        )}
      </section>

      {canManage && (
        <section id="add-machine-form" className="glass-card scroll-mt-24 rounded-2xl p-5 sm:p-7">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-2.5 text-emerald-300">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="section-title">Register a machine</h2>
              <p className="mt-1 text-sm text-slate-400">Add an asset and its current readings to the monitoring list.</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="min-w-0 text-sm text-slate-300">
              <span className="mb-2 block font-medium">Machine code</span>
              <input required minLength={2} maxLength={50} value={form.machine_code}
                onChange={(event) => setForm((current) => ({ ...current, machine_code: event.target.value }))}
                placeholder="e.g. PUMP-01" className="field-control" />
            </label>
            <label className="min-w-0 text-sm text-slate-300">
              <span className="mb-2 block font-medium">Machine name</span>
              <input required minLength={2} maxLength={150} value={form.machine_name}
                onChange={(event) => setForm((current) => ({ ...current, machine_name: event.target.value }))}
                placeholder="Equipment name" className="field-control" />
            </label>
            <label className="min-w-0 text-sm text-slate-300">
              <span className="mb-2 block font-medium">Location</span>
              <input required minLength={2} maxLength={120} value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                placeholder="Plant or production area" className="field-control" />
            </label>
            <label className="min-w-0 text-sm text-slate-300">
              <span className="mb-2 block font-medium">Current temperature <span className="font-normal text-slate-500">(°C)</span></span>
              <input required min="0" step="any" type="number" value={form.temperature_c}
                onChange={(event) => setForm((current) => ({ ...current, temperature_c: Number(event.target.value) }))}
                className="field-control" />
            </label>
            <label className="min-w-0 text-sm text-slate-300">
              <span className="mb-2 block font-medium">Current vibration <span className="font-normal text-slate-500">(mm/s)</span></span>
              <input required min="0" step="any" type="number" value={form.vibration_mm_s}
                onChange={(event) => setForm((current) => ({ ...current, vibration_mm_s: Number(event.target.value) }))}
                className="field-control" />
            </label>
            <label className="min-w-0 text-sm text-slate-300">
              <span className="mb-2 block font-medium">Status</span>
              <select value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className="field-control">
                <option value="healthy">Healthy</option>
                <option value="maintenance">Maintenance</option>
                <option value="offline">Offline</option>
              </select>
            </label>
            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center xl:col-span-3">
              <button disabled={saving} type="submit" className="button-primary">
                <Plus className="h-4 w-4" />
                {saving ? "Saving machine…" : "Save machine"}
              </button>
              {formError && <p role="alert" className="text-sm text-red-300">{formError}</p>}
              {success && <p role="status" className="text-sm text-emerald-300">{success}</p>}
            </div>
          </form>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title">Registered equipment</h2>
            <p className="mt-1 text-sm text-slate-400">Current machine status and recorded sensor readings</p>
          </div>
          {!loading && !error && (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300">
              {machines.length} {machines.length === 1 ? "machine" : "machines"}
            </span>
          )}
        </div>

        {loading ? (
          <div role="status" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => <div key={index} className="glass-card h-48 animate-pulse rounded-2xl bg-white/[0.03]" />)}
          </div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-red-500/25 bg-red-500/5 p-5 text-sm text-red-200">
            <p>{error}</p>
            <button type="button" onClick={() => void fetchMachines()} className="mt-3 font-semibold underline underline-offset-4">Try again</button>
          </div>
        ) : machines.length === 0 ? (
          <div className="glass-card rounded-2xl px-6 py-10 text-center sm:px-10 sm:py-14">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
              <ServerCog className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="mt-5 text-xl font-semibold text-white">No machines registered yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              {canManage
                ? "Add your first machine to start monitoring equipment and making sensor-based predictions."
                : "Ask an administrator to add equipment before starting a sensor-based prediction."}
            </p>
            {canManage ? (
              <a href="#add-machine-form" className="button-primary mt-6"><Plus className="h-4 w-4" />Add your first machine</a>
            ) : (
              <Link to="/dashboard" className="button-secondary mt-6"><Activity className="h-4 w-4" />Back to overview</Link>
            )}
          </div>
        ) : (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {machines.map((machine) => {
              const status = statusPresentation(machine.status);
              return (
                <article key={machine.id} className="glass-card min-w-0 rounded-2xl p-5 transition duration-200 hover:-translate-y-0.5 hover:border-white/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-2.5 text-cyan-300">
                        <Cpu className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-white">{machine.machine_name}</p>
                        <p className="mt-1 break-all text-xs font-medium tracking-wide text-slate-500">{machine.machine_code}</p>
                      </div>
                    </div>
                    <span className={status.tone}>
                      <span className={`h-1.5 w-1.5 rounded-full ${status.indicator}`} />
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-5 flex min-w-0 items-center gap-2 border-t border-white/[0.07] pt-4 text-sm text-slate-400">
                    <MapPin className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="truncate">{machine.location}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                      <p className="flex items-center gap-1.5 text-xs text-slate-500"><ThermometerSun className="h-3.5 w-3.5 text-amber-300" />Temperature</p>
                      <p className="mt-2 text-lg font-semibold tabular-nums text-slate-100">{machine.temperature_c}<span className="ml-1 text-xs font-normal text-slate-400">°C</span></p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                      <p className="flex items-center gap-1.5 text-xs text-slate-500"><Waves className="h-3.5 w-3.5 text-sky-300" />Vibration</p>
                      <p className="mt-2 text-lg font-semibold tabular-nums text-slate-100">{machine.vibration_mm_s}<span className="ml-1 text-xs font-normal text-slate-400">mm/s</span></p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
