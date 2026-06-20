import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authStore } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — FinextHub Bank of USA" },
      { name: "description", content: "Securely reset your FinextHub Bank online banking password." },
    ],
  }),
  component: ForgotPage,
});

type Step = "email" | "verify" | "done";

function ForgotPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const r = await authStore.lookupForReset(email);
      setQuestion(r.securityQuestion); setStep("verify");
    } catch (e: any) { setErr(e?.message ?? "Could not find account."); }
    finally { setBusy(false); }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    if (pw !== confirm) return setErr("Passwords don't match.");
    setBusy(true);
    try {
      await authStore.resetPassword(email, answer, pw);
      setStep("done");
    } catch (e: any) { setErr(e?.message ?? "Could not reset password."); }
    finally { setBusy(false); }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 font-sans text-white">
      <div className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?auto=format&fit=crop&w=1920&q=70')" }} />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-red-950/90 via-slate-950/85 to-slate-900/90" />

      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-10 w-10 animate-[spin_6s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,theme(colors.amber.300),theme(colors.red.500),theme(colors.amber.300))] p-[2px]">
            <div className="h-full w-full rounded-full bg-red-950" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight">FIRESTONE</div>
            <div className="text-[10px] uppercase tracking-[0.3em] opacity-80">Bank of USA</div>
          </div>
        </Link>
        <Link to="/" className="text-xs text-white/80 hover:text-amber-300">← Back to sign in</Link>
      </header>

      <main className="mx-auto max-w-md px-4 pb-12">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <div className="text-xs uppercase tracking-widest text-amber-300">Account recovery</div>
          <h1 className="mb-1 text-2xl font-bold">Reset your password</h1>
          <p className="mb-5 text-sm text-white/80">For your protection, we'll verify your identity with your security question.</p>

          {err && <div className="mb-4 rounded-md border border-red-300/40 bg-red-500/15 px-3 py-2 text-sm text-red-100">{err}</div>}

          {step === "email" && (
            <form onSubmit={lookup} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-white/80">Email on file</span>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
              </label>
              <button disabled={busy} className="w-full rounded-md bg-gradient-to-r from-amber-400 to-amber-600 py-2.5 text-sm font-bold text-red-950 shadow-lg disabled:opacity-60">
                {busy ? "Looking up…" : "Continue"}
              </button>
            </form>
          )}

          {step === "verify" && (
            <form onSubmit={reset} className="space-y-3">
              <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                <strong>Security question:</strong> {question}
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-white/80">Your answer</span>
                <input required value={answer} onChange={(e) => setAnswer(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-white/80">New password</span>
                <input required type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} placeholder="At least 8 characters" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-white/80">Confirm new password</span>
                <input required type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
              </label>
              <button disabled={busy} className="w-full rounded-md bg-gradient-to-r from-amber-400 to-amber-600 py-2.5 text-sm font-bold text-red-950 shadow-lg disabled:opacity-60">
                {busy ? "Updating…" : "Reset password"}
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-3xl">✓</div>
              <div>
                <div className="text-lg font-semibold">Password updated</div>
                <p className="text-sm text-white/80">You can now sign in with your new password.</p>
              </div>
              <button onClick={() => navigate({ to: "/" })} className="w-full rounded-md bg-gradient-to-r from-amber-400 to-amber-600 py-2.5 text-sm font-bold text-red-950 shadow-lg">
                Go to sign in
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-amber-300";
