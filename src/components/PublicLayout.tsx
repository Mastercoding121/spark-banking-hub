import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { type ReactNode } from "react";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 font-sans text-white">
      {/* Background */}
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?auto=format&fit=crop&w=1920&q=70')" }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-red-950/90 via-slate-950/85 to-slate-900/90" />
      <div className="absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(circle_at_20%_30%,rgba(251,191,36,0.25),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(220,38,38,0.35),transparent_45%)]" />

      {/* Public Header */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-3">
          <BrandLogo height="h-10" className="text-white/60" />
          <div className="leading-tight">
            <div className="text-xl font-bold tracking-tight">FINEXTHUB</div>
            <div className="text-[10px] uppercase tracking-[0.3em] opacity-80">Bank of USA · Since 1892</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-xs font-medium text-white/90 hover:text-amber-300 transition"
          >
            Home
          </Link>
          <Link
            to="/signup"
            className="text-xs font-bold text-amber-300 hover:underline"
          >
            Sign Up
          </Link>
          <Link
            to="/"
            className="rounded-md bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2 text-xs font-bold text-red-950 shadow-lg hover:from-amber-300 hover:to-amber-500 transition"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Page Content */}
      <main>{children}</main>

      {/* Public Footer (Desktop) */}
      <footer className="hidden md:block mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs text-white/50">
          <span>© 2026 FinextHub Bank of USA · Member FDIC · Equal Housing Lender</span>
        </div>
      </footer>
    </div>
  );
}
