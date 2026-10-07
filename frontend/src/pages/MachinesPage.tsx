import { FormEvent, useEffect, useState } from "react";
import { Cpu, MapPin, Plus, ServerCog, ThermometerSun } from "lucide-react";
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
    <div className="space-y-6">
      {canManage && (
        <div className="glass-card rounded-3xl p-6 md:p-7">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Assets</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Machines</h1>
            <p className="mt-2 text-sm text-slate-400">Tambahkan mesin agar operator dapat memilihnya saat membuat prediksi.</p>
          </div>

          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Machine code</span>
              <input required minLength={2} maxLength={50} value={form.machine_code}
                onChange={(event) => setForm((current) => ({ ...current, machine_code: event.target.value }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-white outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20" />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Machine name</span>
              <input required minLength={2} maxLength={150} value={form.machine_name}
                onChange={(event) => setForm((current) => ({ ...current, machine_name: event.target.value }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-white outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20" />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Location</span>
              <input required minLength={2} maxLength={120} value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-white outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20" />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Current temperature (°C)</span>
              <input required min="0" step="any" type="number" value={form.temperature_c}
                onChange={(event) => setForm((current) => ({ ...current, temperature_c: Number(event.target.value) }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-white outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20" />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Current vibration (mm/s)</span>
              <input required min="0" step="any" type="number" value={form.vibration_mm_s}
                onChange={(event) => setForm((current) => ({ ...current, vibration_mm_s: Number(event.target.value) }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-white outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20" />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-2 block">Status</span>
              <select value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-white outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20">
                <option value="healthy">Healthy</option>
                <option value="maintenance">Maintenance</option>
                <option value="offline">Offline</option>
              </select>
            </label>
            <div className="flex items-end md:col-span-2 xl:col-span-3">
              <button disabled={saving} type="submit"
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">
                <Plus className="h-4 w-4" />
                {saving ? "Menyimpan…" : "Add machine"}
              </button>
            </div>
          </form>
          {formError && <p role="alert" className="mt-4 text-sm text-red-400">{formError}</p>}
          {success && <p role="status" className="mt-4 text-sm text-emerald-300">{success}</p>}
        </div>
      )}

      {!canManage && (
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Assets</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Machines</h1>
          <p className="mt-2 text-sm text-slate-400">Daftar mesin yang tersedia untuk pemeriksaan dan prediksi.</p>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-slate-300">
        <ServerCog className="h-4 w-4 text-cyan-300" />
        {machines.length} registered machine{machines.length === 1 ? "" : "s"}
      </div>

      {loading ? (
        <p role="status" className="py-10 text-center text-slate-400">Memuat daftar mesin…</p>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          {error}
          <button type="button" onClick={() => void fetchMachines()} className="ml-3 font-semibold underline">Coba lagi</button>
        </div>
      ) : machines.length === 0 ? (
        <div className="glass-card rounded-3xl p-10 text-center text-slate-400">Belum ada mesin yang terdaftar.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {machines.map((machine) => (
            <div key={machine.id} className="glass-card rounded-3xl p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-500/10 p-2 text-emerald-300"><Cpu className="h-4 w-4" /></div>
                  <h3 className="text-lg font-semibold text-white">{machine.machine_name}</h3>
                </div>
                <span className={`status-badge ${machine.status === "healthy" ? "status-normal" : "status-warning"}`}>{machine.status}</span>
              </div>

              <div className="space-y-2 text-sm text-slate-300">
                <p><span className="text-slate-400">Code:</span> {machine.machine_code}</p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-cyan-300" />{machine.location}</p>
                <p className="flex items-center gap-2"><ThermometerSun className="h-4 w-4 text-amber-300" />Temp: {machine.temperature_c}°C</p>
                <p className="flex items-center gap-2"><ServerCog className="h-4 w-4 text-emerald-300" />Vibration: {machine.vibration_mm_s} mm/s</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
