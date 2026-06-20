import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listUsers, updateUser, deleteUser, adminAdjustBalance } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users — FinextHub Admin" }] }),
  component: AdminUsers,
});

function AdminUsers() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const updateFn = useServerFn(updateUser);
  const deleteFn = useServerFn(deleteUser);
  const adjustFn = useServerFn(adminAdjustBalance);

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({ name: "", email: "", isAdmin: false, verified: false });
  const [adjustUserId, setAdjustUserId] = useState<string | null>(null);
  const [adjustType, setAdjustType] = useState<"checking" | "savings">("checking");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn({}),
  });

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (u: typeof users[0]) => {
    setEditing(u.id);
    setEditFields({ name: u.name, email: u.email, isAdmin: u.isAdmin, verified: u.verified });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await updateFn({ data: { userId: editing, ...editFields } });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setFeedback("User updated.");
      setTimeout(() => setFeedback(null), 3000);
    } catch (e: any) { setFeedback(e?.message ?? "Failed to update."); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Permanently delete user "${name}" and all their data? This cannot be undone.`)) return;
    try {
      await deleteFn({ data: { userId: id } });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setFeedback("User deleted.");
      setTimeout(() => setFeedback(null), 3000);
    } catch (e: any) { setFeedback(e?.message ?? "Failed to delete."); }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustUserId) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount === 0) return setFeedback("Enter a non-zero amount (negative to deduct).");
    try {
      await adjustFn({ data: { userId: adjustUserId, accountType: adjustType, amount, note: adjustNote } });
      setAdjustUserId(null); setAdjustAmount(""); setAdjustNote("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setFeedback("Balance adjusted.");
      setTimeout(() => setFeedback(null), 3000);
    } catch (e: any) { setFeedback(e?.message ?? "Failed to adjust."); }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-white/60">{users.length} registered accounts</p>
        </div>
        <button onClick={() => refetch()} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">↺ Refresh</button>
      </div>

      {feedback && <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">{feedback}</div>}

      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="mb-4 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm placeholder-white/40 focus:border-amber-400 focus:outline-none"
      />

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-white/5" />)}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-white/50">
              <tr>
                <th className="px-4 py-3 text-left">Name / Email</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-center">Verified</th>
                <th className="px-4 py-3 text-center">Admin</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-white/40">No users found.</td></tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                  <td className="px-4 py-3">
                    {editing === u.id ? (
                      <div className="space-y-1">
                        <input value={editFields.name} onChange={(e) => setEditFields(f => ({ ...f, name: e.target.value }))} className="w-full rounded border border-white/20 bg-white/10 px-2 py-1 text-xs" placeholder="Name" />
                        <input value={editFields.email} onChange={(e) => setEditFields(f => ({ ...f, email: e.target.value }))} className="w-full rounded border border-white/20 bg-white/10 px-2 py-1 text-xs" placeholder="Email" />
                      </div>
                    ) : (
                      <>
                        <Link to="/admin/users/$userId" params={{ userId: u.id }} className="font-semibold hover:text-amber-300">{u.name}</Link>
                        <div className="text-xs text-white/50">{u.email}</div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">
                    {editing === u.id ? (
                      <input type="checkbox" checked={editFields.verified} onChange={(e) => setEditFields(f => ({ ...f, verified: e.target.checked }))} className="accent-amber-400" />
                    ) : (
                      <span className={u.verified ? "text-emerald-400" : "text-red-400"}>{u.verified ? "✓" : "✗"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editing === u.id ? (
                      <input type="checkbox" checked={editFields.isAdmin} onChange={(e) => setEditFields(f => ({ ...f, isAdmin: e.target.checked }))} className="accent-amber-400" />
                    ) : (
                      <span className={u.isAdmin ? "text-amber-300" : "text-white/30"}>{u.isAdmin ? "★" : "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {editing === u.id ? (
                        <>
                          <Btn onClick={saveEdit} variant="green">Save</Btn>
                          <Btn onClick={() => setEditing(null)} variant="ghost">Cancel</Btn>
                        </>
                      ) : (
                        <>
                          <Btn onClick={() => startEdit(u)} variant="ghost">Edit</Btn>
                          <Btn onClick={() => { setAdjustUserId(u.id); setAdjustType("checking"); setAdjustAmount(""); setAdjustNote(""); }} variant="amber">Balance</Btn>
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
      {adjustUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-slate-900 p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold">Adjust Balance</h2>
            <p className="mb-4 text-xs text-white/60">Use a negative amount to deduct. This creates a real transaction record.</p>
            <form onSubmit={handleAdjust} className="space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs text-white/70">Account</span>
                <select value={adjustType} onChange={(e) => setAdjustType(e.target.value as any)} className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2">
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-white/70">Amount (+ credit / − debit)</span>
                <input type="number" step="0.01" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2" placeholder="e.g. 500 or -250" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-white/70">Admin note (required)</span>
                <input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2" placeholder="Reason for adjustment" required />
              </label>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 rounded-lg bg-amber-400 py-2 text-sm font-semibold text-slate-900">Apply</button>
                <button type="button" onClick={() => setAdjustUserId(null)} className="flex-1 rounded-lg border border-white/20 py-2 text-sm hover:bg-white/10">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Btn({ onClick, children, variant }: { onClick: () => void; children: React.ReactNode; variant: "ghost" | "amber" | "red" | "green" }) {
  const cls = {
    ghost: "border border-white/20 text-white/70 hover:bg-white/10",
    amber: "bg-amber-400/20 text-amber-300 hover:bg-amber-400/30",
    red: "bg-red-500/20 text-red-400 hover:bg-red-500/30",
    green: "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30",
  }[variant];
  return (
    <button onClick={onClick} className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${cls}`}>
      {children}
    </button>
  );
}
