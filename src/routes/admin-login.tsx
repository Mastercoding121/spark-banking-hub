import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminLogin } from "@/lib/admin.functions";
import { authStore } from "@/lib/auth";
import { holderStore } from "@/lib/store";
import { PublicLayout } from "@/components/PublicLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin Login - FinextHub Bank of USA" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const loginFn = useServerFn(adminLogin);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const adminUser = await loginFn({ data: { password } });
      authStore.setUser(adminUser);
      holderStore.set(adminUser.name);
      navigate({ to: "/admin" });
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-7 shadow-2xl backdrop-blur-xl">
          <div className="mb-1 text-xs uppercase tracking-widest text-amber-300">
            Admin Access Only
          </div>
          <h2 className="mb-4 text-xl font-bold text-white">
            Sign in to Admin Panel
          </h2>

          {error && (
            <div className="mb-3 rounded-md border border-red-300/40 bg-red-500/15 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/80">
                Admin Password
              </span>
              <input
                required
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-amber-300"
                placeholder="Enter admin password"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-amber-400 to-amber-600 px-4 py-2.5 text-sm font-bold text-red-950 shadow-lg hover:from-amber-300 hover:to-amber-500 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" /> Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-4 border-t border-white/10 pt-4 text-center text-xs text-white/60">
            Need to access your user account?{" "}
            <a href="/login" className="font-semibold text-amber-300 hover:underline">
              Go to User Login
            </a>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

