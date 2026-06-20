import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminStats } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Overview — FinextHub" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const statsFn = useServerFn(getAdminStats);
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => statsFn({}),
    refetchInterval: 30_000,
  });

  const cards = [
    { label: "Total Users", value: stats?.totalUsers ?? "—", icon: "👥", color: "from-blue-600 to-blue-800" },
    { label: "Active Accounts", value: stats?.totalAccounts ?? "—", icon: "🏦", color: "from-emerald-600 to-emerald-800" },
    { label: "Transactions", value: stats?.totalTransactions ?? "—", icon: "💳", color: "from-amber-500 to-amber-700" },
    { label: "Pending Loans", value: stats?.pendingLoans ?? "—", icon: "📋", color: "from-red-600 to-red-800" },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-white/60">Real-time summary of all platform activity</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-white/5" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map(({ label, value, icon, color }) => (
            <div key={label} className={`rounded-xl bg-gradient-to-br ${color} p-5 shadow-lg`}>
              <div className="text-2xl">{icon}</div>
              <div className="mt-3 text-3xl font-bold">{String(value)}</div>
              <div className="text-xs text-white/70">{label}</div>
            </div>
          ))}
        </div>
      )}

      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatBox title="Checking Balance (total)" value={`$${Number(stats.totalChecking ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
          <StatBox title="Savings Balance (total)" value={`$${Number(stats.totalSavings ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
          <StatBox title="Verified Users" value={String(stats.verifiedUsers ?? "—")} />
          <StatBox title="Admin Users" value={String(stats.adminUsers ?? "—")} />
        </div>
      )}
    </div>
  );
}

function StatBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/50 uppercase tracking-wide">{title}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
