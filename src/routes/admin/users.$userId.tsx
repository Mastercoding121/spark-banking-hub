import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getAdminUser, updateUser, adminAdjustBalance, adminAddTransaction, adminDeleteTransaction } from "@/lib/admin.functions";
import { CATEGORIES } from "@/lib/account.functions";

export const Route = createFileRoute("/admin/users/$userId")({
  head: () => ({ meta: [{ title: "User Detail — FinextHub Admin" }] }),
  component: AdminUserDetail,
});

function AdminUserDetail() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();

  const getUserFn = useServerFn(getAdminUser);
  const updateFn = useServerFn(updateUser);
  const adjustFn = useServerFn(adminAdjustBalance);
  const addTxFn = useServerFn(adminAddTransaction);
  const deleteTxFn = useServerFn(adminDeleteTransaction);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => getUserFn({ data: { userId } }),
  });

  const [feedback, setFeedback] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [verified, setVerified] = useState(false);
  const [editing, setEditing] = useState(false);

  const [adjType, setAdjType] = useState<"checking" | "savings">("checking");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");

  const [txType, setTxType] = useState<"checking" | "savings">("checking");
  const [txDesc, setTxDesc] = useState("");
  const [txCat, setTxCat] = useState(CATEGORIES[0]);
  const [txAmount, setTxAmount] = useState("");

  const fb = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 3000); };

  const startEdit = () => {
    if (!data) return;
    setEditName(data.user.name); setEditEmail(data.user.email);
    setIsAdmin(data.user.isAdmin); setVerified(data.user.verified);
    setEditing(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateFn({ data: { userId, name: editName, email: editEmail, isAdmin, verified } });
      setEditing(false);
      refetch();
      fb("User profile updated.");
    } catch (err: any) { fb(err?.message ?? "Failed."); }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(adjAmount);
    if (isNaN(amount) || amount === 0) return fb("Enter a non-zero amount.");
    try {
      await adjustFn({ data: { userId, accountType: adjType, amount, note: adjNote } });
      setAdjAmount(""); setAdjNote("");
      refetch();
      fb("Balance adjusted.");
    } catch (err: any) { fb(err?.message ?? "Failed."); }
  };

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount === 0) return fb("Enter a non-zero amount.");
    try {
      await addTxFn({ data: { userId, accountType: txType, description: txDesc, category: txCat, amount } });
      setTxDesc(""); setTxAmount("");
      refetch();
      fb("Transaction added.");
    } catch (err: any) { fb(err?.message ?? "Failed."); }
  };

  const handleDeleteTx = async (txId: string) => {
    if (!confirm("Delete this transaction? The balance will be reversed.")) return;
    try {
      await deleteTxFn({ data: { transactionId: txId, userId } });
      refetch();
      fb("Transaction deleted.");
    } catch (err: any) { fb(err?.message ?? "Failed."); }
  };

  if (isLoading) return <div className="p-6 text-white/50 animate-pulse">Loading user…</div>;
  if (!data) return <div className="p-6 text-red-400">User not found.</div>;

  const { user, accounts, transactions } = data;
  const checking = accounts.find((a) => a.type === "checking")?.balance ?? 0;
  const savings = accounts.find((a) => a.type === "savings")?.balance ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-sm text-white/50">{user.email} · ID: {user.id.slice(0, 8)}…</p>
        </div>
        <button onClick={() => refetch()} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10">↺ Refresh</button>
      </div>

      {feedback && <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">{feedback}</div>}

      {/* Profile */}
      <Section title="Profile">
        {editing ? (
          <form onSubmit={saveEdit} className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input value={editName} onChange={(e) => setEditName(e.target.value)} className={inp} /></Field>
            <Field label="Email"><input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className={inp} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="accent-amber-400" /> Email Verified</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="accent-amber-400" /> Admin Access</label>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">Save</button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Cancel</button>
            </div>
          </form>
        ) : (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Pair k="Name" v={user.name} />
            <Pair k="Email" v={user.email} />
            <Pair k="Member since" v={new Date(user.createdAt).toLocaleDateString()} />
            <Pair k="Verified" v={user.verified ? "Yes ✓" : "No ✗"} />
            <Pair k="Admin" v={user.isAdmin ? "Yes ★" : "No"} />
            <div className="sm:col-span-2">
              <button onClick={startEdit} className="mt-1 rounded-lg border border-white/20 px-4 py-1.5 text-xs hover:bg-white/10">Edit Profile</button>
            </div>
          </div>
        )}
      </Section>

      {/* Balances */}
      <Section title="Account Balances">
        <div className="grid gap-3 sm:grid-cols-2">
          <BalCard label="Checking" value={checking} />
          <BalCard label="Savings (Growth)" value={savings} />
        </div>
      </Section>

      {/* Adjust balance */}
      <Section title="Adjust Balance">
        <form onSubmit={handleAdjust} className="grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Account">
            <select value={adjType} onChange={(e) => setAdjType(e.target.value as any)} className={inp}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
            </select>
          </Field>
          <Field label="Amount (+ credit / − debit)">
            <input type="number" step="0.01" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} className={inp} placeholder="e.g. 500 or -250" required />
          </Field>
          <Field label="Admin note" className="sm:col-span-2">
            <input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} className={inp} placeholder="Reason for adjustment" required />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900">Apply Adjustment</button>
          </div>
        </form>
      </Section>

      {/* Add transaction */}
      <Section title="Add Transaction">
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
            <input value={txDesc} onChange={(e) => setTxDesc(e.target.value)} className={inp} placeholder="Description" required />
          </Field>
          <Field label="Category">
            <select value={txCat} onChange={(e) => setTxCat(e.target.value)} className={inp}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white">Add Transaction</button>
          </div>
        </form>
      </Section>

      {/* Transactions */}
      <Section title={`Transactions (${transactions.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/50">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Delete</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-white/40">No transactions yet.</td></tr>
              )}
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-white/5 last:border-0">
                  <td className="px-3 py-2 text-xs text-white/50">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 font-medium">{t.description}</td>
                  <td className="px-3 py-2 text-xs text-white/60">{t.category}</td>
                  <td className="px-3 py-2 text-xs text-white/60 capitalize">{t.accountType}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${t.amount > 0 ? "text-emerald-400" : "text-white"}`}>
                    {t.amount > 0 ? "+" : ""}{Number(t.amount).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handleDeleteTx(t.id)} className="rounded bg-red-500/20 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/30">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/50">{title}</h2>
      {children}
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-xs text-white/40 uppercase tracking-wide">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs text-white/60">{label}</span>
      {children}
    </label>
  );
}

function BalCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/50 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-bold">
        ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-amber-400 focus:outline-none";
