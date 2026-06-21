import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { holderStore } from "@/lib/store";
import { authStore, useAuth } from "@/lib/auth";
import { signIn } from "@/lib/user.functions";
import { BrandLogo } from "@/components/BrandLogo";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FinextHub Bank of USA — Secure Online Banking" },
      { name: "description", content: "Welcome to FinextHub Bank of USA. Sign in to manage accounts, transfer funds, apply for loans, and invest." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signInFn = useServerFn(signIn);

  useEffect(() => {
    if (isLoggedIn) {
      navigate({ to: "/dashboard" });
    }
  }, [isLoggedIn, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const user = await signInFn({ data: { email, password } });
      authStore.setUser(user);
      holderStore.set(user.name);
      navigate({ to: "/dashboard" });
    } catch (err: any) { setError(err?.message ?? "Sign in failed."); }
    finally { setBusy(false); }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 font-sans text-white">
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?auto=format&fit=crop&w=1920&q=70')" }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-red-950/90 via-slate-950/85 to-slate-900/90" />
      <div className="absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(circle_at_20%_30%,rgba(251,191,36,0.25),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(220,38,38,0.35),transparent_45%)]" />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-3">
          <BrandLogo height="h-10" className="text-white/60" />
          <div className="leading-tight">
            <div className="text-xl font-bold tracking-tight">FINEXTHUB</div>
            <div className="text-[10px] uppercase tracking-[0.3em] opacity-80">Bank of USA · Since 1892</div>
          </div>
        </div>
        <div className="hidden gap-5 text-xs font-medium opacity-90 md:flex">
          <span>FDIC Insured</span><span>Equal Housing Lender</span><span>256-bit SSL</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 lg:grid-cols-2 lg:items-center">
        {/* Hero */}
        <div className="max-w-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Live banking · 24/7
          </div>
          <h1 className="mb-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Your money,<br />
            <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">secured.</span>
          </h1>
          <p className="mb-6 text-base text-white/70 leading-relaxed">
            Real-time banking with zero monthly fees. Open your account in minutes — FDIC-insured up to $250,000.
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-white/60">
            {["256-bit encryption", "Instant transfers", "Live market data", "24/7 support"].map((f) => (
              <span key={f} className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span>{f}</span>
            ))}
          </div>
        </div>

        {/* Sign in card */}
        <div className="w-full max-w-sm mx-auto lg:mx-0 lg:ml-auto">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-7 shadow-2xl backdrop-blur-xl">
            <div className="mb-1 text-xs uppercase tracking-widest text-amber-300">Online Banking</div>
            <h2 className="mb-4 text-xl font-bold">Sign in to your account</h2>

            {error && (
              <div className="mb-3 rounded-md border border-red-300/40 bg-red-500/15 px-3 py-2 text-sm text-red-100">{error}</div>
            )}

            <form onSubmit={handleSignIn} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-white/80">Email address</span>
                <input
                  required type="email" value={email} autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-amber-300"
                  placeholder="you@example.com"
                />
              </label>
              <label className="block">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-white/80">Password</span>
                  <Link to="/forgot-password" className="text-[11px] text-amber-300 hover:underline">Forgot password?</Link>
                </div>
                <input
                  required type="password" value={password} autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-amber-300"
                />
              </label>
              <button
                type="submit" disabled={busy}
                className="mt-1 w-full rounded-md bg-gradient-to-r from-amber-400 to-amber-600 py-2.5 text-sm font-bold text-red-950 shadow-lg hover:from-amber-300 hover:to-amber-500 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy ? <><LoadingSpinner size="sm" /> Signing in…</> : "Sign in securely"}
              </button>
            </form>

            <div className="mt-4 border-t border-white/10 pt-4 text-center text-xs text-white/60">
              New to FinextHub?{" "}
              <Link to="/signup" className="font-semibold text-amber-300 hover:underline">Open a free account</Link>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-6 text-[11px] text-white/40">
            <span>FDIC Insured</span>
            <span>Equal Housing Lender</span>
            <span>Member FDIC</span>
          </div>
        </div>
      </main>
    </div>
  );
}

