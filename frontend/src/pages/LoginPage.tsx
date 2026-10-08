import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, Cpu, Factory, ShieldCheck, Wrench } from "lucide-react";
import api from "../lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/auth/login", { email, password });
      const { token, user } = response.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      navigate("/dashboard");
    } catch (err) {
      setError("Login gagal. Periksa email dan kata sandi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell flex min-h-screen w-full items-center justify-center px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/65 shadow-2xl shadow-black/30 backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-[600px] flex-col justify-between overflow-hidden border-r border-white/10 bg-slate-900/55 p-10 lg:flex xl:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-20 h-80 w-80 rounded-full border border-emerald-400/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-6 h-52 w-52 rounded-full border border-cyan-400/10" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <Wrench className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Industrial operations</p>
                <p className="mt-1 font-semibold text-white">Predictive Maintenance</p>
              </div>
            </div>
            <p className="eyebrow mt-20">Condition monitoring</p>
            <h1 className="mt-3 max-w-md text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
              Better visibility for every machine.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-400">
              Review equipment status, assess sensor readings, and keep prediction results in one workspace.
            </p>
          </div>

          <div className="relative grid gap-3">
            {[
              { icon: Factory, label: "Equipment registry", detail: "View registered machines and readings" },
              { icon: Activity, label: "Model assessment", detail: "Evaluate current sensor conditions" },
              { icon: ShieldCheck, label: "Prediction records", detail: "Review risk results and recommendations" },
            ].map(({ icon: Icon, label, detail }) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                <div className="rounded-xl bg-white/[0.04] p-2 text-emerald-300">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-[540px] flex-col justify-center p-6 sm:p-10 lg:p-12">
          <div className="mb-9 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <Wrench className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Industrial operations</p>
                <p className="mt-1 font-semibold text-white">Predictive Maintenance</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <p className="eyebrow">Secure workspace</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Sign in to continue to your maintenance control center.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-slate-300">Email address</label>
              <input
                id="login-email"
                required
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
                placeholder="name@company.com"
                className="field-control"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-300">Password</label>
              </div>
              <input
                id="login-password"
                required
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
                placeholder="Enter your password"
                className="field-control"
              />
            </div>
            {error && <p id="login-error" role="alert" className="rounded-xl border border-red-500/25 bg-red-500/5 px-3.5 py-3 text-sm text-red-200">{error}</p>}
            <button disabled={loading} type="submit" className="button-primary w-full">
              {loading ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />Signing in…</>
              ) : (
                <>Sign in <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-start gap-2.5 border-t border-white/[0.07] pt-5 text-xs leading-5 text-slate-500">
            <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <p>Access is provided by your system administrator. Public self-registration is not available.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
