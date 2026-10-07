import { NavLink, Outlet } from "react-router-dom";
import { Activity, Gauge, History, LogOut, ServerCog, Sparkles, Wrench } from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/predict", label: "Predictions", icon: Activity },
  { to: "/history", label: "History", icon: History },
  { to: "/machines", label: "Machines", icon: ServerCog },
];

export default function Layout() {
  let user: { name?: string; role?: string } = {};
  try {
    user = JSON.parse(localStorage.getItem("user") ?? "{}") as { name?: string; role?: string };
  } catch {
    user = {};
  }
  const userName = user.name || "Pengguna";
  const initials = userName.trim().slice(0, 2).toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <div className="app-shell min-h-screen text-slate-100">
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="hidden min-h-screen w-80 border-r border-white/10 bg-slate-950/70 p-6 backdrop-blur-xl md:block">
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-3">
            <div className="rounded-xl bg-emerald-500/20 p-2 text-emerald-300">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Industrial</p>
              <h1 className="text-xl font-semibold text-white">Predictive</h1>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-slate-300">
            Dashboard merangkum status berdasarkan prediksi terbaru setiap mesin.
          </div>

          <button
            onClick={handleLogout}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 px-4 py-4 backdrop-blur-xl md:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Operations</p>
                  <p className="text-sm font-medium text-white">Command center</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 text-xs font-bold text-slate-950">
                    {initials}
                  </div>
                  <div className="hidden text-left sm:block">
                    <div className="text-xs capitalize text-slate-400">{user.role || "user"}</div>
                    <div className="text-sm font-medium text-white">{userName}</div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="p-4 md:p-8 xl:p-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
