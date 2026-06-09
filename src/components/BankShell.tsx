import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { holderStore, useHolder } from "@/lib/store";

function Logo() {
  // Animated coin/shield logo with pulsing glow + rotating ring + spark
  return (
    <div className="relative h-12 w-12">
      <div className="absolute inset-0 animate-ping rounded-full bg-amber-400/30" />
      <div className="absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,theme(colors.amber.300),theme(colors.red.500),theme(colors.amber.300))] p-[2px]">
        <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-red-900 to-red-950 shadow-inner">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-amber-300 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 L20 6 V12 C20 17 16 21 12 22 C8 21 4 17 4 12 V6 Z" fill="rgba(251,191,36,0.15)" />
            <path d="M8.5 12 h7 M8.5 14.5 h7 M12 9 v8" />
            <circle cx="12" cy="9" r="1.1" fill="currentColor" stroke="none" />
          </svg>
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.8)]" />
        </div>
      </div>
    </div>
  );
}

export function BankShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showBack = pathname !== "/" && pathname !== "/dashboard";
  const holder = useHolder();

  const handleLogout = () => {
    holderStore.set("");
    router.navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-gradient-to-r from-red-700 via-red-800 to-red-900 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            {showBack && (
              <button
                onClick={() => router.history.back()}
                aria-label="Go back"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-base hover:bg-white/20 sm:h-9 sm:w-9 sm:text-lg"
              >
                ←
              </button>
            )}
            <Link to="/dashboard" className="flex min-w-0 items-center gap-2 sm:gap-3">
              <Logo />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-bold tracking-tight sm:text-lg">FIRESTONE</div>
                <div className="text-[9px] uppercase tracking-widest opacity-80 sm:text-[10px]">Bank of USA</div>
              </div>
            </Link>
          </div>
          <nav className="hidden items-center gap-4 text-xs font-medium md:flex">
            <Link to="/dashboard" className="opacity-90 hover:opacity-100">Dashboard</Link>
            <Link to="/loans" className="opacity-90 hover:opacity-100">Loans</Link>
            <Link to="/investments" className="opacity-90 hover:opacity-100">Investments</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 text-sm sm:gap-2">
            <div className="hidden text-right leading-tight md:block">
              <div className="text-[10px] uppercase tracking-widest opacity-70">Account Holder</div>
              <div className="max-w-[140px] truncate text-sm font-semibold">{holder || "Guest"}</div>
            </div>
            <Link to="/profile" aria-label="Profile" title="Profile & Security" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-bold ring-1 ring-white/20 hover:bg-white/25 sm:h-9 sm:w-9 sm:text-sm">
              {(holder?.trim()?.[0] || "G").toUpperCase()}
            </Link>
            <button onClick={handleLogout} className="rounded-md bg-white/10 px-2.5 py-1.5 text-[11px] font-medium hover:bg-white/20 sm:px-3 sm:text-xs">Logout</button>
          </div>
        </div>
      </header>
      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs text-amber-900">
          <span>🔒</span>
          <span><strong>Security Notice:</strong> 256-bit SSL encrypted session.</span>
        </div>
      </div>
      {children}
      <footer className="mt-8 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-6">
          <Link to="/support" className="flex items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 transition hover:border-red-300 hover:shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-xl text-red-700">💬</div>
              <div>
                <div className="text-sm font-semibold">24/7 Customer Support</div>
                <div className="text-xs text-slate-500">Chat with Ember, our virtual assistant, or open a ticket — any time, day or night.</div>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </Link>
          <div className="text-center text-xs text-slate-500">
            © 2026 Firestone Bank of USA. Member FDIC. Equal Housing Lender.
          </div>
        </div>
      </footer>
    </div>
  );
}
