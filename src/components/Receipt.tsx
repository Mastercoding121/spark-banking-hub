import { useEffect } from "react";

export type ReceiptData = {
  title: string;
  reference: string;
  amount: number;
  method: string;
  from: string;
  to: string;
  status: string;
  date: string; // ISO
  memo?: string;
};

export function ReceiptModal({ receipt, onClose }: { receipt: ReceiptData | null; onClose: () => void }) {
  useEffect(() => {
    if (!receipt) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [receipt, onClose]);

  if (!receipt) return null;
  const d = new Date(receipt.date);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 bg-gradient-to-br from-red-700 to-red-900 px-4 py-4 text-white sm:px-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest opacity-80">Firestone Bank of USA</div>
              <div className="mt-1 truncate text-base font-bold sm:text-lg">{receipt.title}</div>
              <div className="text-xs opacity-90">{d.toLocaleString()}</div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-base leading-none hover:bg-white/25"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4 text-sm sm:px-5">
          <Row k="Status" v={<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{receipt.status}</span>} />
          <Row k="Amount" v={<span className="text-lg font-bold">${receipt.amount.toFixed(2)}</span>} />
          <Row k="Method" v={receipt.method} />
          <Row k="From" v={receipt.from} />
          <Row k="To" v={receipt.to} />
          <Row k="Reference" v={<span className="break-all font-mono text-xs">{receipt.reference}</span>} />
          {receipt.memo && <Row k="Memo" v={<span className="break-words">{receipt.memo}</span>} />}
        </div>

        <div className="shrink-0 border-t border-dashed border-slate-300 px-4 py-2 text-center text-[10px] uppercase tracking-widest text-slate-500 sm:px-5">
          Thank you · Member FDIC
        </div>
        <div className="shrink-0 flex gap-2 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 sm:px-5 sm:pb-4">
          <button onClick={() => window.print()} className="flex-1 rounded-md border border-slate-300 py-2.5 text-xs font-medium hover:bg-slate-50">Print</button>
          <button onClick={onClose} className="flex-1 rounded-md bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800">Done</button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs uppercase tracking-wide text-slate-500">{k}</span>
      <span className="min-w-0 break-words text-right text-slate-900">{v}</span>
    </div>
  );
}
