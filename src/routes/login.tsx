import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { holderStore } from "@/lib/store";
import { authStore, useAuth } from "@/lib/auth";
import { signIn, getSession } from "@/lib/user.functions";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PublicLayout } from "@/components/PublicLayout";
import { EnhancedLoadingScreen } from "@/components/EnhancedLoadingScreen";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — FinextHub Bank of USA" },
      { name: "description", content: "Sign in to your FinextHub account to manage your finances, transfer funds, and more." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { isLoggedIn, user, setUser, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const hasStartedRedirect = useRef(false);

  const signInFn = useServerFn(signIn);
  const getSessionFn = useServerFn(getSession);

  // Validate stored user with server on load
  useEffect(() => {
    async function validateSession() {
      try {
        const serverUser = await getSessionFn();
        if (serverUser) {
          if (!user || user.id !== serverUser.id) {
            setUser(serverUser);
          }
        } else {
          signOut();
        }
      } catch (e) {
        signOut();
      } finally {
        setIsValidating(false);
      }
    }
    validateSession();
  }, [getSessionFn, user, setUser, signOut]);

  useEffect(() => {
    if (isValidating) return;
    if (isLoggedIn && user && !hasStartedRedirect.current) {
      hasStartedRedirect.current = true;
      setIsRedirecting(true);
      const timer = setTimeout(() => {
        navigate({ to: user.isAdmin ? "/admin" : "/dashboard" });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, user, navigate, isValidating]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await signInFn({ data: { email, password } });
      authStore.setUser(user);
      holderStore.set(user.name);
      navigate({ to: user.isAdmin ? "/admin" : "/dashboard" });
    } catch (err: any) { setError(err?.message ?? "Sign in failed."); }
    finally { setBusy(false); }
  };

  if (isValidating || isRedirecting) {
    return <EnhancedLoadingScreen title="Loading…" subtitle="Please wait while we prepare your account." />;
  }

  return (
    <PublicLayout>
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
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
      </div>
    </PublicLayout>
  );
}
