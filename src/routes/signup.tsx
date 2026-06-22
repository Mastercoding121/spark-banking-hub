import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { authStore, SECURITY_QUESTIONS } from "@/lib/auth";
import { holderStore } from "@/lib/store";
import { signUp } from "@/lib/user.functions";
import { ClientOnly } from "@/components/ClientOnly";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PublicLayout } from "@/components/PublicLayout";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Open an Account — FinextHub Bank of USA" },
      { name: "description", content: "Open a new FinextHub Bank checking account in minutes. Secure online sign up with 256-bit SSL." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirm: "",
    securityQuestion: SECURITY_QUESTIONS[0], securityAnswer: "", agree: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signUpFn = useServerFn(signUp);
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (form.password !== form.confirm) return setError("Passwords don't match.");
    if (!form.agree) return setError("You must accept the terms to open an account.");
    setBusy(true);
    try {
      const user = await signUpFn({
        data: {
          email: form.email, name: form.name, password: form.password,
          securityQuestion: form.securityQuestion, securityAnswer: form.securityAnswer,
        },
      });
      authStore.setUser(user);
      holderStore.set(user.name);
      navigate({ to: "/verify", search: { email: form.email.trim().toLowerCase() } });
    } catch (err: any) { setError(err?.message ?? "Could not create account."); }
    finally { setBusy(false); }
  };

  return (
    <ClientOnly>
      <PublicLayout>
        <div className="mx-auto max-w-2xl px-4 pb-12">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="text-xs uppercase tracking-widest text-amber-300">Open an account</div>
            <h1 className="mb-1 text-2xl font-bold sm:text-3xl">Welcome to FinextHub</h1>
            <p className="mb-5 text-sm text-white/80">Federally insured. No monthly fees. Approved instantly.</p>

            {error && <div className="mb-4 rounded-md border border-red-300/40 bg-red-500/15 px-3 py-2 text-sm text-red-100">{error}</div>}

            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
              <Field label="Full legal name" className="sm:col-span-2">
                <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="Jane A. Doe" />
              </Field>
              <Field label="Email address" className="sm:col-span-2">
                <input required type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} placeholder="you@example.com" />
              </Field>
              <Field label="Password">
                <input required type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} className={inputCls} placeholder="At least 8 characters" />
              </Field>
              <Field label="Confirm password">
                <input required type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Security question" className="sm:col-span-2">
                <select value={form.securityQuestion} onChange={(e) => set("securityQuestion", e.target.value)} className={inputCls}>
                  {SECURITY_QUESTIONS.map((q) => <option key={q} value={q} className="bg-slate-900">{q}</option>)}
                </select>
              </Field>
              <Field label="Your answer" className="sm:col-span-2">
                <input required value={form.securityAnswer} onChange={(e) => set("securityAnswer", e.target.value)} className={inputCls} placeholder="Used to recover your password" />
              </Field>
              <label className="mt-1 flex items-start gap-2 text-xs text-white/80 sm:col-span-2">
                <input type="checkbox" checked={form.agree} onChange={(e) => set("agree", e.target.checked)} className="mt-0.5" />
                I agree to the FinextHub Bank Terms, Privacy Notice, and electronic disclosures.
              </label>
              <button disabled={busy} type="submit" className="mt-2 w-full rounded-md bg-gradient-to-r from-amber-400 to-amber-600 py-2.5 text-sm font-bold text-red-950 shadow-lg hover:from-amber-300 hover:to-amber-500 disabled:opacity-60 sm:col-span-2 flex items-center justify-center gap-2">
                {busy ? <><LoadingSpinner size="sm" /> Opening your account…</> : "Open my account"}
              </button>
              <p className="text-center text-xs text-white/70 sm:col-span-2">
                Already a member? <Link to="/" className="font-semibold text-amber-300 hover:underline">Sign in</Link>
              </p>
            </form>
          </div>
        </div>
      </PublicLayout>
    </ClientOnly>
  );
}

const inputCls = "w-full rounded-md border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-white/40 outline-none focus:border-amber-300";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-white/80">{label}</span>
      {children}
    </label>
  );
}
