import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, Gauge, History, LogOut, Menu, ServerCog, Sparkles, Wrench, X } from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/predict", label: "Predictions", icon: Activity },
  { to: "/history", label: "History", icon: History },
  { to: "/machines", label: "Machines", icon: ServerCog },
];

const mobileNavItems = [
  navItems[0],
  navItems[3],
  { ...navItems[1], label: "Prediction" },
  navItems[2],
];

const navLinkClass = (isActive: boolean) =>
  `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
    isActive
      ? "bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]"
      : "text-slate-300 hover:bg-white/5 hover:text-white"
  }`;

export default function Layout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();

  let user: { name?: string; role?: string } = {};
  try {
    user = JSON.parse(localStorage.getItem("user") ?? "{}") as { name?: string; role?: string };
  } catch {
    user = {};
  }
  const userName = user.name || "Pengguna";
  const initials = userName.trim().slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!isMobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileNavOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMobileNavOpen]);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  return (
    <div className="app-shell min-h-screen w-full text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
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
                className={({ isActive }) => navLinkClass(isActive)}
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

        {isMobileNavOpen && (
          <>
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setIsMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm md:hidden"
            />
            <aside
              id="mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col overflow-y-auto border-r border-white/10 bg-slate-950 p-5 shadow-2xl md:hidden"
            >
              <div className="mb-8 flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="shrink-0 rounded-xl bg-emerald-500/20 p-2 text-emerald-300">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Industrial</p>
                    <h2 className="text-xl font-semibold text-white">Predictive</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(false)}
                  aria-label="Close menu"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav aria-label="Main navigation" className="space-y-2">
                {mobileNavItems.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setIsMobileNavOpen(false)}
                    className={({ isActive }) => navLinkClass(isActive)}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </NavLink>
                ))}
              </nav>

              <button
                onClick={handleLogout}
                className="mt-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </aside>
          </>
        )}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 px-4 py-4 backdrop-blur-xl md:px-8">
            <div className="flex items-center justify-between gap-2 md:gap-4">
              <div className="flex min-w-0 items-center gap-2 md:gap-3">
                <button
                  type="button"
                  aria-label="Open navigation menu"
                  aria-expanded={isMobileNavOpen}
                  aria-controls="mobile-navigation"
                  onClick={() => setIsMobileNavOpen(true)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-emerald-400/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
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

          <main className="min-w-0 p-4 md:p-8 xl:p-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
