import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { type ReactNode } from "react";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-red-900 text-white">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-amber-500/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-20 h-[500px] w-[500px] rounded-full bg-red-700/15 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandLogo height="h-14" />
            <div className="hidden sm:block">
              <div className="text-base font-bold tracking-tight">FINEXTHUB</div>
              <div className="text-[9px] uppercase tracking-[0.25em] text-white/60">Bank of USA</div>
            </div>
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/" className="text-sm font-medium text-white/80 hover:text-amber-300 transition">Sign in</Link>
            <Link
              to="/signup"
              className="rounded-md bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2 text-sm font-bold text-red-950 shadow-lg hover:from-amber-300 hover:to-amber-500 transition"
            >
              Open account
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main>{children}</main>

      {/* Footer (desktop only) */}
      <footer className="hidden border-t border-white/10 bg-white/5 py-6 md:block">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-white/50">
          <span>© 2026 FinextHub Bank of USA · Member FDIC · Equal Housing Lender</span>
        </div>
      </footer>
    </div>
  );
}
