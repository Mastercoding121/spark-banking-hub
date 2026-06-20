import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listAllTransactions, adminDeleteTransaction } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/transactions")({
  head: () => ({ meta: [{ title: "Transactions — FinextHub Admin" }] }),
  component: AdminTransactions,
});

type Tx = {
  id: string; userId: string; accountType: string; date: string;
  description: string; category: string; amount: number; createdAt: string;
  userName: string; userEmail: string;
};

function AdminTransactions() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllTransactions);
  const deleteFn = useServerFn(adminDeleteTransaction);

  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterType, setFilterType] = useState<"all" | "credit" | "debit">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const { data: all = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-all-transactions"],
    queryFn: () => listFn({}),
    refetchInterval: 20_000,
  });

  const fb = (msg: string, ok = true) => { setFeedback({ msg, ok }); setTimeout(() => setFeedback(null), 4000); };

  const categories = useMemo(() => {
    const cats = new Set(all.map((t) => t.category).filter(Boolean));
    return ["all", ...Array.from(cats).sort()];
  }, [all]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return all.filter((t) => {
      const matchSearch = !q ||
        t.description.toLowerCase().includes(q) ||
        (t.userName ?? "").toLowerCase().includes(q) ||
        (t.userEmail ?? "").toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
      const matchAccount = filterAccount === "all" || t.accountType === filterAccount;
      const matchType = filterType === "all" || (filterType === "credit" ? t.amount > 0 : t.amount < 0);
      const matchCat = filterCategory === "all" || t.category === filterCategory;
      return matchSearch && matchAccount && matchType && matchCat;
    });
  }, [all, search, filterAccount, filterType, filterCategory]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async (txId: string, userId: string) => {
    if (!confirm("Delete this transaction? The balance will be reversed.")) return;
    try {
      await deleteFn({ data: { transactionId: txId, userId } });
      qc.invalidateQueries({ queryKey: ["admin-all-transactions"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      fb("Transaction deleted.");
    } catch (e: any) { fb(e?.message ?? "Failed.", false); }
  };

  const exportCSV = () => {
    const rows = [
      ["Date", "User", "Email", "Description", "Category", "Account", "Amount"],
      ...filtered.map((t) => [
        t.date, t.userName, t.userEmail, t.description, t.category, t.accountType, t.amount.toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `finexthub-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const creditTotal = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const debitTotal = filtered.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  const resetFilters = () => { setSearch(""); setFilterAccount("all"); setFilterType("all"); setFilterCategory("all"); setPage(1); };
  const hasFilters = search || filterAccount !== "all" || filterType !== "all" || filterCategory !== "all";

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">All Transactions</h1>
          <p className="text-sm text-white/50">{filtered.length} of {all.length} records shown</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export CSV
          </button>
          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            Refresh
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-red-400/30 bg-red-400/10 text-red-300"}`}>
          {feedback.msg}
        </div>
      )}

      {/* Summary strip */}
      {!isLoading && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Filtered Records</div>
            <div className="mt-0.5 text-lg font-bold">{filtered.length}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-emerald-400/60">Total Credits</div>
            <div className="mt-0.5 text-lg font-bold text-emerald-400">+${creditTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Total Debits</div>
            <div className="mt-0.5 text-lg font-bold text-white/70">${Math.abs(debitTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search description, user, or category…"
          className="min-w-48 flex-1 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm placeholder-white/30 focus:border-amber-400 focus:outline-none"
        />
        <select value={filterAccount} onChange={(e) => { setFilterAccount(e.target.value); setPage(1); }}
          className="rounded-lg border border-white/20 bg-slate-900 px-3 py-1.5 text-sm text-white/70 focus:border-amber-400 focus:outline-none">
          <option value="all">All Accounts</option>
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
        </select>
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value as any); setPage(1); }}
          className="rounded-lg border border-white/20 bg-slate-900 px-3 py-1.5 text-sm text-white/70 focus:border-amber-400 focus:outline-none">
          <option value="all">Credits & Debits</option>
          <option value="credit">Credits only</option>
          <option value="debit">Debits only</option>
        </select>
        <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          className="rounded-lg border border-white/20 bg-slate-900 px-3 py-1.5 text-sm text-white/70 focus:border-amber-400 focus:outline-none">
          {categories.map((c) => <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>)}
        </select>
        {hasFilters && (
          <button onClick={resetFilters} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/50 hover:bg-white/10">
            Clear ✕
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-11 animate-pulse rounded-lg bg-white/5" />)}</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 bg-white/5 text-[11px] uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Acct</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-sm text-white/30">No transactions match your filters.</td></tr>
                )}
                {visible.map((t) => (
                  <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 text-xs text-white/40">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      <Link to="/admin/users/$userId" params={{ userId: t.userId }} className="text-xs font-medium hover:text-amber-300">{t.userName}</Link>
                      <div className="text-[11px] text-white/30">{t.userEmail}</div>
                    </td>
                    <td className="px-4 py-2.5 font-medium max-w-48 truncate">{t.description}</td>
                    <td className="px-4 py-2.5 text-xs text-white/50">{t.category}</td>
                    <td className="px-4 py-2.5 text-xs text-white/50 capitalize">{t.accountType}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${t.amount > 0 ? "text-emerald-400" : "text-white/80"}`}>
                      {t.amount > 0 ? "+" : ""}${Math.abs(t.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => handleDelete(t.id, t.userId)}
                        className="rounded bg-red-500/20 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/30">
                        Del
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button onClick={() => setPage(1)} disabled={page === 1} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-30 hover:bg-white/10">«</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-white/20 px-3 py-1 text-xs disabled:opacity-30 hover:bg-white/10">← Prev</button>
              <span className="text-xs text-white/50">Page {page} of {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="rounded border border-white/20 px-3 py-1 text-xs disabled:opacity-30 hover:bg-white/10">Next →</button>
              <button onClick={() => setPage(pages)} disabled={page === pages} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-30 hover:bg-white/10">»</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
