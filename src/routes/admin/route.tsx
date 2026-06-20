import { createFileRoute, Outlet, Link, useRouterState, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { holderStore } from "@/lib/store";
import { authStore } from "@/lib/auth";
import { signOut } from "@/lib/user.functions";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV = [
  {
    to: "/admin" as const,
    label: "Overview",
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: "/admin/users" as const,
    label: "Users",
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
        <circle cx="19" cy="7" r="2" /><path d="M23 21v-1a3 3 0 00-2-2.83" />
      </svg>
    ),
  },
  {
    to: "/admin/transactions" as const,
    label: "Transactions",
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    to: "/admin/loans" as const,
    label: "Loans",
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="9" width="18" height="12" rx="1" />
        <path d="M3 9l9-6 9 6" />
        <line x1="9" y1="21" x2="9" y2="9" /><line x1="15" y1="21" x2="15" y2="9" />
      </svg>
    ),
  },
  {
    to: "/admin/support" as const,
    label: "Support",
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
];

function AdminLayout() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentUser = authStore.current();
  const signOutFn = useServerFn(signOut);

  const handleLogout = async () => {
    try { await signOutFn({}); } catch {}
    authStore.signOut();
    holderStore.set("");
    router.navigate({ to: "/" });
  };

  // ── Auth Guard ──────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-3xl">🔒</div>
        <h1 className="text-xl font-bold">Authentication Required</h1>
        <p className="text-sm text-white/50">Please sign in to access the admin panel.</p>
        <Link to="/" className="mt-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300">
          Go to Sign In
        </Link>
      </div>
    );
  }

  if (!currentUser.isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-3xl">⛔</div>
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-sm text-white/50">Your account does not have admin privileges.</p>
        <div className="mt-1 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/40">
          Signed in as: <span className="text-amber-300">{currentUser.email}</span>
        </div>
        <Link to="/dashboard" className="mt-2 rounded-lg border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/10">
          ← Return to Dashboard
        </Link>
      </div>
    );
  }

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : (pathname === to || pathname.startsWith(to + "/"));

  return (
    <div className="flex min-h-screen bg-slate-950 font-sans text-white">

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-slate-900">
        {/* Brand */}
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/20">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 L20 6 V12 C20 17 16 21 12 22 C8 21 4 17 4 12 V6 Z" fill="rgba(251,191,36,0.15)" />
                <path d="M8.5 12 h7 M8.5 14.5 h7 M12 9 v8" />
                <circle cx="12" cy="9" r="1.1" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-amber-400">FinextHub</div>
              <div className="text-sm font-bold leading-tight">Admin Panel</div>
            </div>
          </div>
        </div>

        {/* Admin identity */}
        <div className="border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/20 text-xs font-bold text-amber-400">
              {currentUser.name?.[0]?.toUpperCase() || currentUser.email[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold">{currentUser.name || "Admin"}</div>
              <div className="truncate text-[10px] text-white/40">{currentUser.email}</div>
            </div>
            <span className="ml-auto shrink-0 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">Admin</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-3">
          {NAV.map(({ to, label, exact, icon }) => {
            const active = isActive(to, exact);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-amber-400/15 font-semibold text-amber-300"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className={active ? "text-amber-400" : "text-white/40"}>{icon}</span>
                {label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 px-3 py-3 space-y-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-white/50 hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M19 12H5m7-7l-7 7 7 7" /></svg>
            Back to Banking
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-400/10 hover:text-red-300"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/80 backdrop-blur-md px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/40" suppressHydrationWarning>
              {typeof window !== "undefined" ? new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : ""}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/40">Live</span>
            </div>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
