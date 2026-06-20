import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listLoans, updateLoanStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/loans")({
  head: () => ({ meta: [{ title: "Loans — FinextHub Admin" }] }),
  component: AdminLoans,
});

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-400/20 text-amber-300 border-amber-400/30",
  approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  disbursed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function AdminLoans() {
  const qc = useQueryClient();
  const listFn = useServerFn(listLoans);
  const updateFn = useServerFn(updateLoanStatus);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  const { data: loans = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-loans"],
    queryFn: () => listFn({}),
    refetchInterval: 30_000,
  });

  const fb = (msg: string, ok = true) => { setFeedback({ msg, ok }); setTimeout(() => setFeedback(null), 4000); };

  const setStatus = async (loanId: string, status: string) => {
    try {
      await updateFn({ data: { loanId, status } });
      qc.invalidateQueries({ queryKey: ["admin-loans"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      fb(`Loan marked as ${status}.`);
    } catch (e: any) { fb(e?.message ?? "Failed.", false); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return loans.filter((l) => {
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchSearch = !q || l.userName.toLowerCase().includes(q) || l.userEmail.toLowerCase().includes(q) || l.referenceId?.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [loans, statusFilter, search]);

  const counts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = { all: loans.length, pending: 0, approved: 0, rejected: 0, disbursed: 0 };
    loans.forEach((l) => { if (c[l.status] !== undefined) c[l.status]++; });
    return c;
  }, [loans]);

  const totalRequested = filtered.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Loan Applications</h1>
          <p className="text-sm text-white/50">{filtered.length} of {loans.length} applications shown</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
          Refresh
        </button>
      </div>

      {feedback && (
        <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-red-400/30 bg-red-400/10 text-red-300"}`}>
          {feedback.msg}
        </div>
      )}

      {/* Summary strip */}
      {!isLoading && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["pending", "approved", "rejected", "disbursed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              className={`rounded-lg border p-3 text-left transition ${statusFilter === s ? STATUS_COLORS[s] : "border-white/10 bg-white/5 hover:bg-white/10"}`}
            >
              <div className="text-[10px] uppercase tracking-widest opacity-60 capitalize">{s}</div>
              <div className="mt-0.5 text-2xl font-bold">{counts[s]}</div>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or reference ID…"
          className="min-w-48 flex-1 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm placeholder-white/30 focus:border-amber-400 focus:outline-none"
        />
        <div className="flex rounded-lg border border-white/20 bg-white/5 text-xs overflow-hidden">
          {["all", "pending", "approved", "rejected", "disbursed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 capitalize transition ${statusFilter === s ? "bg-white/20 font-semibold text-white" : "text-white/40 hover:text-white"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Total requested */}
      {filtered.length > 0 && (
        <div className="mb-4 text-xs text-white/40">
          Total requested in view: <strong className="text-white/70">${totalRequested.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-white/5" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="rounded-xl border border-white/10 py-14 text-center text-sm text-white/30">
              No loan applications match your filters.
            </div>
          )}
          {filtered.map((loan) => (
            <div key={loan.id} className={`rounded-xl border bg-white/5 p-5 ${STATUS_COLORS[loan.status]?.split(" ").find(c => c.startsWith("border")) ?? "border-white/10"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{loan.userName}</span>
                    <span className="text-xs text-white/40">{loan.userEmail}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLORS[loan.status] ?? "bg-white/10 text-white/50 border-white/10"}`}>
                      {loan.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-white/60">
                    <span><strong className="text-white text-sm">${Number(loan.amount).toLocaleString()}</strong> requested</span>
                    <span>Term: <strong className="text-white/80">{loan.term} months</strong></span>
                    <span>Type: <strong className="text-white/80 capitalize">{loan.type}</strong></span>
                    <span>Ref: <strong className="text-white/80 font-mono">{loan.referenceId}</strong></span>
                  </div>
                  <div className="text-[11px] text-white/30">
                    Applied {new Date(loan.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {loan.status === "pending" && (
                    <>
                      <button onClick={() => setStatus(loan.id, "approved")}
                        className="rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20">
                        ✓ Approve
                      </button>
                      <button onClick={() => setStatus(loan.id, "rejected")}
                        className="rounded-lg bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/30 border border-red-500/20">
                        ✕ Reject
                      </button>
                    </>
                  )}
                  {loan.status === "approved" && (
                    <>
                      <button onClick={() => setStatus(loan.id, "disbursed")}
                        className="rounded-lg bg-blue-500/20 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/30 border border-blue-500/20">
                        💸 Mark Disbursed
                      </button>
                      <button onClick={() => setStatus(loan.id, "rejected")}
                        className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/40 hover:bg-white/10">
                        Reject
                      </button>
                    </>
                  )}
                  {(loan.status === "rejected" || loan.status === "disbursed") && (
                    <button onClick={() => setStatus(loan.id, "pending")}
                      className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white/50 hover:bg-white/10">
                      ↺ Reset to Pending
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
