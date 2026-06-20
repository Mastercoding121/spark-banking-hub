import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useSyncExternalStore } from "react";
import { BankShell } from "@/components/BankShell";
import { submitLoanApplication, getLoanStatus, type LoanStatus } from "@/lib/finance.functions";
import { useHolder } from "@/lib/store";
import { authStore } from "@/lib/auth";
import { getFeatureFlags } from "@/lib/feature-flags.functions";

export const Route = createFileRoute("/loans")({
  head: () => ({
    meta: [
      { title: "Loans — FinextHub Bank of USA" },
      { name: "description", content: "Apply for personal, auto, mortgage, student, business, or home equity loans and track your application status live." },
    ],
  }),
  component: LoansPage,
});

// ─── Local loan ref tracking (client-side only, keyed by email) ───────────────
const LOAN_REFS_KEY = "fnx.loan.refs.v2";

function readRefs(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(LOAN_REFS_KEY) ?? "[]"); } catch { return []; }
}
function writeRefs(refs: string[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LOAN_REFS_KEY, JSON.stringify(refs)); } catch {}
}

let storedRefs = readRefs();
const refListeners = new Set<() => void>();

const loanRefStore = {
  subscribe: (l: () => void) => { refListeners.add(l); return () => { refListeners.delete(l); }; },
  getSnapshot: () => storedRefs,
  getServerSnapshot: () => [] as string[],
  add: (ref: string) => {
    if (!storedRefs.includes(ref)) {
      storedRefs = [...storedRefs, ref];
      writeRefs(storedRefs);
      refListeners.forEach((l) => l());
    }
  },
};

function useLoanRefs() {
  return useSyncExternalStore(loanRefStore.subscribe, loanRefStore.getSnapshot, loanRefStore.getServerSnapshot);
}

// ─── Types & constants ────────────────────────────────────────────────────────
type LoanProduct = {
  id: string; name: string; apr: number;
  minAmount: number; maxAmount: number; terms: number[]; blurb: string;
};

const PRODUCTS: LoanProduct[] = [
  { id: "personal", name: "Personal Loan", apr: 7.49, minAmount: 1000, maxAmount: 50000, terms: [12, 24, 36, 48, 60], blurb: "Unsecured, fixed-rate. Use it for anything." },
  { id: "auto", name: "Auto Loan", apr: 5.99, minAmount: 5000, maxAmount: 100000, terms: [36, 48, 60, 72, 84], blurb: "New & used vehicles. Pre-approval in minutes." },
  { id: "mortgage", name: "30-Yr Fixed Mortgage", apr: 6.25, minAmount: 50000, maxAmount: 2000000, terms: [180, 240, 360], blurb: "Buy or refinance your home." },
  { id: "heloc", name: "Home Equity Line", apr: 8.10, minAmount: 10000, maxAmount: 500000, terms: [60, 120, 180], blurb: "Tap your home's equity at a variable rate." },
  { id: "student", name: "Student Loan", apr: 4.99, minAmount: 1000, maxAmount: 75000, terms: [60, 120, 180], blurb: "Undergrad & grad. Defer payments while enrolled." },
  { id: "business", name: "Small Business Loan", apr: 8.75, minAmount: 5000, maxAmount: 500000, terms: [12, 24, 36, 60], blurb: "Working capital for growing businesses." },
];

function monthlyPayment(p: number, aprPct: number, months: number) {
  const r = aprPct / 100 / 12;
  if (r === 0) return p / months;
  return (p * r) / (1 - Math.pow(1 + r, -months));
}

const STEPS: LoanStatus[] = ["submitted", "underwriting", "approved"];
const STEP_LABEL: Record<LoanStatus, string> = {
  submitted: "Submitted",
  underwriting: "Underwriting",
  approved: "Approved",
};

// ─── Status tracker ───────────────────────────────────────────────────────────
function StatusTracker({ referenceId }: { referenceId: string }) {
  const fetchStatus = useServerFn(getLoanStatus);
  const statusQuery = useQuery({
    queryKey: ["loan-status", referenceId],
    queryFn: () => fetchStatus({ data: { referenceId } }),
    refetchInterval: 5_000,
  });

  const result = statusQuery.data;

  if (!result) return <div className="text-xs text-slate-500 animate-pulse">Loading status…</div>;
  if ("error" in result) return <div className="text-xs text-red-700">{result.error}</div>;

  const app = result.application;
  const currentIdx = STEPS.indexOf(app.status);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Application</div>
          <div className="text-lg font-bold">{app.referenceId}</div>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 capitalize">
          {STEP_LABEL[app.status] ?? app.status}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          {STEPS.map((step, i) => {
            const done = i <= currentIdx;
            const active = i === currentIdx;
            return (
              <div key={step} className="flex flex-1 flex-col items-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-red-700 text-white" : "bg-slate-100 text-slate-400"} ${active ? "ring-4 ring-red-200" : ""}`}
                >
                  {done ? "✓" : i + 1}
                </div>
                <div className={`mt-2 text-[11px] font-medium ${done ? "text-slate-900" : "text-slate-400"}`}>
                  {STEP_LABEL[step]}
                </div>
              </div>
            );
          })}
        </div>
        <div className="relative -mt-9 mx-9 h-1 rounded-full bg-slate-100">
          <div className="h-1 rounded-full bg-red-700 transition-all" style={{ width: `${Math.max(0, (currentIdx / (STEPS.length - 1)) * 100)}%` }} />
        </div>
      </div>

      {app.history?.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</div>
          {app.history.slice().reverse().map((h: any, i: number) => (
            <div key={i} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold">{STEP_LABEL[h.status as LoanStatus] ?? h.status}</span>
                <span className="text-slate-500">{new Date(h.at).toLocaleString()}</span>
              </div>
              {h.note && <div className="mt-1 text-slate-600">{h.note}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-md bg-slate-50 p-2">
          <div className="text-slate-500">Amount</div>
          <div className="font-semibold">${app.amount.toLocaleString()}</div>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <div className="text-slate-500">Term</div>
          <div className="font-semibold">{app.termMonths} months</div>
        </div>
      </div>

      {app.status === "approved" && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          ✓ Your loan has been approved. Funds will be disbursed to your checking account within 1–3 business days.
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function LoansPage() {
  const holder = useHolder();
  const currentUser = authStore.current();

  const flagsFn = useServerFn(getFeatureFlags);
  const apply = useServerFn(submitLoanApplication);

  const [selected, setSelected] = useState<LoanProduct>(PRODUCTS[0]);
  const [amount, setAmount] = useState(10000);
  const [term, setTerm] = useState(PRODUCTS[0].terms[2]);
  const [fullName, setFullName] = useState(holder || "");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [trackedRef, setTrackedRef] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");

  useEffect(() => {
    if (holder && !fullName) setFullName(holder);
    if (currentUser?.email && !email) setEmail(currentUser.email);
  }, [holder, currentUser]);

  const flagsQuery = useQuery({ queryKey: ["feature-flags"], queryFn: () => flagsFn({}), staleTime: 30_000 });

  const myRefs = useLoanRefs();
  const loansFlag = flagsQuery.data?.loans;

  const mutation = useMutation({
    mutationFn: (vars: { productId: string; amount: number; termMonths: number; fullName: string; email: string }) =>
      apply({ data: vars }),
    onSuccess: (res) => {
      setTrackedRef(res.referenceId);
      loanRefStore.add(res.referenceId);
    },
  });

  const payment = useMemo(() => monthlyPayment(amount, selected.apr, term), [amount, selected.apr, term]);
  const totalCost = payment * term;

  const handleSelect = (p: LoanProduct) => {
    setSelected(p);
    setAmount(Math.max(p.minAmount, Math.min(amount, p.maxAmount)));
    if (!p.terms.includes(term)) setTerm(p.terms[Math.floor(p.terms.length / 2)]);
  };

  if (flagsQuery.data && !loansFlag?.enabled) {
    return (
      <BankShell>
        <main className="mx-auto max-w-7xl px-4 py-16">
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-3xl">⚙️</div>
            <h2 className="text-xl font-bold text-slate-800">Loans Temporarily Unavailable</h2>
            {loansFlag?.reason && <p className="mt-2 text-sm font-semibold text-amber-700">{loansFlag.reason}</p>}
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              {loansFlag?.details || "Loan services are temporarily unavailable. Please check back later or contact support for assistance."}
            </p>
            <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400">— System</div>
          </div>
        </main>
      </BankShell>
    );
  }

  return (
    <BankShell>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">Loans & Lending</h1>
          <p className="text-sm text-slate-600">Pick a product, customize your terms, apply, and track your application in real time.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              className={`rounded-xl border p-5 text-left transition ${selected.id === p.id ? "border-red-600 bg-red-50 ring-2 ring-red-600/20" : "border-slate-200 bg-white hover:border-slate-400"}`}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500">from</div>
              </div>
              <div className="mt-1 text-2xl font-bold text-red-700">{p.apr.toFixed(2)}% <span className="text-xs font-medium text-slate-500">APR</span></div>
              <p className="mt-2 text-xs text-slate-600">{p.blurb}</p>
              <div className="mt-3 text-[11px] text-slate-500">${p.minAmount.toLocaleString()} – ${p.maxAmount.toLocaleString()}</div>
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Customize: {selected.name}</h2>
            <label className="block text-sm">
              <div className="mb-1 flex justify-between">
                <span className="text-slate-600">Loan amount</span>
                <span className="font-semibold">${amount.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={selected.minAmount} max={selected.maxAmount}
                step={Math.max(100, Math.round((selected.maxAmount - selected.minAmount) / 200))}
                value={amount} onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full accent-red-700"
              />
              <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                <span>${selected.minAmount.toLocaleString()}</span>
                <span>${selected.maxAmount.toLocaleString()}</span>
              </div>
            </label>

            <div className="mt-4">
              <div className="mb-1 text-sm text-slate-600">Term (months)</div>
              <div className="flex flex-wrap gap-2">
                {selected.terms.map((t) => (
                  <button key={t} onClick={() => setTerm(t)} className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${term === t ? "border-red-600 bg-red-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`}>
                    {t} mo
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-slate-900 p-4 text-white">
              <div className="text-xs uppercase tracking-wide opacity-70">Estimated Monthly Payment</div>
              <div className="mt-1 text-3xl font-bold">${payment.toFixed(2)}</div>
              <div className="mt-1 text-xs opacity-80">
                Total cost: ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} · APR {selected.apr.toFixed(2)}%
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Apply</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate({ productId: selected.id, amount, termMonths: term, fullName, email });
              }}
              className="space-y-3 text-sm"
            >
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Full Name</span>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" required />
              </label>
              <button disabled={mutation.isPending} className="w-full rounded-md bg-gradient-to-r from-red-700 to-red-800 py-2.5 text-sm font-semibold text-white hover:from-red-800 hover:to-red-900 disabled:opacity-60">
                {mutation.isPending ? "Submitting…" : "Submit Application"}
              </button>
              {mutation.isSuccess && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Application submitted! Reference: <strong>{mutation.data.referenceId}</strong>
                </div>
              )}
              {mutation.isError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {(mutation.error as Error).message}
                </div>
              )}
            </form>
          </section>
        </div>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold">Application Status</h2>
            <form
              onSubmit={(e) => { e.preventDefault(); if (lookup.trim()) setTrackedRef(lookup.trim().toUpperCase()); }}
              className="flex gap-2"
            >
              <input
                value={lookup} onChange={(e) => setLookup(e.target.value)}
                placeholder="Reference ID (LN-…)"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800">Track</button>
            </form>
          </div>
          {trackedRef ? (
            <StatusTracker referenceId={trackedRef} />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              Submit an application or enter a reference ID to track status: Submitted → Underwriting → Approved.
            </div>
          )}
        </section>

        {myRefs.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">My Applications</h2>
            <ul className="divide-y divide-slate-100">
              {myRefs.map((r) => (
                <li key={r} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-mono text-xs">{r}</span>
                  <button
                    onClick={() => setTrackedRef(r)}
                    className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:border-red-300 hover:text-red-700"
                  >
                    Track →
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </BankShell>
  );
}
