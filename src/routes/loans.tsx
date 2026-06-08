import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BankShell } from "@/components/BankShell";
import { submitLoanApplication } from "@/lib/finance.functions";

export const Route = createFileRoute("/loans")({
  head: () => ({
    meta: [
      { title: "Loans — Firestone Bank of USA" },
      { name: "description", content: "Apply for personal, auto, mortgage, student, business, or home equity loans with competitive APR." },
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
  terms: number[]; // months
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

function LoansPage() {
  const [selected, setSelected] = useState<LoanProduct>(PRODUCTS[0]);
  const [amount, setAmount] = useState(10000);
  const [term, setTerm] = useState(PRODUCTS[0].terms[2]);
  const [fullName, setFullName] = useState("John Doe");
  const [email, setEmail] = useState("john.doe@example.com");

  const apply = useServerFn(submitLoanApplication);
  const mutation = useMutation({ mutationFn: (vars: Parameters<typeof apply>[0]) => apply(vars) });

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
          <p className="text-sm text-slate-600">Pick a product, customize your terms, and apply in under 2 minutes.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p)}
              className={`rounded-xl border p-5 text-left transition ${
                selected.id === p.id
                  ? "border-red-600 bg-red-50 ring-2 ring-red-600/20"
                  : "border-slate-200 bg-white hover:border-slate-400"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500">from</div>
              </div>
              <div className="mt-1 text-2xl font-bold text-red-700">{p.apr.toFixed(2)}% <span className="text-xs font-medium text-slate-500">APR</span></div>
              <p className="mt-2 text-xs text-slate-600">{p.blurb}</p>
              <div className="mt-3 text-[11px] text-slate-500">
                ${p.minAmount.toLocaleString()} – ${p.maxAmount.toLocaleString()}
              </div>
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

              {mutation.data?.ok && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  ✓ {mutation.data.message} <br /> Reference: <strong>{mutation.data.referenceId}</strong>
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
      </main>
    </BankShell>
  );
}
