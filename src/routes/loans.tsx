import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BankShell } from "@/components/BankShell";
import { submitLoanApplication, getLoanStatus, type LoanStatus } from "@/lib/finance.functions";
import { loanRefStore, useLoanRefs, balanceStore, txStore, creditedLoanStore } from "@/lib/store";

export const Route = createFileRoute("/loans")({
  head: () => ({
    meta: [
      { title: "Loans — Firestone Bank of USA" },
      { name: "description", content: "Apply for personal, auto, mortgage, student, business, or home equity loans and track your application status live." },
    ],
  }),
  component: LoansPage,
});

type LoanProduct = {
  id: string;
  name: string;
  apr: number;
  minAmount: number;
  maxAmount: number;
  terms: number[];
  blurb: string;
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

function StatusTracker({ referenceId }: { referenceId: string }) {
  const fetchStatus = useServerFn(getLoanStatus);
  const statusQuery = useQuery({
    queryKey: ["loan-status", referenceId],
    queryFn: () => fetchStatus({ data: { referenceId } }),
    refetchInterval: 5_000,
  });

  const result = statusQuery.data;

  useEffect(() => {
    if (!result || "error" in result) return;
    const app = result.application;
    if (app.status === "approved" && !creditedLoanStore.has(app.referenceId)) {
      creditedLoanStore.add(app.referenceId);
      balanceStore.adjust("checking", app.amount);
      txStore.add({
        date: new Date().toISOString(),
        description: `Loan disbursement · ${app.referenceId}`,
        category: "Income",
        amount: app.amount,
      });
    }
  }, [result]);

  if (!result) return <div className="text-xs text-slate-500">Loading status…</div>;
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
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {STEP_LABEL[app.status]}
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
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                    done ? "bg-red-700 text-white" : "bg-slate-100 text-slate-400"
                  } ${active ? "ring-4 ring-red-200" : ""}`}
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
          <div
            className="h-1 rounded-full bg-red-700 transition-all"
            style={{ width: `${(currentIdx / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</div>
        {app.history.slice().reverse().map((h, i) => (
          <div key={i} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
            <div className="flex justify-between">
              <span className="font-semibold">{STEP_LABEL[h.status]}</span>
              <span className="text-slate-500">{new Date(h.at).toLocaleString()}</span>
            </div>
            <div className="mt-1 text-slate-600">{h.note}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-md bg-slate-50 p-2"><div className="text-slate-500">Amount</div><div className="font-semibold">${app.amount.toLocaleString()}</div></div>
        <div className="rounded-md bg-slate-50 p-2"><div className="text-slate-500">Term</div><div className="font-semibold">{app.termMonths} mo</div></div>
      </div>
    </div>
  );
}

function LoansPage() {
  const [selected, setSelected] = useState<LoanProduct>(PRODUCTS[0]);
  const [amount, setAmount] = useState(10000);
  const [term, setTerm] = useState(PRODUCTS[0].terms[2]);
  const [fullName, setFullName] = useState("John Doe");
  const [email, setEmail] = useState("john.doe@example.com");
  const [trackedRef, setTrackedRef] = useState<string | null>(null);
  const [lookup, setLookup] = useState("");

  const apply = useServerFn(submitLoanApplication);
  const myRefs = useLoanRefs();
  const mutation = useMutation({
    mutationFn: (vars: { productId: string; amount: number; termMonths: number; fullName: string; email: string }) =>
      apply({ data: vars }),
    onSuccess: (res) => { setTrackedRef(res.referenceId); loanRefStore.add(res.referenceId); },
  });

  const payment = useMemo(() => monthlyPayment(amount, selected.apr, term), [amount, selected.apr, term]);
  const totalCost = payment * term;

  const handleSelect = (p: LoanProduct) => {
    setSelected(p);
    setAmount(Math.max(p.minAmount, Math.min(amount, p.maxAmount)));
    if (!p.terms.includes(term)) setTerm(p.terms[Math.floor(p.terms.length / 2)]);
  };

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
              className={`rounded-xl border p-5 text-left transition ${
                selected.id === p.id ? "border-red-600 bg-red-50 ring-2 ring-red-600/20" : "border-slate-200 bg-white hover:border-slate-400"
              }`}
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
              <div className="mb-1 flex justify-between"><span className="text-slate-600">Loan amount</span><span className="font-semibold">${amount.toLocaleString()}</span></div>
              <input
                type="range"
                min={selected.minAmount}
                max={selected.maxAmount}
                step={Math.max(100, Math.round((selected.maxAmount - selected.minAmount) / 200))}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full accent-red-700"
              />
              <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                <span>${selected.minAmount.toLocaleString()}</span><span>${selected.maxAmount.toLocaleString()}</span>
              </div>
            </label>

            <div className="mt-4">
              <div className="mb-1 text-sm text-slate-600">Term (months)</div>
              <div className="flex flex-wrap gap-2">
                {selected.terms.map((t) => (
                  <button key={t} onClick={() => setTerm(t)} className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                    term === t ? "border-red-600 bg-red-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}>
                    {t} mo
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-slate-900 p-4 text-white">
              <div className="text-xs uppercase tracking-wide opacity-70">Estimated Monthly Payment</div>
              <div className="mt-1 text-3xl font-bold">${payment.toFixed(2)}</div>
              <div className="mt-1 text-xs opacity-80">Total cost: ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} · APR {selected.apr.toFixed(2)}%</div>
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
              {mutation.isError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {(mutation.error as Error).message}
                </div>
              )}
            </form>
          </section>
        </div>

        {/* Status tracker */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold">Application Status</h2>
            <form
              onSubmit={(e) => { e.preventDefault(); if (lookup.trim()) setTrackedRef(lookup.trim().toUpperCase()); }}
              className="flex gap-2"
            >
              <input
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
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
              Submit an application or enter a reference ID to see live status: Submitted → Underwriting → Approved.
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
                  <Link to="/loans/$id" params={{ id: r }} className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:border-red-300 hover:text-red-700">
                    View details →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </BankShell>
  );
}
