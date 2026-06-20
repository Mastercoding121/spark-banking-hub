import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  adminListGrants, adminCreateGrant, adminUpdateGrant,
  adminDeleteGrant, adminListGrantApplications, adminUpdateGrantApplication,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/grants")({
  head: () => ({ meta: [{ title: "Grants — FinextHub Admin" }] }),
  component: AdminGrants,
});

const STATUS_STYLE: Record<string, string> = {
  pending:  "bg-amber-400/20 text-amber-300",
  approved: "bg-emerald-500/20 text-emerald-400",
  rejected: "bg-red-500/20 text-red-400",
  active:   "bg-emerald-500/20 text-emerald-400",
  inactive: "bg-white/10 text-white/40",
  closed:   "bg-slate-700/50 text-white/30",
};

const inp = "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-amber-400 focus:outline-none";

type Grant = Awaited<ReturnType<typeof adminListGrants>>[number];
type Application = Awaited<ReturnType<typeof adminListGrantApplications>>[number];

function GrantForm({ initial, onSave, onCancel }: {
  initial?: Partial<Grant>;
  onSave: (data: { title: string; description: string; amount: number; eligibilityText: string; deadline: string; status: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [eligibility, setEligibility] = useState(initial?.eligibilityText ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      await onSave({ title, description, amount: parseFloat(amount), eligibilityText: eligibility, deadline, status });
    } catch (e: any) { setErr(e?.message ?? "Failed."); }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-white/60">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} placeholder="e.g. Small Business Startup Grant" required />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-white/60">Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inp} placeholder="Describe the grant and its purpose…" required />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-white/60">Max Amount ($)</span>
          <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-white/60">Deadline (optional)</span>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inp} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-white/60">Eligibility Requirements (optional)</span>
        <input value={eligibility} onChange={(e) => setEligibility(e.target.value)} className={inp} placeholder="e.g. Must be a verified account holder with 6+ months tenure" />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-white/60">Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inp}>
          <option value="active">Active</option>
          <option value="inactive">Inactive (hidden from users)</option>
          <option value="closed">Closed (no new applications)</option>
        </select>
      </label>
      {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{err}</div>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-white/20 py-2 text-sm font-medium hover:bg-white/5">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-amber-400 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-50">
          {saving ? "Saving…" : "Save Grant"}
        </button>
      </div>
    </form>
  );
}

function AdminGrants() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListGrants);
  const createFn = useServerFn(adminCreateGrant);
  const updateFn = useServerFn(adminUpdateGrant);
  const deleteFn = useServerFn(adminDeleteGrant);
  const listAppsFn = useServerFn(adminListGrantApplications);
  const updateAppFn = useServerFn(adminUpdateGrantApplication);

  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Grant | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: grants = [], isLoading: loadingGrants, refetch: refetchGrants } = useQuery({
    queryKey: ["admin-grants"], queryFn: () => listFn({}), refetchInterval: 20_000,
  });
  const { data: applications = [], isLoading: loadingApps, refetch: refetchApps } = useQuery({
    queryKey: ["admin-grant-apps", selectedGrantId],
    queryFn: () => listAppsFn({ data: { grantId: selectedGrantId ?? undefined } }),
    refetchInterval: 10_000,
  });

  const fb = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 4000); };

  const handleCreate = async (data: any) => {
    await createFn({ data });
    setCreating(false); refetchGrants(); fb("Grant created.");
  };
  const handleUpdate = async (data: any) => {
    if (!editing) return;
    await updateFn({ data: { ...data, grantId: editing.id } });
    setEditing(null); refetchGrants(); fb("Grant updated.");
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this grant and all its applications?")) return;
    await deleteFn({ data: { grantId: id } });
    if (selectedGrantId === id) setSelectedGrantId(null);
    refetchGrants(); fb("Grant deleted.");
  };
  const handleAppStatus = async (appId: string, status: "approved" | "rejected") => {
    await updateAppFn({ data: { applicationId: appId, status } });
    refetchApps(); fb(`Application ${status}.`);
  };

  const selectedGrant = grants.find((g) => g.id === selectedGrantId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Grants Management</h1>
          <p className="text-sm text-white/50 mt-1">Create and manage grant programs. Review and approve user applications.</p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-amber-300"
        >
          <span className="text-lg leading-none">+</span> New Grant
        </button>
      </div>

      {feedback && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-300">{feedback}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Left: Grant List ── */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
            Grants ({grants.length})
          </h2>

          {creating && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
              <div className="mb-3 font-semibold text-amber-400">New Grant</div>
              <GrantForm onSave={handleCreate} onCancel={() => setCreating(false)} />
            </div>
          )}

          {loadingGrants ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />)
          ) : grants.length === 0 && !creating ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/30">
              No grants yet. Click "New Grant" to create one.
            </div>
          ) : (
            grants.map((g) => (
              <div key={g.id}>
                {editing?.id === g.id ? (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
                    <div className="mb-3 font-semibold text-amber-400">Edit Grant</div>
                    <GrantForm initial={g} onSave={handleUpdate} onCancel={() => setEditing(null)} />
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedGrantId(g.id === selectedGrantId ? null : g.id)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selectedGrantId === g.id
                        ? "border-amber-400/40 bg-amber-400/10"
                        : "border-white/10 bg-white/5 hover:bg-white/8"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-sm truncate">{g.title}</div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_STYLE[g.status]}`}>{g.status}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-white/40">
                      <span>${g.amount.toLocaleString()} max</span>
                      <span>{g.applicationCount} application{g.applicationCount !== 1 ? "s" : ""}</span>
                      {g.deadline && <span>Due {new Date(g.deadline).toLocaleDateString()}</span>}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditing(g); setCreating(false); }}
                        className="rounded px-2 py-0.5 text-[10px] border border-white/15 hover:bg-white/10"
                      >Edit</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(g.id); }}
                        className="rounded px-2 py-0.5 text-[10px] border border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >Delete</button>
                    </div>
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── Right: Applications ── */}
        <div className="lg:col-span-3">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
            {selectedGrant ? `Applications for "${selectedGrant.title}"` : "All Applications"}
            {" "}({applications.length})
          </h2>

          {loadingApps ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="mb-2 h-16 animate-pulse rounded-xl bg-white/5" />)
          ) : applications.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/30">
              {selectedGrantId ? "No applications for this grant yet." : "No applications yet across all grants."}
            </div>
          ) : (
            <div className="space-y-2">
              {applications.map((app) => (
                <div key={app.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{app.userName}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_STYLE[app.status]}`}>{app.status}</span>
                      </div>
                      <div className="text-[11px] text-white/40 mt-0.5">{app.userEmail} · {!selectedGrantId && <span className="text-amber-400/80">{app.grantTitle} · </span>}${app.amountRequested.toLocaleString()} requested · {new Date(app.createdAt).toLocaleDateString()}</div>
                      <div className="mt-2 text-xs text-white/60 leading-relaxed line-clamp-2">{app.purpose}</div>
                    </div>
                    {app.status === "pending" && (
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <button
                          onClick={() => handleAppStatus(app.id, "approved")}
                          className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30"
                        >✓ Approve</button>
                        <button
                          onClick={() => handleAppStatus(app.id, "rejected")}
                          className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/30"
                        >✗ Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
