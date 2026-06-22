import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { BankShell } from "@/components/BankShell";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EnhancedLoadingScreen } from "@/components/EnhancedLoadingScreen";
import { getPublicGrants, applyForGrant, getMyGrantApplications, type Grant } from "@/lib/grants.functions";
import { getFeatureFlags } from "@/lib/feature-flags.functions";

export const Route = createFileRoute("/grants")({
  head: () => ({
    meta: [
      { title: "Grants — FinextHub Bank of USA" },
      { name: "description", content: "Apply for FinextHub grants and financial assistance programs." },
    ],
  }),
  component: GrantsPage,
});

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

function SystemNotice({ reason, details }: { reason?: string | null; details?: string | null }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-3xl">⚙️</div>
      <h2 className="text-xl font-bold text-slate-800">Grants Temporarily Unavailable</h2>
      {reason && <p className="mt-2 text-sm font-medium text-amber-700">{reason}</p>}
      <p className="mt-2 text-sm text-slate-500">
        {details || "The Grants program is temporarily unavailable. Please check back later or contact support for assistance."}
      </p>
      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400">
        — System
      </div>
    </div>
  );
}

function ApplyModal({ grant, onClose, onSuccess }: { grant: Grant; onClose: () => void; onSuccess: () => void }) {
  const applyFn = useServerFn(applyForGrant);
  const [purpose, setPurpose] = useState("");
  const [amount, setAmount] = useState(String(grant.amount));

  const mutation = useMutation({
    mutationFn: () => applyFn({ data: { grantId: grant.id, purpose, amountRequested: parseFloat(amount) } }),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">Apply — {grant.title}</h3>
            <p className="text-sm text-slate-500">Max grant: ${grant.amount.toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 text-slate-400">✕</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Amount Requested ($)</span>
            <input
              type="number" min="1" max={grant.amount} step="0.01"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Purpose / How will you use this grant?</span>
            <textarea
              value={purpose} onChange={(e) => setPurpose(e.target.value)}
              rows={5} minLength={20}
              placeholder="Describe in detail how you plan to use the grant funds (minimum 20 characters)…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <span className="text-[11px] text-slate-400">{purpose.length}/20 characters minimum</span>
          </label>

          {mutation.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{(mutation.error as Error).message}</div>
          )}
          {mutation.isSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">✓ Application submitted successfully!</div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium hover:bg-slate-50">Cancel</button>
            <button
              type="submit" disabled={mutation.isPending}
              className="flex-1 rounded-lg bg-gradient-to-r from-red-700 to-red-800 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {mutation.isPending ? "Submitting…" : "Submit Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GrantsPage() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const flagsFn = useServerFn(getFeatureFlags);
  const grantsFn = useServerFn(getPublicGrants);
  const myAppsFn = useServerFn(getMyGrantApplications);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate({ to: "/" });
    } else {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 2500); // 2.5 seconds
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, navigate]);

  const [applyGrant, setApplyGrant] = useState<Grant | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const flagsQuery = useQuery({ queryKey: ["feature-flags"], queryFn: () => flagsFn({}), staleTime: 30_000 });
  const grantsQuery = useQuery({ queryKey: ["public-grants"], queryFn: () => grantsFn({}) });
  const myAppsQuery = useQuery({ queryKey: ["my-grant-apps"], queryFn: () => myAppsFn({}) });

  const grantsFlag = flagsQuery.data?.grants;
  
  if (isLoading) {
    return (
      <EnhancedLoadingScreen
        title="Preparing your grants…"
        subtitle="Please wait while we load your account data."
      />
    );
  }

  if (flagsQuery.data && !grantsFlag?.enabled) {
    return (
      <BankShell>
        <main className="mx-auto max-w-7xl px-4 py-16">
          <SystemNotice reason={grantsFlag?.reason} details={grantsFlag?.details} />
        </main>
      </BankShell>
    );
  }

  const grants = grantsQuery.data ?? [];
  const myApps = myAppsQuery.data ?? [];
  const appliedGrantIds = new Set(myApps.map((a) => a.grantId));

  return (
    <BankShell>
      {applyGrant && (
        <ApplyModal
          grant={applyGrant}
          onClose={() => setApplyGrant(null)}
          onSuccess={() => {
            setSuccessMsg("Your application has been submitted and is under review.");
            myAppsQuery.refetch();
            setTimeout(() => setSuccessMsg(null), 5000);
          }}
        />
      )}

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-red-700 via-red-800 to-red-900 p-8 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xl">🏛</div>
            <span className="text-xs font-semibold uppercase tracking-widest text-white/60">FinextHub Grants Program</span>
          </div>
          <h1 className="text-3xl font-bold">Financial Assistance Grants</h1>
          <p className="mt-2 max-w-xl text-white/70">
            FinextHub supports individuals and small businesses through our grants program. Apply for funding to help achieve your financial goals.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <span className="text-amber-300">✓</span> No repayment required
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <span className="text-amber-300">✓</span> Fast review process
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
              <span className="text-amber-300">✓</span> FDIC-backed program
            </div>
          </div>
        </div>

        {successMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">✓ {successMsg}</div>
        )}

        {/* Available Grants */}
        <div>
          <h2 className="mb-4 text-xl font-bold">Available Grants</h2>
          {grantsQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : grants.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-slate-500">No grants are currently available. Check back soon.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grants.map((g) => {
                const alreadyApplied = appliedGrantIds.has(g.id);
                return (
                  <div key={g.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-red-300 transition">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-800 leading-snug">{g.title}</h3>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Active</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 flex-1 leading-relaxed">{g.description}</p>

                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Max Amount</span>
                        <span className="font-bold text-red-700">${g.amount.toLocaleString()}</span>
                      </div>
                      {g.eligibilityText && (
                        <div className="flex items-start gap-1.5 text-xs text-slate-500">
                          <span className="shrink-0">📋</span> <span>{g.eligibilityText}</span>
                        </div>
                      )}
                      {g.deadline && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span>📅</span> Deadline: {new Date(g.deadline).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setApplyGrant(g)}
                      disabled={alreadyApplied}
                      className={`mt-4 w-full rounded-lg py-2.5 text-sm font-semibold transition ${
                        alreadyApplied
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-red-700 to-red-800 text-white hover:from-red-800 hover:to-red-900"
                      }`}
                    >
                      {alreadyApplied ? "✓ Applied" : "Apply Now"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My Applications */}
        {myApps.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-bold">My Applications</h2>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Grant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Applied</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myApps.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{a.grantTitle}</td>
                      <td className="px-4 py-3 text-slate-600">${a.amountRequested.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(a.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${STATUS_STYLES[a.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </BankShell>
  );
}
