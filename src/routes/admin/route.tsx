import { createFileRoute, Outlet, Link, useRouterState, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { holderStore } from "@/lib/store";
import { authStore } from "@/lib/auth";
import { signOut } from "@/lib/user.functions";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV_ITEMS = [
  { to: "/admin", label: "Overview", icon: "⬛" },
  { to: "/admin/users", label: "Users", icon: "👥" },
  { to: "/admin/transactions", label: "Transactions", icon: "💳" },
  { to: "/admin/loans", label: "Loans", icon: "🏦" },
];

function AdminLayout() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const signOutFn = useServerFn(signOut);

  const handleLogout = async () => {
    try { await signOutFn({}); } catch {}
    authStore.signOut();
    holderStore.set("");
    router.navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen bg-slate-950 font-sans text-white">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-white/10 bg-slate-900 shadow-xl">
        <div className="border-b border-white/10 p-4">
          <div className="text-xs uppercase tracking-widest text-amber-400">FinextHub</div>
          <div className="text-lg font-bold">Admin Panel</div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map(({ to, label, icon }) => {
            const active = pathname === to || (to !== "/admin" && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-amber-400/20 font-semibold text-amber-300" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3 space-y-2">
          <Link
            to="/dashboard"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/60 hover:bg-white/10 hover:text-white"
          >
            ← Back to Banking
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-400/10 hover:text-red-300"
          >
            ⏻ Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
