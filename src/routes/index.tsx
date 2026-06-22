import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { holderStore } from "@/lib/store";
import { authStore, useAuth } from "@/lib/auth";
import { signIn } from "@/lib/user.functions";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PublicLayout } from "@/components/PublicLayout";
import { EnhancedLoadingScreen } from "@/components/EnhancedLoadingScreen";

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
  const [isRedirecting, setIsRedirecting] = useState(false);

  const signInFn = useServerFn(signIn);

  useEffect(() => {
    if (isLoggedIn && !isRedirecting) {
      setIsRedirecting(true);
      const timer = setTimeout(() => {
        navigate({ to: "/dashboard" });
      }, 2500); // 2.5 seconds
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, navigate, isRedirecting]);

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

  if (isRedirecting) {
    return (
      <EnhancedLoadingScreen
        title="Redirecting to your dashboard…"
        subtitle="Please wait while we prepare your account."
      />
    );
  }

  return (
    <PublicLayout>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 lg:grid-cols-2 lg:items-center">
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
      </div>
    </PublicLayout>
  );
}
