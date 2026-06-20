import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { isEmailVerified, markEmailVerified } from "@/lib/otp";
import { holderStore } from "@/lib/store";
import { authStore } from "@/lib/auth";
import { sendOtp, verifyOtp } from "@/lib/otp.functions";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [{ title: "Verify Your Identity — FinextHub Bank" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s.email === "string" ? s.email : "",
  }),
  component: VerifyPage,
});

const OTP_LENGTH = 6;
const RESEND_SECS = 30;

function VerifyPage() {
  const navigate = useNavigate();
  const { email } = Route.useSearch();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [shake, setShake] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECS);
  const [emailSent, setEmailSent] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const sendFn = useServerFn(sendOtp);
  const verifyFn = useServerFn(verifyOtp);

  const sendMut = useMutation({
    mutationFn: (vars: { email: string; name?: string }) => sendFn({ data: vars }),
    onSuccess: () => { setEmailSent(true); setError(null); },
    onError: (e: any) => setError(e?.message ?? "Failed to send email."),
  });

  const verifyMut = useMutation({
    mutationFn: (vars: { email: string; code: string }) => verifyFn({ data: vars }),
    onSuccess: () => {
      markEmailVerified(email);
      const user = authStore.current();
      if (user) holderStore.set(user.name);
      setVerified(true);
      setTimeout(() => navigate({ to: "/dashboard" }), 1800);
    },
    onError: (e: any) => {
      setError(e?.message ?? "Verification failed.");
      triggerShake();
      setDigits(Array(OTP_LENGTH).fill(""));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    },
  });

  useEffect(() => {
    if (!email) { navigate({ to: "/" }); return; }
    if (isEmailVerified(email)) {
      const user = authStore.current();
      if (user) holderStore.set(user.name);
      navigate({ to: "/dashboard" });
      return;
    }
    const user = authStore.current();
    sendMut.mutate({ email, name: user?.name });
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleInput = useCallback((idx: number, val: string) => {
    const ch = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = ch;
    setDigits(next);
    setError(null);
    if (ch && idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  }, [digits]);

  const handleKeyDown = useCallback((idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[idx]) {
        const next = [...digits]; next[idx] = ""; setDigits(next);
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < OTP_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  }, [digits]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!paste) return;
    const next = Array(OTP_LENGTH).fill("");
    paste.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    inputRefs.current[Math.min(paste.length, OTP_LENGTH - 1)]?.focus();
  }, []);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = digits.join("");
    if (entered.length < OTP_LENGTH) {
      setError("Please enter all 6 digits.");
      triggerShake();
      return;
    }
    verifyMut.mutate({ email, code: entered });
  };

  const handleResend = () => {
    if (countdown > 0 || sendMut.isPending) return;
    const user = authStore.current();
    sendMut.mutate({ email, name: user?.name });
    setCountdown(RESEND_SECS);
    setDigits(Array(OTP_LENGTH).fill(""));
    setError(null);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }

  const filled = digits.filter(Boolean).length;
  const isBusy = sendMut.isPending || verifyMut.isPending;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040a14] font-sans text-white selection:bg-amber-400/30">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap" />

      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-20 h-[500px] w-[500px] rounded-full bg-red-700/15 blur-[100px]" />
        <div className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-amber-400/5 blur-[80px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(rgba(251,191,36,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.6) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Header */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full bg-[conic-gradient(from_0deg,theme(colors.amber.300),theme(colors.red.500),theme(colors.amber.300))] p-[2px]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[#040a14]">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 2 L20 6 V12 C20 17 16 21 12 22 C8 21 4 17 4 12 V6 Z" fill="rgba(251,191,36,0.12)" />
                  <path d="M8.5 12 h7 M8.5 14.5 h7 M12 9 v8" />
                  <circle cx="12" cy="9" r="1.1" fill="currentColor" stroke="none" />
                </svg>
              </div>
            </div>
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>FINEXTHUB</div>
            <div className="text-[9px] uppercase tracking-[0.3em] text-white/50">Bank of USA</div>
          </div>
        </Link>
        <Link to="/" className="text-xs text-white/50 transition hover:text-amber-300">← Back to sign in</Link>
      </header>

      {/* Main */}
      <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-10">

        {/* Step indicator */}
        <div className="mb-8 flex items-center gap-2 text-xs">
          <StepDot label="Account" done />
          <div className="h-px w-6 bg-white/20" />
          <StepDot label="Verify" active />
          <div className="h-px w-6 bg-white/20" />
          <StepDot label="Dashboard" num={3} />
        </div>

        <div className="w-full rounded-3xl border border-white/[0.07] bg-white/[0.04] shadow-2xl shadow-black/60 backdrop-blur-2xl">
          {verified ? (
            <SuccessState />
          ) : (
            <div className="p-8 sm:p-10">

              {/* Envelope icon */}
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 animate-[ping_2s_ease-in-out_infinite] rounded-full bg-amber-400/15" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/20 ring-1 ring-amber-400/30">
                    <svg className="h-8 w-8 text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Headline */}
              <div className="mb-1 text-center text-[10px] uppercase tracking-[0.35em] text-amber-400/70" style={{ fontFamily: "'Space Mono', monospace" }}>
                Identity Verification
              </div>
              <h1 className="mb-2 text-center text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Check your inbox
              </h1>

              {/* Send state messaging */}
              {sendMut.isPending && !emailSent ? (
                <div className="mb-6 flex flex-col items-center gap-2">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <p className="text-sm text-white/50">Sending verification email…</p>
                </div>
              ) : (
                <>
                  <p className="mb-1 text-center text-sm text-white/50">We sent a 6-digit code to</p>
                  <p className="mb-6 text-center text-sm font-semibold text-amber-300 break-all">{email || "your email"}</p>
                </>
              )}

              {/* Error from send */}
              {sendMut.isError && (
                <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
                  {(sendMut.error as any)?.message ?? "Failed to send email."}
                  <button
                    type="button"
                    onClick={() => { const user = authStore.current(); sendMut.mutate({ email, name: user?.name }); }}
                    className="ml-2 underline underline-offset-2 hover:text-red-200"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* OTP digit inputs */}
              <form onSubmit={handleVerify}>
                <div
                  className="mb-2 flex justify-center gap-2 sm:gap-3"
                  style={shake ? { animation: "shake 0.5s ease-in-out" } : {}}
                >
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      disabled={isBusy || sendMut.isError}
                      onChange={(e) => handleInput(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={handlePaste}
                      onFocus={(e) => e.target.select()}
                      autoFocus={i === 0}
                      className={`h-12 w-10 rounded-xl border text-center text-xl font-bold outline-none transition-all sm:h-14 sm:w-12 sm:text-2xl disabled:opacity-40 ${
                        d
                          ? "border-amber-400/70 bg-amber-400/10 text-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.25)]"
                          : "border-white/10 bg-white/[0.04] text-white"
                      } focus:border-amber-400/80 focus:bg-amber-400/[0.08] focus:shadow-[0_0_18px_rgba(251,191,36,0.3)]`}
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    />
                  ))}
                </div>

                {/* Fill progress bar */}
                <div className="mb-4 h-0.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
                    style={{ width: `${(filled / OTP_LENGTH) * 100}%` }}
                  />
                </div>

                {error && (
                  <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-center text-sm text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={filled < OTP_LENGTH || isBusy || sendMut.isError}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 py-3 text-sm font-bold text-red-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-300 hover:to-amber-500 hover:shadow-amber-400/30 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {verifyMut.isPending ? "Verifying…" : "Verify & Continue →"}
                </button>
              </form>

              {/* Resend */}
              <div className="mt-5 text-center text-xs text-white/40">
                Didn&apos;t get it?{" "}
                {countdown > 0 ? (
                  <span>
                    Resend in{" "}
                    <span className="font-semibold tabular-nums text-amber-400/80" style={{ fontFamily: "'Space Mono', monospace" }}>
                      {countdown}s
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={sendMut.isPending}
                    className="font-semibold text-amber-300 underline underline-offset-2 transition hover:text-amber-200 disabled:opacity-50"
                  >
                    {sendMut.isPending ? "Sending…" : "Resend code"}
                  </button>
                )}
              </div>

              {/* Security badge */}
              <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-white/25">
                <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                256-bit encrypted · Code expires in 10 minutes
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          Wrong email?{" "}
          <Link to="/signup" className="text-amber-400/60 underline underline-offset-2 transition hover:text-amber-300">
            Create a new account
          </Link>
        </p>
      </main>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          30% { transform: translateX(6px); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
          90% { transform: translateX(2px); }
        }
      `}</style>
    </div>
  );
}

function StepDot({ label, done, active, num }: { label: string; done?: boolean; active?: boolean; num?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
          done
            ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
            : active
            ? "bg-amber-400 text-red-950 shadow-[0_0_10px_rgba(251,191,36,0.4)]"
            : "bg-white/10 text-white/30 ring-1 ring-white/10"
        }`}
      >
        {done ? "✓" : active ? "2" : num ?? "3"}
      </div>
      <span
        className={`text-xs font-medium ${done ? "text-white/40" : active ? "text-amber-300" : "text-white/30"}`}
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {label}
      </span>
    </div>
  );
}

function SuccessState() {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 ring-2 ring-emerald-400/40">
          <svg className="h-10 w-10 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <div className="mb-2 text-[10px] uppercase tracking-[0.35em] text-emerald-400/80" style={{ fontFamily: "'Space Mono', monospace" }}>
        Verified
      </div>
      <h2 className="mb-2 text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        Identity Confirmed
      </h2>
      <p className="text-sm text-white/50">Taking you to your dashboard…</p>
      <div className="mt-6 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}
