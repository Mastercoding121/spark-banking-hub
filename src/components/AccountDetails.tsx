import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ACCOUNT_DETAILS } from "@/lib/store";
import { useHolder } from "@/lib/store";

export type AccountKey = "checking" | "savings";

export function AccountDetailsModal({
  accountKey,
  balance,
  onClose,
}: {
  accountKey: AccountKey | null;
  balance?: number;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!accountKey) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accountKey, onClose]);

  const holder = useHolder();
  if (!accountKey) return null;
  const a = ACCOUNT_DETAILS[accountKey];
  const bal = balance ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between bg-gradient-to-r from-red-700 to-red-900 p-5 text-white">
          <div>
            <div className="text-[11px] uppercase tracking-widest opacity-80">{ACCOUNT_DETAILS.bankName}</div>
            <div className="text-lg font-bold">{a.name}</div>
            <div className="mt-2 text-3xl font-bold">
              ${bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] opacity-80">Available balance</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full bg-white/15 px-2 text-lg leading-7 backdrop-blur hover:bg-white/25">×</button>
        </div>

        <div className="space-y-3 p-5 text-sm">
          <Row k="Account Holder" v={holder || "Guest"} />
          <Row k="Account Type" v={a.type} />
          <Row k="Branch" v={ACCOUNT_DETAILS.branch} />
          {"apy" in a && a.apy ? <Row k="APY" v={a.apy} /> : null}
          <Row k="Status" v="Active" />
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-[11px] text-slate-500">
          Keep your routing number private. Share only with trusted senders.
        </div>

        <div className="flex gap-2 p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <CopyButton accountKey={accountKey} holder={holder || "Guest"} bal={bal} />
          <button
            onClick={onClose}
            className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ accountKey, holder, bal }: { accountKey: AccountKey; holder: string; bal: number }) {
  const [copied, setCopied] = useState(false);
  const a = ACCOUNT_DETAILS[accountKey];

  const handleCopy = async () => {
    const details = [
      `Bank: ${ACCOUNT_DETAILS.bankName}`,
      `Account Holder: ${holder}`,
      `Account Name: ${a.name}`,
      `Account Type: ${a.type}`,
      `Branch: ${ACCOUNT_DETAILS.branch}`,
      "apy" in a && a.apy ? `APY: ${a.apy}` : null,
      `Available Balance: $${bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Status: Active`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      toast.success("Bank details copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy. Please copy manually.");
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
        copied ? "border-green-300 bg-green-50 text-green-700" : "border-slate-300 hover:border-red-300 hover:text-red-700"
      }`}
    >
      {copied ? "Copied!" : "Copy Bank Details"}
    </button>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-slate-500">{k}</span>
      <span className={`text-right text-sm font-semibold ${mono ? "font-mono tracking-wide" : ""}`}>{v}</span>
    </div>
  );
}
