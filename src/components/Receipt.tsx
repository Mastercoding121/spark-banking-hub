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
    return () => window.removeEventListener("keydown", onKey);
  }, [receipt, onClose]);

  if (!receipt) return null;
  const d = new Date(receipt.date);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-red-700 to-red-900 px-5 py-4 text-white">
          <div className="text-[10px] uppercase tracking-widest opacity-80">Firestone Bank of USA</div>
          <div className="mt-1 text-lg font-bold">{receipt.title}</div>
          <div className="text-xs opacity-90">{d.toLocaleString()}</div>
        </div>
        <div className="space-y-2 px-5 py-4 text-sm">
          <Row k="Status" v={<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{receipt.status}</span>} />
          <Row k="Amount" v={<span className="text-lg font-bold">${receipt.amount.toFixed(2)}</span>} />
          <Row k="Method" v={receipt.method} />
          <Row k="From" v={receipt.from} />
          <Row k="To" v={receipt.to} />
          <Row k="Reference" v={<span className="font-mono text-xs">{receipt.reference}</span>} />
          {receipt.memo && <Row k="Memo" v={receipt.memo} />}
        </div>
        <div className="border-t border-dashed border-slate-300 px-5 py-3 text-center text-[10px] uppercase tracking-widest text-slate-500">
          Thank you · Member FDIC
        </div>
        <div className="flex gap-2 px-5 pb-4">
          <button onClick={() => window.print()} className="flex-1 rounded-md border border-slate-300 py-2 text-xs font-medium hover:bg-slate-50">Print</button>
          <button onClick={onClose} className="flex-1 rounded-md bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800">Done</button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-wide text-slate-500">{k}</span>
      <span className="text-right text-slate-900">{v}</span>
    </div>
  );
}
