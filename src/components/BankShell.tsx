import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function BankShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-gradient-to-r from-red-700 to-red-900 text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/15 backdrop-blur">
              <span className="text-xl font-bold">F</span>
            </div>
            <div className="leading-tight">
              <div className="text-lg font-bold tracking-tight">FIRESTONE</div>
              <div className="text-[10px] uppercase tracking-widest opacity-80">Bank of USA</div>
            </div>
          </Link>
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
