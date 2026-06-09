import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { requestBiometric, useSecurity } from "@/lib/security";

export function SecurityPrompt({
  open,
  amount,
  onCancel,
  onApprove,
}: {
  open: boolean;
  amount: number;
  onCancel: () => void;
  onApprove: () => void;
}) {
  const { pin, biometrics } = useSecurity();
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setEntry(""); setError(null); setBusy(false); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  if (!open) return null;

  const hasPin = pin.length >= 4;

  const verify = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!hasPin) return setError("Set a transaction PIN in Profile first.");
    if (entry !== pin) return setError("Incorrect PIN. Try again.");
    onApprove();
  };

  const useBio = async () => {
    setBusy(true); setError(null);
    const ok = await requestBiometric();
    setBusy(false);
    if (ok) onApprove();
    else setError("Biometric authentication failed.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-[10px] uppercase tracking-widest text-red-700">Security verification</div>
        <h3 className="text-lg font-bold">Authorize ${amount.toFixed(2)}</h3>
        <p className="mt-1 text-xs text-slate-500">For your protection, confirm this transaction with your PIN{biometrics ? " or biometrics" : ""}.</p>

        {!hasPin ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            No PIN is set yet. <Link to="/profile" className="font-semibold underline">Open Profile</Link> to create one.
          </div>
        ) : (
          <form onSubmit={verify} className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Transaction PIN</span>
              <input
                ref={inputRef}
                value={entry}
                onChange={(e) => setEntry(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••"
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-center text-2xl tracking-[0.6em]"
              />
            </label>
            {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
            <button type="submit" className="w-full rounded-md bg-gradient-to-r from-red-700 to-red-800 py-2.5 text-sm font-semibold text-white">
              Verify & Send
            </button>
          </form>
        )}

        {biometrics && (
          <button
            type="button"
            onClick={useBio}
            disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            <span className="text-lg">👆</span> {busy ? "Waiting for sensor…" : "Use Face ID / Touch ID"}
          </button>
        )}

        <button onClick={onCancel} className="mt-2 w-full rounded-md py-2 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
      </div>
    </div>
  );
}
