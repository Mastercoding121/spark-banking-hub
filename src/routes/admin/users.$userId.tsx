import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getAdminUser, updateUser, adminAdjustBalance, adminAddTransaction,
  adminDeleteTransaction, adminResetPassword, adminUpdateUserCreatedAt,
} from "@/lib/admin.functions";
import { CATEGORIES } from "@/lib/account.functions";

export const Route = createFileRoute("/admin/users/$userId")({
  head: () => ({ meta: [{ title: "User Detail — FinextHub Admin" }] }),
  component: AdminUserDetail,
});

const inp = "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-amber-400 focus:outline-none";

function AdminUserDetail() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();

  const getUserFn = useServerFn(getAdminUser);
  const updateFn = useServerFn(updateUser);
  const adjustFn = useServerFn(adminAdjustBalance);
  const addTxFn = useServerFn(adminAddTransaction);
  const deleteTxFn = useServerFn(adminDeleteTransaction);
  const resetPwFn = useServerFn(adminResetPassword);
  const updateCreatedAtFn = useServerFn(adminUpdateUserCreatedAt);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => getUserFn({ data: { userId } }),
    refetchInterval: 15_000,
  });

  // ── Feedback ──────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const fb = (msg: string, ok = true) => { setFeedback({ msg, ok }); setTimeout(() => setFeedback(null), 4000); };

  // ── Edit Member Since ──────────────────────────────────────────
  const [dateOpen, setDateOpen] = useState(false);
  const [editDate, setEditDate] = useState("");
  const openDateEdit = () => {
    if (!data) return;
    const d = new Date(data.user.createdAt);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditDate(local);
    setDateOpen(true);
  };
  const saveDateEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateCreatedAtFn({ data: { userId, createdAt: new Date(editDate).toISOString() } });
      setDateOpen(false); refetch();
      fb("Account creation date updated.");
    } catch (err: any) { fb(err?.message ?? "Failed.", false); }
  };

  // ── Edit profile modal ─────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editVerified, setEditVerified] = useState(false);

  const openEdit = () => {
    if (!data) return;
    setEditName(data.user.name); setEditEmail(data.user.email);
    setEditIsAdmin(data.user.isAdmin); setEditVerified(data.user.verified);
    setEditOpen(true);
  };
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateFn({ data: { userId, name: editName, email: editEmail, isAdmin: editIsAdmin, verified: editVerified } });
      setEditOpen(false); refetch();
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      fb("Profile updated.");
    } catch (err: any) { fb(err?.message ?? "Failed.", false); }
  };

  // ── Reset password modal ───────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) return fb("Passwords do not match.", false);
    if (newPw.length < 8) return fb("Password must be at least 8 characters.", false);
    try {
      await resetPwFn({ data: { userId, newPassword: newPw } });
      setPwOpen(false); setNewPw(""); setConfirmPw("");
      fb("Password reset successfully.");
    } catch (err: any) { fb(err?.message ?? "Failed.", false); }
  };

  // ── Adjust balance ─────────────────────────────────────────────
  const [adjType, setAdjType] = useState<"checking" | "savings">("checking");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(adjAmount);
    if (isNaN(amount) || amount === 0) return fb("Enter a non-zero amount.", false);
    try {
      await adjustFn({ data: { userId, accountType: adjType, amount, note: adjNote } });
      setAdjAmount(""); setAdjNote(""); refetch();
      fb("Balance adjusted.");
    } catch (err: any) { fb(err?.message ?? "Failed.", false); }
  };

  // ── Add transaction ────────────────────────────────────────────
  const [txType, setTxType] = useState<"checking" | "savings">("checking");
  const [txDesc, setTxDesc] = useState("");
  const [txCat, setTxCat] = useState(CATEGORIES[0]);
  const [txAmount, setTxAmount] = useState("");

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount === 0) return fb("Enter a non-zero amount.", false);
    try {
      await addTxFn({ data: { userId, accountType: txType, description: txDesc, category: txCat, amount } });
      setTxDesc(""); setTxAmount(""); refetch();
      fb("Transaction added.");
    } catch (err: any) { fb(err?.message ?? "Failed.", false); }
  };

  // ── Delete transaction ─────────────────────────────────────────
  const handleDeleteTx = async (txId: string) => {
    if (!confirm("Delete this transaction? The balance will be reversed.")) return;
    try {
      await deleteTxFn({ data: { transactionId: txId, userId } });
      refetch(); fb("Transaction deleted.");
    } catch (err: any) { fb(err?.message ?? "Failed.", false); }
  };

  // ── Render ─────────────────────────────────────────────────────
  if (isLoading) return <div className="p-8 text-white/40 animate-pulse">Loading user…</div>;
  if (!data) return <div className="p-8 text-red-400">User not found.</div>;

  const { user, accounts, transactions } = data;
  const checking = accounts.find((a) => a.type === "checking")?.balance ?? 0;
  const savings = accounts.find((a) => a.type === "savings")?.balance ?? 0;
  const totalBalance = checking + savings;
  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="p-6 space-y-5">

      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Link to="/admin/users" className="hover:text-amber-400">Users</Link>
        <span>/</span>
        <span className="text-white/70">{user.name}</span>
      </div>

      {/* ── Hero card ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/20 text-xl font-bold text-amber-400">
              {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{user.name}</h1>
                {user.verified && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">✓ Verified</span>}
                {user.isAdmin && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">★ Admin</span>}
              </div>
              <div className="text-sm text-white/50">{user.email}</div>
              <div className="mt-0.5 text-xs text-white/30">ID: {user.id.slice(0, 12)}… · Member since {new Date(user.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={openEdit} className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-medium hover:bg-white/10">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Edit Profile
            </button>
            <button onClick={() => setPwOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-400/20">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              Reset Password
            </button>
            <button onClick={openDateEdit} className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs text-white/50 hover:bg-white/10">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              Edit Date
            </button>
            <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs text-white/50 hover:bg-white/10">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Balance summary */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <BalCard label="Checking" value={checking} sub="FINEXTHUB CHECKING" />
          <BalCard label="Savings" value={savings} sub="GROWTH SAVINGS · 4.25% APY" />
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Total Assets</div>
            <div className="mt-1 text-xl font-bold">{fmt(totalBalance)}</div>
            <div className="mt-0.5 text-[11px] text-white/30">{transactions.length} transactions</div>
          </div>
        </div>
      </div>

      {/* ── Feedback banner ────────────────────────────────────── */}
      {feedback && (
        <div className={`rounded-lg border px-4 py-2.5 text-sm ${feedback.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-red-400/30 bg-red-400/10 text-red-300"}`}>
          {feedback.msg}
        </div>
      )}

      {/* ── Info grid ──────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Adjust balance */}
        <Section title="Adjust Balance" icon="⚖️">
          <form onSubmit={handleAdjust} className="grid gap-3 text-sm sm:grid-cols-2">
            <Field label="Account">
              <select value={adjType} onChange={(e) => setAdjType(e.target.value as any)} className={inp}>
                <option value="checking">Checking ({fmt(checking)})</option>
                <option value="savings">Savings ({fmt(savings)})</option>
              </select>
            </Field>
            <Field label="Amount (+ credit / − debit)">
              <input type="number" step="0.01" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} className={inp} placeholder="e.g. 500 or -250" required />
            </Field>
            <Field label="Admin note" className="sm:col-span-2">
              <input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} className={inp} placeholder="Reason for adjustment" required />
            </Field>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300">Apply Adjustment</button>
            </div>
          </form>
        </Section>

        {/* Add transaction */}
        <Section title="Add Transaction" icon="➕">
          <form onSubmit={handleAddTx} className="grid gap-3 text-sm sm:grid-cols-2">
            <Field label="Account">
              <select value={txType} onChange={(e) => setTxType(e.target.value as any)} className={inp}>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
              </select>
            </Field>
            <Field label="Amount (+ credit / − debit)">
              <input type="number" step="0.01" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} className={inp} placeholder="e.g. 50 or -200" required />
            </Field>
            <Field label="Description">
              <input value={txDesc} onChange={(e) => setTxDesc(e.target.value)} className={inp} placeholder="Transaction description" required />
            </Field>
            <Field label="Category">
              <select value={txCat} onChange={(e) => setTxCat(e.target.value)} className={inp}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400">Add Transaction</button>
            </div>
          </form>
        </Section>
      </div>

      {/* ── Transaction history ────────────────────────────────── */}
      <Section title={`Transaction History (${transactions.length})`} icon="📋">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-[11px] uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-white/30">No transactions yet.</td></tr>
              )}
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-3 py-2 text-xs text-white/40">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 font-medium">{t.description}</td>
                  <td className="px-3 py-2 text-xs text-white/50">{t.category}</td>
                  <td className="px-3 py-2 text-xs text-white/50 capitalize">{t.accountType}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${t.amount > 0 ? "text-emerald-400" : "text-white/80"}`}>
                    {t.amount > 0 ? "+" : ""}{Number(t.amount).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handleDeleteTx(t.id)}
                      className="rounded bg-red-500/20 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/30">
                      Del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Edit Member Since modal ────────────────────────────── */}
      {dateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={(e) => { if (e.target === e.currentTarget) setDateOpen(false); }}>
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-slate-900 p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold">Edit Account Creation Date</h2>
            <p className="mb-4 text-xs text-white/40">This changes the "Member since" date displayed on the user's profile. Use with care.</p>
            <form onSubmit={saveDateEdit} className="space-y-4">
              <Field label="Account Creation Date & Time">
                <input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={inp} required />
              </Field>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setDateOpen(false)} className="flex-1 rounded-lg border border-white/20 py-2.5 text-sm font-medium hover:bg-white/5">Cancel</button>
                <button type="submit" className="flex-1 rounded-lg bg-amber-400 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300">Save Date</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit profile modal ─────────────────────────────────── */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-900 p-6 shadow-2xl">
            <h2 className="mb-5 text-lg font-bold">Edit User Profile</h2>
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Display Name">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inp} required />
                </Field>
                <Field label="Email Address">
                  <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className={inp} required />
                </Field>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-widest text-white/40">Access Controls</div>
                <label className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Email Verified</div>
                    <div className="text-xs text-white/40">Allows login and transactions</div>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={editVerified} onChange={(e) => setEditVerified(e.target.checked)} />
                    <div onClick={() => setEditVerified(v => !v)} className={`h-6 w-11 cursor-pointer rounded-full transition-colors ${editVerified ? "bg-emerald-500" : "bg-white/20"}`}>
                      <div className={`mt-0.5 ml-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${editVerified ? "translate-x-5" : ""}`} />
                    </div>
                  </div>
                </label>
                <label className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Admin Access</div>
                    <div className="text-xs text-white/40">Full admin panel access</div>
                  </div>
                  <div className="relative">
                    <div onClick={() => setEditIsAdmin(v => !v)} className={`h-6 w-11 cursor-pointer rounded-full transition-colors ${editIsAdmin ? "bg-amber-400" : "bg-white/20"}`}>
                      <div className={`mt-0.5 ml-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${editIsAdmin ? "translate-x-5" : ""}`} />
                    </div>
                  </div>
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400">Save Changes</button>
                <button type="button" onClick={() => setEditOpen(false)} className="flex-1 rounded-lg border border-white/20 py-2.5 text-sm hover:bg-white/10">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset password modal ───────────────────────────────── */}
      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={(e) => { if (e.target === e.currentTarget) { setPwOpen(false); setNewPw(""); setConfirmPw(""); } }}>
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-slate-900 p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold">Reset Password</h2>
            <p className="mb-5 text-xs text-white/50">
              Set a new password for <strong className="text-amber-300">{user.name}</strong>. They will need to use this to log in.
            </p>
            <form onSubmit={savePw} className="space-y-3">
              <Field label="New Password">
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inp} placeholder="Minimum 8 characters" required />
              </Field>
              <Field label="Confirm Password">
                <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={inp} placeholder="Repeat password" required />
              </Field>
              {newPw && confirmPw && newPw !== confirmPw && (
                <p className="text-xs text-red-400">Passwords do not match.</p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={!newPw || !confirmPw || newPw !== confirmPw}
                  className="flex-1 rounded-lg bg-amber-400 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-40">
                  Reset Password
                </button>
                <button type="button" onClick={() => { setPwOpen(false); setNewPw(""); setConfirmPw(""); }}
                  className="flex-1 rounded-lg border border-white/20 py-2.5 text-sm hover:bg-white/10">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/40">
        {icon && <span>{icon}</span>}{title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs text-white/50">{label}</span>
      {children}
    </label>
  );
}

function BalCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-1 text-xl font-bold">{fmt(value)}</div>
      {sub && <div className="mt-0.5 text-[11px] text-white/30">{sub}</div>}
    </div>
  );
}
