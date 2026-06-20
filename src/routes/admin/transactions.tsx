import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listAllTransactions, adminDeleteTransaction } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/transactions")({
  head: () => ({ meta: [{ title: "Transactions — FinextHub Admin" }] }),
  component: AdminTransactions,
});

function AdminTransactions() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllTransactions);
  const deleteFn = useServerFn(adminDeleteTransaction);

  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const { data: all = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-all-transactions"],
    queryFn: () => listFn({}),
  });

  const fb = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 3000); };

  const filtered = all.filter(
    (t) =>
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      (t.userName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (t.userEmail ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async (txId: string, userId: string) => {
    if (!confirm("Delete this transaction? The balance will be reversed.")) return;
    try {
      await deleteFn({ data: { transactionId: txId, userId } });
      qc.invalidateQueries({ queryKey: ["admin-all-transactions"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      fb("Transaction deleted.");
    } catch (e: any) { fb(e?.message ?? "Failed."); }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Transactions</h1>
          <p className="text-sm text-white/60">{all.length} total records</p>
        </div>
        <button onClick={() => refetch()} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">↺ Refresh</button>
      </div>

      {feedback && <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">{feedback}</div>}

      <input
        value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search description or user…"
        className="mb-4 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm placeholder-white/40 focus:border-amber-400 focus:outline-none"
      />

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" />)}</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-white/50">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Acct</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Delete</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-white/40">No transactions found.</td></tr>
                )}
                {visible.map((t) => (
                  <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-2.5 text-xs text-white/50">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      <div className="text-xs font-medium">{t.userName}</div>
                      <div className="text-[11px] text-white/40">{t.userEmail}</div>
                    </td>
                    <td className="px-4 py-2.5 font-medium">{t.description}</td>
                    <td className="px-4 py-2.5 text-xs text-white/60">{t.category}</td>
                    <td className="px-4 py-2.5 text-xs text-white/60 capitalize">{t.accountType}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${Number(t.amount) > 0 ? "text-emerald-400" : "text-white"}`}>
                      {Number(t.amount) > 0 ? "+" : ""}{Number(t.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => handleDelete(t.id, t.userId)} className="rounded bg-red-500/20 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/30">Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded border border-white/20 px-3 py-1 text-xs disabled:opacity-40 hover:bg-white/10">← Prev</button>
              <span className="text-xs text-white/60">Page {page} of {pages}</span>
              <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page === pages} className="rounded border border-white/20 px-3 py-1 text-xs disabled:opacity-40 hover:bg-white/10">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
