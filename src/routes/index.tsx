import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { holderStore } from "@/lib/store";
import { authStore } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Firestone Bank of USA — Secure Online Banking" },
      { name: "description", content: "Welcome to Firestone Bank of USA. Sign in to manage accounts, transfer funds, apply for loans, and invest." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const user = await authStore.signIn(email, password);
      holderStore.set(user.name);
      navigate({ to: "/dashboard" });
    } catch (err: any) { setError(err?.message ?? "Sign in failed."); }
    finally { setBusy(false); }
  };


  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 font-sans text-white">
      {/* Bank background: layered gradients, columns, marble */}
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?auto=format&fit=crop&w=1920&q=70')",
        }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-red-950/90 via-slate-950/85 to-slate-900/90" />
      <div className="absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(circle_at_20%_30%,rgba(251,191,36,0.25),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(220,38,38,0.35),transparent_45%)]" />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-3">
          <BigLogo />
          <div className="leading-tight">
            <div className="text-xl font-bold tracking-tight">FIRESTONE</div>
            <div className="text-[10px] uppercase tracking-[0.3em] opacity-80">Bank of USA · Since 1892</div>
          </div>
        </div>
        <div className="hidden gap-5 text-xs font-medium opacity-90 md:flex">
          <span>FDIC Insured</span><span>Equal Housing Lender</span><span>256-bit SSL</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-10 px-4 py-10 md:grid-cols-2 md:py-16">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            Banking <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">forged in trust.</span>
          </h1>
          <p className="max-w-md text-sm text-white/80 md:text-base">
            Manage checking & savings, send money instantly with Zelle, Apple Pay or Chime, apply for loans, and trade live markets — all from one secure dashboard.
          </p>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <Stat k="$48B" v="Assets" />
            <Stat k="4.25%" v="Savings APY" />
            <Stat k="24/7" v="Support" />
          </div>
        </div>

        <form
          onSubmit={handleSignIn}
          className="self-center rounded-2xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-1 text-xs uppercase tracking-widest text-amber-300">Secure sign in</div>
          <h2 className="mb-5 text-2xl font-bold">Welcome back</h2>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/80">Account holder name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-amber-300"
              required
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-white/80">Password</span>
            <input
              type="password"
              defaultValue="demo1234"
              className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-amber-300"
            />
          </label>

          <button
            type="submit"
            className="mt-5 w-full rounded-md bg-gradient-to-r from-amber-400 to-amber-600 py-2.5 text-sm font-bold text-red-950 shadow-lg transition hover:from-amber-300 hover:to-amber-500"
          >
            Sign in to Online Banking
          </button>
          <div className="mt-3 flex justify-between text-[11px] text-white/70">
            <a href="#" className="hover:text-amber-300">Forgot password?</a>
            <a href="#" className="hover:text-amber-300">Open an account</a>
          </div>

          <div className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100">
            🔒 Encrypted session · Your information is protected by 256-bit SSL.
          </div>
        </form>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-6 pt-4 text-center text-[11px] text-white/60">
        © 2026 Firestone Bank of USA. Member FDIC. Equal Housing Lender.
      </footer>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur">
      <div className="text-lg font-bold text-amber-300">{k}</div>
      <div className="text-[10px] uppercase tracking-widest text-white/70">{v}</div>
    </div>
  );
}

function BigLogo() {
  return (
    <div className="relative h-14 w-14">
      <div className="absolute inset-0 animate-ping rounded-full bg-amber-400/30" />
      <div className="absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,theme(colors.amber.300),theme(colors.red.500),theme(colors.amber.300))] p-[2px]">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-red-900 to-red-950">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-amber-300 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 L20 6 V12 C20 17 16 21 12 22 C8 21 4 17 4 12 V6 Z" fill="rgba(251,191,36,0.15)" />
            <path d="M8.5 12 h7 M8.5 14.5 h7 M12 9 v8" />
            <circle cx="12" cy="9" r="1.1" fill="currentColor" stroke="none" />
          </svg>
        </div>
      </div>
    </div>
  );
}
