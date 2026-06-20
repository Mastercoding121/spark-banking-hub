import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { getAdminStats, getRecentActivity, runSchemaMigration } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Overview — FinextHub" }] }),
  component: AdminOverview,
});

const LOAN_COLORS: Record<string, string> = {
  pending: "bg-amber-400/20 text-amber-300",
  approved: "bg-emerald-500/20 text-emerald-400",
  rejected: "bg-red-500/20 text-red-400",
  disbursed: "bg-blue-500/20 text-blue-400",
};

function AdminOverview() {
  const statsFn = useServerFn(getAdminStats);
  const activityFn = useServerFn(getRecentActivity);
  const schemaMigrateFn = useServerFn(runSchemaMigration);

  const [schemaResults, setSchemaResults] = useState<{ name: string; status: "ok" | "error"; message: string }[] | null>(null);
  const [schemaAt, setSchemaAt] = useState<string | null>(null);

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => statsFn({}),
    refetchInterval: 30_000,
  });

  const { data: activity, isLoading: loadingActivity, refetch: refetchActivity } = useQuery({
    queryKey: ["admin-activity"],
    queryFn: () => activityFn({}),
    refetchInterval: 20_000,
  });

  const schemaMutation = useMutation({
    mutationFn: () => schemaMigrateFn({}),
    onSuccess: (data) => {
      setSchemaResults(data.results);
      setSchemaAt(data.at);
    },
  });

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? "—", icon: "👥", color: "from-blue-600 to-blue-800", link: "/admin/users" },
    { label: "Active Accounts", value: stats?.totalAccounts ?? "—", icon: "🏦", color: "from-emerald-600 to-emerald-800", link: "/admin/users" },
    { label: "Transactions", value: stats?.totalTransactions ?? "—", icon: "💳", color: "from-amber-500 to-amber-700", link: "/admin/transactions" },
    { label: "Pending Loans", value: stats?.pendingLoans ?? "—", icon: "📋", color: "from-red-600 to-red-800", link: "/admin/loans" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-white/50">Real-time summary of all platform activity</p>
        </div>
        <button
          onClick={() => refetchActivity()}
          className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      {loadingStats ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-white/5" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map(({ label, value, icon, color, link }) => (
            <Link key={label} to={link as any} className={`group rounded-xl bg-gradient-to-br ${color} p-5 shadow-lg transition hover:opacity-90`}>
              <div className="text-2xl">{icon}</div>
              <div className="mt-3 text-3xl font-bold">{String(value)}</div>
              <div className="text-xs text-white/70">{label}</div>
            </Link>
          ))}
        </div>
      )}

      {/* Platform totals */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatBox title="Total Checking" value={`$${(stats.totalChecking ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub="Combined balance" />
          <StatBox title="Total Savings" value={`$${(stats.totalSavings ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub="Combined balance" />
          <StatBox title="Verified Users" value={String(stats.verifiedUsers ?? "—")} sub={`of ${stats.totalUsers} total`} />
          <StatBox title="Admin Accounts" value={String(stats.adminUsers ?? "—")} sub="Elevated access" />
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link to="/admin/users" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
            </span>
            <div>
              <div className="text-sm font-semibold">Manage Users</div>
              <div className="text-xs text-white/40">Edit, verify, adjust balances</div>
            </div>
          </Link>
          <Link to="/admin/transactions" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
            </span>
            <div>
              <div className="text-sm font-semibold">All Transactions</div>
              <div className="text-xs text-white/40">View, filter & delete records</div>
            </div>
          </Link>
          <Link to="/admin/loans" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="9" width="18" height="12" rx="1" /><path d="M3 9l9-6 9 6" /></svg>
            </span>
            <div>
              <div className="text-sm font-semibold">Loan Applications</div>
              <div className="text-xs text-white/40">Approve, reject & disburse</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Activity feed grid */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Recent transactions */}
        <div className="rounded-xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Transactions</h2>
            <Link to="/admin/transactions" className="text-[11px] text-amber-400 hover:text-amber-300">View all →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {loadingActivity ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="mx-4 my-2 h-10 animate-pulse rounded-lg bg-white/5" />)
            ) : (activity?.recentTransactions ?? []).length === 0 ? (
              <div className="py-8 text-center text-sm text-white/30">No transactions yet.</div>
            ) : (
              (activity?.recentTransactions ?? []).slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{t.description}</div>
                    <div className="truncate text-[11px] text-white/40">{t.userName} · {t.accountType}</div>
                  </div>
                  <div className={`shrink-0 text-xs font-semibold ${t.amount > 0 ? "text-emerald-400" : "text-white/80"}`}>
                    {t.amount > 0 ? "+" : ""}${Math.abs(t.amount).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column: recent users + recent loans */}
        <div className="space-y-4">

          {/* Recent sign-ups */}
          <div className="rounded-xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent Sign-ups</h2>
              <Link to="/admin/users" className="text-[11px] text-amber-400 hover:text-amber-300">View all →</Link>
            </div>
            <div className="divide-y divide-white/5">
              {loadingActivity ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="mx-4 my-2 h-8 animate-pulse rounded-lg bg-white/5" />)
              ) : (activity?.recentUsers ?? []).length === 0 ? (
                <div className="py-6 text-center text-sm text-white/30">No users yet.</div>
              ) : (
                (activity?.recentUsers ?? []).slice(0, 5).map((u) => (
                  <Link key={u.id} to="/admin/users/$userId" params={{ userId: u.id }} className="flex items-center gap-2.5 px-4 py-2 hover:bg-white/5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                      {u.name?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{u.name}</div>
                      <div className="truncate text-[11px] text-white/40">{u.email}</div>
                    </div>
                    <div className="ml-auto flex shrink-0 gap-1">
                      {u.verified && <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">✓</span>}
                      {u.isAdmin && <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">★</span>}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Recent loans */}
          <div className="rounded-xl border border-white/10 bg-white/5">
            <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent Loan Applications</h2>
              <Link to="/admin/loans" className="text-[11px] text-amber-400 hover:text-amber-300">View all →</Link>
            </div>
            <div className="divide-y divide-white/5">
              {loadingActivity ? (
                Array.from({ length: 3 }).map((_, i) => <div key={i} className="mx-4 my-2 h-8 animate-pulse rounded-lg bg-white/5" />)
              ) : (activity?.recentLoans ?? []).length === 0 ? (
                <div className="py-6 text-center text-sm text-white/30">No loan applications.</div>
              ) : (
                (activity?.recentLoans ?? []).slice(0, 4).map((l) => (
                  <div key={l.id} className="flex items-center gap-2.5 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{l.fullName}</div>
                      <div className="truncate text-[11px] text-white/40">${l.amount.toLocaleString()} · {l.email}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${LOAN_COLORS[l.status] ?? "bg-white/10 text-white/50"}`}>{l.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Database / Schema Sync ─────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">Database</h2>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
                </svg>
                <span className="text-sm font-semibold">Schema Sync</span>
              </div>
              <p className="mt-1 text-xs text-white/40">
                Runs <code className="rounded bg-white/10 px-1 py-0.5 text-[11px]">CREATE TABLE IF NOT EXISTS</code> for all 7 tables and 9 indexes. Safe to run at any time — will not overwrite existing data.
              </p>
            </div>
            <button
              onClick={() => schemaMutation.mutate()}
              disabled={schemaMutation.isPending}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {schemaMutation.isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeDasharray="60" strokeDashoffset="20" /></svg>
                  Running…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                  Run Schema Sync
                </>
              )}
            </button>
          </div>

          {schemaMutation.isError && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
              {(schemaMutation.error as Error)?.message ?? "Migration failed."}
            </div>
          )}

          {schemaResults && (
            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white/60">Migration Results</span>
                {schemaAt && <span className="text-[10px] text-white/30">{new Date(schemaAt).toLocaleTimeString()}</span>}
              </div>
              <div className="space-y-1">
                {schemaResults.map((r) => (
                  <div key={r.name} className="flex items-center gap-2 text-xs">
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${r.status === "ok" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                      {r.status === "ok" ? "✓" : "✗"}
                    </span>
                    <span className="w-36 font-mono text-white/60">{r.name}</span>
                    <span className={r.status === "ok" ? "text-emerald-400/60" : "text-red-400"}>{r.message}</span>
                  </div>
                ))}
              </div>
              <div className={`mt-2 text-[11px] font-semibold ${schemaResults.every(r => r.status === "ok") ? "text-emerald-400" : "text-amber-400"}`}>
                {schemaResults.every(r => r.status === "ok")
                  ? `✓ All ${schemaResults.length} tables synced successfully`
                  : `⚠ ${schemaResults.filter(r => r.status === "error").length} table(s) had errors`}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function StatBox({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-[10px] uppercase tracking-widest text-white/40">{title}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-white/30">{sub}</div>}
    </div>
  );
}
