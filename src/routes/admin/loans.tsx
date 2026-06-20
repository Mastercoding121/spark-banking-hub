import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listLoans, updateLoanStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/loans")({
  head: () => ({ meta: [{ title: "Loans — FinextHub Admin" }] }),
  component: AdminLoans,
});

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-400/20 text-amber-300",
  approved: "bg-emerald-500/20 text-emerald-400",
  rejected: "bg-red-500/20 text-red-400",
  disbursed: "bg-blue-500/20 text-blue-400",
};

function AdminLoans() {
  const qc = useQueryClient();
  const listFn = useServerFn(listLoans);
  const updateFn = useServerFn(updateLoanStatus);

  const [statusFilter, setStatusFilter] = useState("all");
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: loans = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-loans"],
    queryFn: () => listFn({}),
  });

  const fb = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 3000); };

  const setStatus = async (loanId: string, status: string) => {
    try {
      await updateFn({ data: { loanId, status } });
      qc.invalidateQueries({ queryKey: ["admin-loans"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      fb(`Loan marked as ${status}.`);
    } catch (e: any) { fb(e?.message ?? "Failed."); }
  };

  const filtered = loans.filter((l) => statusFilter === "all" || l.status === statusFilter);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loan Applications</h1>
          <p className="text-sm text-white/60">{loans.length} total applications</p>
        </div>
        <button onClick={() => refetch()} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">↺ Refresh</button>
      </div>

      {feedback && <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">{feedback}</div>}

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-white/5 p-1 text-xs">
        {["all", "pending", "approved", "rejected", "disbursed"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex-1 min-w-[70px] rounded-md py-1.5 capitalize transition ${statusFilter === s ? "bg-white/20 font-semibold text-white" : "text-white/50 hover:text-white"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="rounded-xl border border-white/10 py-10 text-center text-sm text-white/40">No loans found.</div>
          )}
          {filtered.map((loan) => (
            <div key={loan.id} className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{loan.userName}</span>
                    <span className="text-xs text-white/40">{loan.userEmail}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${STATUS_COLORS[loan.status] ?? "bg-white/10 text-white/60"}`}>{loan.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-white/60">
                    <span><strong className="text-white">${Number(loan.amount).toLocaleString()}</strong> requested</span>
                    <span>Term: {loan.term} months</span>
                    <span>Type: <span className="capitalize">{loan.type}</span></span>
                    <span>Applied: {new Date(loan.createdAt).toLocaleDateString()}</span>
                  </div>
                  {loan.purpose && <div className="text-xs text-white/50 italic">"{loan.purpose}"</div>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {loan.status === "pending" && (
                    <>
                      <button onClick={() => setStatus(loan.id, "approved")} className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30">Approve</button>
                      <button onClick={() => setStatus(loan.id, "rejected")} className="rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30">Reject</button>
                    </>
                  )}
                  {loan.status === "approved" && (
                    <button onClick={() => setStatus(loan.id, "disbursed")} className="rounded-md bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/30">Mark Disbursed</button>
                  )}
                  {(loan.status === "rejected" || loan.status === "disbursed") && (
                    <button onClick={() => setStatus(loan.id, "pending")} className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10">Reset to Pending</button>
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
