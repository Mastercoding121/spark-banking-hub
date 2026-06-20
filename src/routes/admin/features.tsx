import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminGetFeatureFlags, adminSetFeatureFlag } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/features")({
  head: () => ({ meta: [{ title: "Platform Controls — FinextHub Admin" }] }),
  component: AdminFeatures,
});

const FEATURE_META: Record<string, { label: string; description: string; icon: string }> = {
  investments: { label: "Investments", description: "Stock trading, ETFs, IRAs, CDs, managed portfolios", icon: "📈" },
  grants:       { label: "Grants",       description: "Grant program — user applications and browsing",     icon: "🏛" },
  deposits:     { label: "Deposits",     description: "Users adding funds to checking or savings accounts", icon: "💰" },
  withdrawals:  { label: "Withdrawals",  description: "Users withdrawing or reducing account balances",     icon: "🏧" },
  transfers:    { label: "Transfers",    description: "Internal, ACH, Zelle, Apple Pay, and Chime transfers", icon: "🔄" },
  loans:        { label: "Loans",        description: "Loan applications and status tracking",               icon: "🏠" },
};

const PRESET_REASONS = [
  "Maintenance",
  "System Error",
  "Account at Risk",
  "Security Review",
  "Regulatory Compliance",
  "Fraud Prevention",
  "Other",
];

type FlagRow = { key: string; enabled: boolean; reason: string | null; details: string | null; updatedAt: string };

function DisableModal({
  flagKey, onClose, onSave,
}: {
  flagKey: string;
  onClose: () => void;
  onSave: (reason: string, details: string) => Promise<void>;
}) {
  const meta = FEATURE_META[flagKey] ?? { label: flagKey, description: "", icon: "⚙️" };
  const [reason, setReason] = useState(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  const effectiveReason = reason === "Other" ? customReason.trim() || "Other" : reason;

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(effectiveReason, details); onClose(); }
    catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6 shadow-2xl text-white">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <h3 className="font-bold text-lg">Disable {meta.label}</h3>
            <p className="text-xs text-white/50">This will show a System notice to users</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">Reason</span>
            <select
              value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm"
            >
              {PRESET_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          {reason === "Other" && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/60">Custom Reason</span>
              <input
                value={customReason} onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Brief reason…"
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm placeholder-white/30"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">Additional Instructions / Details (shown to users as System message)</span>
            <textarea
              value={details} onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder="Optional: Add specific instructions, expected resolution time, or alternative actions users can take…"
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm placeholder-white/30 resize-none"
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-white/20 py-2.5 text-sm font-medium hover:bg-white/5">Cancel</button>
          <button
            onClick={handleSave} disabled={saving}
            className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Disable Feature"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminFeatures() {
  const qc = useQueryClient();
  const getFlags = useServerFn(adminGetFeatureFlags);
  const setFlag = useServerFn(adminSetFeatureFlag);

  const [disabling, setDisabling] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: flags = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-feature-flags"],
    queryFn: () => getFlags({}),
    refetchInterval: 15_000,
  });

  const fb = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 3000); };

  const toggle = async (row: FlagRow, enable: boolean) => {
    if (!enable) {
      setDisabling(row.key);
      return;
    }
    try {
      await setFlag({ data: { key: row.key, enabled: true, reason: undefined, details: undefined } });
      refetch(); fb(`${FEATURE_META[row.key]?.label ?? row.key} re-enabled.`);
    } catch (e: any) { fb(e?.message ?? "Failed."); }
  };

  const saveDisable = async (key: string, reason: string, details: string) => {
    await setFlag({ data: { key, enabled: false, reason, details } });
    refetch(); fb(`${FEATURE_META[key]?.label ?? key} disabled.`);
  };

  const ALL_KEYS = Object.keys(FEATURE_META);
  const flagMap = Object.fromEntries(flags.map((f) => [f.key, f]));

  return (
    <div className="p-6 space-y-6">
      {disabling && (
        <DisableModal
          flagKey={disabling}
          onClose={() => setDisabling(null)}
          onSave={(reason, details) => saveDisable(disabling, reason, details)}
        />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Controls</h1>
          <p className="text-sm text-white/50 mt-1">Enable or disable features platform-wide. Users see a System notice when a feature is off.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/40">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-300">{feedback}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_KEYS.map((key) => {
          const meta = FEATURE_META[key];
          const row: FlagRow = flagMap[key] ?? { key, enabled: true, reason: null, details: null, updatedAt: "" };
          const isOn = row.enabled;

          return (
            <div key={key} className={`rounded-xl border p-5 transition ${isOn ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{meta.icon}</span>
                  <div>
                    <div className="font-semibold">{meta.label}</div>
                    <div className="text-[11px] text-white/40 mt-0.5">{meta.description}</div>
                  </div>
                </div>
                <button
                  onClick={() => toggle(row, !isOn)}
                  className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOn ? "bg-emerald-500" : "bg-red-600"}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isOn ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${isOn ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                  {isOn ? "● Active" : "○ Disabled"}
                </span>
                {row.updatedAt && (
                  <span className="text-[10px] text-white/30">
                    updated {new Date(row.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {!isOn && (row.reason || row.details) && (
                <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs">
                  {row.reason && <div className="font-semibold text-red-400 mb-0.5">{row.reason}</div>}
                  {row.details && <div className="text-white/50 leading-relaxed">{row.details}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">How Feature Flags Work</h3>
        <div className="grid gap-2 text-xs text-white/50 sm:grid-cols-2">
          <div className="flex items-start gap-2"><span className="text-emerald-400 shrink-0">✓</span> When <strong className="text-white/80">Active</strong>: feature works normally for all users</div>
          <div className="flex items-start gap-2"><span className="text-red-400 shrink-0">✗</span> When <strong className="text-white/80">Disabled</strong>: users see a "System" notice with your reason and instructions</div>
          <div className="flex items-start gap-2"><span className="text-amber-400 shrink-0">ℹ</span> <strong className="text-white/80">System</strong> is shown instead of "Admin" — all user-visible messages use neutral language</div>
          <div className="flex items-start gap-2"><span className="text-blue-400 shrink-0">🔒</span> Changes take effect immediately, no restart required</div>
        </div>
      </div>
    </div>
  );
}
