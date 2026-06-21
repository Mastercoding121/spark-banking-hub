import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { BrandLogo } from "./BrandLogo";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate({ to: "/" });
    }
  }, [isLoggedIn, navigate]);

  if (!isLoggedIn) {
    return null;
  }

  return <>{children}</>;
}

// Layout wrapper for protected routes (with nav)
export function ProtectedLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-3">
          <BrandLogo height="h-10" className="text-white/60" />
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight">FINEXTHUB</div>
            <div className="text-[10px] uppercase tracking-[0.3em] opacity-80">Bank of USA</div>
          </div>
        </div>
        <nav className="flex items-center gap-6">
          <a href="/dashboard" className="text-sm text-white/80 hover:text-amber-300">Dashboard</a>
          <a href="/wallet" className="text-sm text-white/80 hover:text-amber-300">Wallet</a>
          <a href="/downloads" className="text-sm text-white/80 hover:text-amber-300">Downloads</a>
          <a href="/profile" className="text-sm text-white/80 hover:text-amber-300">Profile</a>
          {user?.isAdmin && (
            <a href="/admin" className="text-sm text-amber-300 hover:text-amber-200">Admin</a>
          )}
          <button
            onClick={handleLogout}
            className="rounded-md bg-white/10 px-4 py-2 text-xs font-medium hover:bg-white/20"
          >
            Sign Out
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
