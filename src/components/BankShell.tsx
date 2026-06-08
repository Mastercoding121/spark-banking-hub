import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

function Logo() {
  // Animated rotating shield-coin logo
  return (
    <div className="relative h-11 w-11">
      <div className="absolute inset-0 animate-[spin_8s_linear_infinite] rounded-full bg-gradient-to-tr from-amber-300 via-amber-500 to-red-600 p-[2px]">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-red-900">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 L20 6 V12 C20 17 16 21 12 22 C8 21 4 17 4 12 V6 Z" />
            <path d="M9 11 h6 M9 14 h6 M12 8 v9" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function BankShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showBack = pathname !== "/";

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-gradient-to-r from-red-700 to-red-900 text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                onClick={() => router.history.back()}
                aria-label="Go back"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg hover:bg-white/20"
              >
                ←
              </button>
            )}
            <Link to="/" className="flex items-center gap-3">
              <Logo />
              <div className="leading-tight">
                <div className="text-lg font-bold tracking-tight">FIRESTONE</div>
                <div className="text-[10px] uppercase tracking-widest opacity-80">Bank of USA</div>
              </div>
            </Link>
          </div>
          <nav className="hidden items-center gap-4 text-xs font-medium md:flex">
            <Link to="/" className="opacity-90 hover:opacity-100">Dashboard</Link>
            <Link to="/loans" className="opacity-90 hover:opacity-100">Loans</Link>
            <Link to="/investments" className="opacity-90 hover:opacity-100">Investments</Link>
            <Link to="/support" className="opacity-90 hover:opacity-100">24/7 Support</Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">John Doe</span>
            <button className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20">Logout</button>
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
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        © 2026 Firestone Bank of USA. Member FDIC. Equal Housing Lender.
      </footer>
    </div>
  );
}
