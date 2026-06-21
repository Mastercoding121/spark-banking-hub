import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, type ReactNode } from "react";
import { holderStore, useHolder } from "@/lib/store";
import { authStore, type StoredUser } from "@/lib/auth";
import { signOut } from "@/lib/user.functions";
import { BrandLogo } from "@/components/BrandLogo";
import {
  Home,
  Wallet,
  Landmark,
  TrendingUp,
  MoreHorizontal,
  User,
  MessageSquare,
  LogOut,
  Settings,
  Award,
} from "lucide-react";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/wallet", label: "Wallet" },
  { to: "/loans", label: "Loans" },
  { to: "/investments", label: "Investments" },
  { to: "/grants", label: "Grants" },
  { to: "/support", label: "Support" },
];

const BOTTOM_NAV_CORE = [
  { to: "/dashboard", label: "Home", icon: <Home className="h-5 w-5" /> },
  { to: "/wallet", label: "Wallet", icon: <Wallet className="h-5 w-5" /> },
  { to: "/loans", label: "Loans", icon: <Landmark className="h-5 w-5" /> },
  { to: "/investments", label: "Activity", icon: <TrendingUp className="h-5 w-5" /> },
];

const MORE_MENU_ITEMS = [
  { to: "/grants", label: "Grants", icon: <Award className="h-4 w-4" /> },
  { to: "/support", label: "Support", icon: <MessageSquare className="h-4 w-4" /> },
  { to: "/profile", label: "Profile", icon: <User className="h-4 w-4" /> },
  { to: "/profile", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export function BankShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const holder = useHolder();
  const signOutFn = useServerFn(signOut);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Read auth state client-side only — authStore reads localStorage which isn't
  // available during SSR. Initialise to null (same as server) and update after mount
  // so the first hydration render matches the server-rendered HTML exactly.
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  useEffect(() => {
    setCurrentUser(authStore.current());
    return authStore.subscribe(() => setCurrentUser(authStore.current()));
  }, []);

  const handleLogout = async () => {
    try { await signOutFn({}); } catch {}
    authStore.signOut();
    holderStore.set("");
    setShowMoreMenu(false);
    router.navigate({ to: "/" });
  };

  const isActive = (to: string) =>
    to === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* ── Sticky Header ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-red-700 via-red-800 to-red-900 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
          {/* Brand */}
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <BrandLogo height="h-9" className="text-white/60" />
            <div className="hidden leading-tight sm:block">
              <div className="text-base font-bold tracking-tight">FINEXTHUB</div>
              <div className="text-[9px] uppercase tracking-[0.25em] opacity-70">Bank of USA</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`rounded-md px-3 py-1.5 text-[13px] font-bold transition ${
                  isActive(to)
                    ? "bg-white/20 text-white"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {label}
              </Link>
            ))}
            {currentUser?.isAdmin && (
              <Link
                to="/admin"
                className="ml-1 rounded-md bg-amber-400/20 px-3 py-1.5 text-[13px] font-bold text-amber-300 hover:bg-amber-400/30"
              >
                Admin
              </Link>
            )}
          </nav>

          {/* Right: holder + avatar + logout */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden text-right leading-tight lg:block">
              <div className="text-[10px] uppercase tracking-widest opacity-60">Account Holder</div>
              <div className="max-w-[140px] truncate text-sm font-bold">{holder || "Guest"}</div>
            </div>
            <Link
              to="/profile"
              aria-label="Profile"
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-2 transition sm:h-9 sm:w-9 sm:text-sm ${
                pathname === "/profile"
                  ? "bg-white text-red-700 ring-white"
                  : "bg-white/15 text-white ring-white/20 hover:bg-white/25"
              }`}
            >
              {(holder?.trim()?.[0] || currentUser?.email?.[0] || "G").toUpperCase()}
            </Link>
            <button
              onClick={handleLogout}
              className="hidden rounded-md bg-white/10 px-3 py-1.5 text-xs font-bold text-white/90 transition hover:bg-white/20 sm:block"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Security notice bar */}
        <div className="border-t border-white/10 bg-black/20">
          <div className="mx-auto flex max-w-7xl items-center gap-1.5 px-4 py-1 text-[11px] text-white/50">
            <svg className="h-3 w-3 shrink-0 text-amber-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span><span className="text-amber-400/80">Secure Session</span> · 256-bit SSL · FDIC Insured up to $250,000</span>
          </div>
        </div>
      </header>

      {/* ── Page content (extra bottom padding on mobile for bottom nav) ── */}
      <div className="pb-20 md:pb-0">
        {children}
      </div>

      {/* ── Footer (desktop only) ─────────────────────────────── */}
      <div className="hidden md:block">
        <footer className="mt-8 border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl space-y-3 px-4 py-6">
            <Link
              to="/support"
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 transition hover:border-red-300 hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-xl text-red-700">💬</div>
                <div>
                  <div className="text-sm font-bold">24/7 Customer Support</div>
                  <div className="text-xs text-slate-500">Chat with Ember or open a ticket — any time, day or night.</div>
                </div>
              </div>
              <span className="text-slate-400">›</span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs text-slate-500">
              <span>© 2026 FinextHub Bank of USA · Member FDIC · Equal Housing Lender</span>
              <span className="hidden sm:flex items-center gap-3">
                <Link to="/privacy" className="hover:text-red-700">Privacy Policy</Link>
                <span>·</span>
                <Link to="/terms" className="hover:text-red-700">Terms of Service</Link>
                <span>·</span>
                <Link to="/cookies" className="hover:text-red-700">Cookie Policy</Link>
              </span>
            </div>
          </div>
        </footer>
      </div>

      {/* ── More Menu Overlay ───────────────────────────────────── */}
      {showMoreMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/30"
          onClick={() => setShowMoreMenu(false)}
        />
      )}

      {/* ── Mobile Bottom Navigation ──────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden">
        <div className="flex items-stretch">
          {BOTTOM_NAV_CORE.map(({ to, label, icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                  active ? "text-red-700" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span className={`transition-transform ${active ? "scale-110" : ""}`}>
                  {icon}
                </span>
                <span className={`text-[10px] font-bold ${active ? "text-red-700" : ""}`}>
                  {label}
                </span>
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-red-700" style={{ marginTop: -1 }} />
                )}
              </Link>
            );
          })}
          {/* More Menu Button */}
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
              showMoreMenu ? "text-red-700" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className={`transition-transform ${showMoreMenu ? "scale-110" : ""}`}>
              <MoreHorizontal className="h-5 w-5" />
            </span>
            <span className={`text-[10px] font-bold ${showMoreMenu ? "text-red-700" : ""}`}>
              More
            </span>
          </button>
        </div>

        {/* More Menu Dropdown */}
        {showMoreMenu && (
          <div className="absolute bottom-16 left-1/2 mb-2 w-[280px] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            {MORE_MENU_ITEMS.map(({ to, label, icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setShowMoreMenu(false)}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 ${
                  isActive(to) ? "text-red-700 bg-slate-100" : ""
                }`}
              >
                {icon}
                {label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}
