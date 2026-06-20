import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listUsers, updateUser, deleteUser, adminAdjustBalance, adminToggleVerified, adminToggleAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users — FinextHub Admin" }] }),
  component: AdminUsers,
});

type User = {
  id: string; email: string; name: string; isAdmin: boolean; verified: boolean;
  createdAt: string; checkingBalance: number; savingsBalance: number; transactionCount: number;
};

function AdminUsers() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const updateFn = useServerFn(updateUser);
  const deleteFn = useServerFn(deleteUser);
  const adjustFn = useServerFn(adminAdjustBalance);
  const toggleVerifiedFn = useServerFn(adminToggleVerified);
  const toggleAdminFn = useServerFn(adminToggleAdmin);

  const [search, setSearch] = useState("");
  const [filterVerified, setFilterVerified] = useState<"all" | "yes" | "no">("all");
  const [filterRole, setFilterRole] = useState<"all" | "admin" | "user">("all");

  const [editId, setEditId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ name: "", email: "", isAdmin: false, verified: false });

  const [adjustUser, setAdjustUser] = useState<User | null>(null);
  const [adjustType, setAdjustType] = useState<"checking" | "savings">("checking");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn({}),
    refetchInterval: 30_000,
  });

  const fb = (msg: string, ok = true) => {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 4000);
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchVerified = filterVerified === "all" || (filterVerified === "yes" ? u.verified : !u.verified);
    const matchRole = filterRole === "all" || (filterRole === "admin" ? u.isAdmin : !u.isAdmin);
    return matchSearch && matchVerified && matchRole;
  });

  const startEdit = (u: User) => {
    setEditId(u.id);
    setEditFields({ name: u.name, email: u.email, isAdmin: u.isAdmin, verified: u.verified });
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await updateFn({ data: { userId: editId, ...editFields } });
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      fb("User updated.");
    } catch (e: any) { fb(e?.message ?? "Failed.", false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}" and ALL their data? This cannot be undone.`)) return;
    try {
      await deleteFn({ data: { userId: id } });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      fb("User deleted.");
    } catch (e: any) { fb(e?.message ?? "Failed.", false); }
  };

  const toggleVerified = async (u: User) => {
    try {
      await toggleVerifiedFn({ data: { userId: u.id, verified: !u.verified } });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      fb(`${u.name} ${!u.verified ? "verified" : "unverified"}.`);
    } catch (e: any) { fb(e?.message ?? "Failed.", false); }
  };

  const toggleAdmin = async (u: User) => {
    if (!confirm(`${u.isAdmin ? "Remove" : "Grant"} admin access for "${u.name}"?`)) return;
    try {
      await toggleAdminFn({ data: { userId: u.id, isAdmin: !u.isAdmin } });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      fb(`Admin access ${!u.isAdmin ? "granted" : "revoked"} for ${u.name}.`);
    } catch (e: any) { fb(e?.message ?? "Failed.", false); }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustUser) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount === 0) return fb("Enter a non-zero amount.", false);
    try {
      await adjustFn({ data: { userId: adjustUser.id, accountType: adjustType, amount, note: adjustNote } });
      setAdjustUser(null); setAdjustAmount(""); setAdjustNote("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      fb("Balance adjusted.");
    } catch (e: any) { fb(e?.message ?? "Failed.", false); }
  };

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-white/50">{filtered.length} of {users.length} accounts shown</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
          Refresh
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-red-400/30 bg-red-400/10 text-red-300"}`}>
          {feedback.msg}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="min-w-48 flex-1 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm placeholder-white/30 focus:border-amber-400 focus:outline-none"
        />
        <select value={filterVerified} onChange={(e) => setFilterVerified(e.target.value as any)}
          className="rounded-lg border border-white/20 bg-slate-900 px-3 py-1.5 text-sm text-white/70 focus:border-amber-400 focus:outline-none">
          <option value="all">All Verification</option>
          <option value="yes">Verified only</option>
          <option value="no">Unverified only</option>
        </select>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value as any)}
          className="rounded-lg border border-white/20 bg-slate-900 px-3 py-1.5 text-sm text-white/70 focus:border-amber-400 focus:outline-none">
          <option value="all">All Roles</option>
          <option value="admin">Admins only</option>
          <option value="user">Users only</option>
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-white/5" />)}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-[11px] uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-right">Checking</th>
                <th className="px-4 py-3 text-right">Savings</th>
                <th className="px-4 py-3 text-center">Txns</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-sm text-white/30">No users match your filters.</td></tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    {editId === u.id ? (
                      <div className="space-y-1">
                        <input value={editFields.name} onChange={(e) => setEditFields(f => ({ ...f, name: e.target.value }))}
                          className="w-full rounded border border-white/20 bg-white/10 px-2 py-1 text-xs" placeholder="Name" />
                        <input value={editFields.email} onChange={(e) => setEditFields(f => ({ ...f, email: e.target.value }))}
                          className="w-full rounded border border-white/20 bg-white/10 px-2 py-1 text-xs" placeholder="Email" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                          {u.name?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <Link to="/admin/users/$userId" params={{ userId: u.id }} className="font-semibold hover:text-amber-300">{u.name}</Link>
                          <div className="text-[11px] text-white/40">{u.email}</div>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/40">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-white/80">{fmt(u.checkingBalance)}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-white/80">{fmt(u.savingsBalance)}</td>
                  <td className="px-4 py-3 text-center text-xs text-white/50">{u.transactionCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {editId === u.id ? (
                        <div className="flex gap-2">
                          <label className="flex items-center gap-1 text-[11px]">
                            <input type="checkbox" checked={editFields.verified} onChange={(e) => setEditFields(f => ({ ...f, verified: e.target.checked }))} className="accent-amber-400" />
                            <span className="text-white/60">Verified</span>
                          </label>
                          <label className="flex items-center gap-1 text-[11px]">
                            <input type="checkbox" checked={editFields.isAdmin} onChange={(e) => setEditFields(f => ({ ...f, isAdmin: e.target.checked }))} className="accent-amber-400" />
                            <span className="text-white/60">Admin</span>
                          </label>
                        </div>
                      ) : (
                        <>
                          <button
                            title={u.verified ? "Click to unverify" : "Click to verify"}
                            onClick={() => toggleVerified(u)}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${u.verified ? "bg-emerald-500/20 text-emerald-400 hover:bg-red-500/20 hover:text-red-400" : "bg-white/10 text-white/30 hover:bg-emerald-500/20 hover:text-emerald-400"}`}
                          >
                            {u.verified ? "✓ Verified" : "✗ Unverified"}
                          </button>
                          {u.isAdmin && (
                            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">★ Admin</span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editId === u.id ? (
                        <>
                          <Btn onClick={saveEdit} variant="green">Save</Btn>
                          <Btn onClick={() => setEditId(null)} variant="ghost">✕</Btn>
                        </>
                      ) : (
                        <>
                          <Link to="/admin/users/$userId" params={{ userId: u.id }}>
                            <Btn onClick={() => {}} variant="ghost">View</Btn>
                          </Link>
                          <Btn onClick={() => startEdit(u)} variant="ghost">Edit</Btn>
                          <Btn onClick={() => { setAdjustUser(u); setAdjustType("checking"); setAdjustAmount(""); setAdjustNote(""); }} variant="amber">Balance</Btn>
                          <Btn onClick={() => toggleAdmin(u)} variant={u.isAdmin ? "amber" : "ghost"} title={u.isAdmin ? "Remove admin" : "Make admin"}>★</Btn>
                          <Btn onClick={() => handleDelete(u.id, u.name)} variant="red">Delete</Btn>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust balance modal */}
      {adjustUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={(e) => { if (e.target === e.currentTarget) setAdjustUser(null); }}>
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-slate-900 p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold">Adjust Balance</h2>
            <p className="mb-4 text-xs text-white/50">
              For <strong className="text-white">{adjustUser.name}</strong> — use a negative amount to deduct. Creates a real transaction record.
            </p>
            <form onSubmit={handleAdjust} className="space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs text-white/60">Account</span>
                <select value={adjustType} onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2">
                  <option value="checking">Checking (current: {fmt(adjustUser.checkingBalance)})</option>
                  <option value="savings">Savings (current: {fmt(adjustUser.savingsBalance)})</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-white/60">Amount (+ credit / − debit)</span>
                <input type="number" step="0.01" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2" placeholder="e.g. 500 or -250" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-white/60">Admin note (required)</span>
                <input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2" placeholder="Reason for adjustment" required />
              </label>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 rounded-lg bg-amber-400 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300">Apply</button>
                <button type="button" onClick={() => setAdjustUser(null)} className="flex-1 rounded-lg border border-white/20 py-2 text-sm hover:bg-white/10">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Btn({ onClick, children, variant, title }: { onClick: () => void; children: React.ReactNode; variant: "ghost" | "amber" | "red" | "green"; title?: string }) {
  const cls = {
    ghost: "border border-white/20 text-white/60 hover:bg-white/10 hover:text-white",
    amber: "bg-amber-400/20 text-amber-300 hover:bg-amber-400/30",
    red: "bg-red-500/20 text-red-400 hover:bg-red-500/30",
    green: "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30",
  }[variant];
  return (
    <button onClick={onClick} title={title} className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${cls}`}>
      {children}
    </button>
  );
}
