import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BankShell } from "@/components/BankShell";
import { TRANSACTIONS, CATEGORIES } from "@/lib/transactions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Firestone Bank of USA - Online Banking" },
      { name: "description", content: "Manage accounts, transfer funds, apply for loans, and trade investments with Firestone Bank of USA." },
    ],
  }),
  component: Dashboard,
});

type TransferMethod = "internal" | "ach" | "zelle" | "applepay" | "chime";

function Dashboard() {
  const [method, setMethod] = useState<TransferMethod>("internal");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [routing, setRouting] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  // Transaction filter state
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [type, setType] = useState<"all" | "credit" | "debit">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return TRANSACTIONS.filter((t) => {
      if (query && !t.description.toLowerCase().includes(query.toLowerCase())) return false;
      if (category !== "All" && t.category !== category) return false;
      if (type === "credit" && t.amount <= 0) return false;
      if (type === "debit" && t.amount >= 0) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      return true;
    });
  }, [query, category, type, from, to]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return setStatus("Please enter a valid amount.");
    setStatus(`Transfer of $${Number(amount).toFixed(2)} initiated via ${labelFor(method)}.`);
  };

  return (
    <BankShell>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section>
          <h1 className="mb-3 text-lg font-semibold">Account Summary</h1>
          <div className="grid gap-4 sm:grid-cols-2">
            <AccountCard name="Firestone Checking" mask="4829" balance="$5,842.20" />
            <AccountCard name="Firestone Growth Savings" mask="9104" balance="$24,150.85" sub="APY: 4.25%" />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Quick Services</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <ServiceTile label="Zelle" sub="Send in minutes" accent="from-violet-600 to-purple-700" icon="Z" active={method === "zelle"} onClick={() => setMethod("zelle")} />
            <ServiceTile label="Apple Pay" sub="Tap to pay" accent="from-slate-800 to-black" icon="" active={method === "applepay"} onClick={() => setMethod("applepay")} />
            <ServiceTile label="Chime" sub="Instant transfer" accent="from-emerald-500 to-emerald-700" icon="C" active={method === "chime"} onClick={() => setMethod("chime")} />
            <LinkTile to="/loans" label="Loans" sub="Apply & manage" accent="from-blue-600 to-blue-800" icon="$" />
            <LinkTile to="/investments" label="Investments" sub="Live market rates" accent="from-amber-500 to-orange-600" icon="↗" />
            <LinkTile to="/support" label="24/7 Support" sub="Chat with an agent" accent="from-rose-500 to-red-700" icon="☎" />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Transactions with filter */}
          <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Transactions</h2>
              <span className="text-xs text-slate-500">{filtered.length} of {TRANSACTIONS.length}</span>
            </div>

            <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search description…"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm lg:col-span-2"
              />
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                <option>All</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select value={type} onChange={(e) => setType(e.target.value as any)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="all">All amounts</option>
                <option value="credit">Credits only</option>
                <option value="debit">Debits only</option>
              </select>
              <div className="flex gap-1">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs" />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Description</th>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-sm text-slate-500">No transactions match.</td></tr>
                  )}
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-3 text-slate-600">{t.date}</td>
                      <td className="py-3 pr-3 font-medium">{t.description}</td>
                      <td className="py-3 pr-3"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t.category}</span></td>
                      <td className={`py-3 text-right font-semibold ${t.amount > 0 ? "text-emerald-700" : "text-slate-900"}`}>
                        {t.amount > 0 ? "+" : "-"}${Math.abs(t.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Transfer form */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Transfer Funds</h2>
            <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
              {(["internal", "ach", "zelle"] as TransferMethod[]).map((m) => (
                <button key={m} onClick={() => setMethod(m)} className={`rounded-md py-1.5 capitalize transition ${method === m ? "bg-white text-red-700 shadow-sm" : "text-slate-600"}`}>
                  {m === "ach" ? "ACH" : m}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-sm">
              <Field label="From Account">
                <select className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
                  <option>Firestone Checking (...4829) - $5,842.20</option>
                  <option>Firestone Growth Savings (...9104) - $24,150.85</option>
                </select>
              </Field>

              {method === "ach" && (
                <>
                  <Field label="Recipient Name">
                    <input value={recipient} onChange={(e) => setRecipient(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Jane Smith" />
                  </Field>
                  <Field label="Routing Number">
                    <input value={routing} onChange={(e) => setRouting(e.target.value)} maxLength={9} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="9 digits" />
                  </Field>
                </>
              )}
              {method === "zelle" && (
                <Field label="Recipient Email or Phone">
                  <input value={recipient} onChange={(e) => setRecipient(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="email or phone" />
                </Field>
              )}
              {method === "chime" && (
                <Field label="Chime $Cashtag">
                  <input value={recipient} onChange={(e) => setRecipient(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="$username" />
                </Field>
              )}

              <Field label="Amount">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-full rounded-md border border-slate-300 px-3 py-2 pl-7" placeholder="0.00" />
                </div>
              </Field>

              <button type="submit" className="w-full rounded-md bg-gradient-to-r from-red-700 to-red-800 py-2.5 text-sm font-semibold text-white hover:from-red-800 hover:to-red-900">
                Send via {labelFor(method)}
              </button>

              {status && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{status}</div>}
            </form>
          </section>
        </div>
      </main>
    </BankShell>
  );
}

function labelFor(m: TransferMethod) {
  return { internal: "Internal Transfer", ach: "ACH", zelle: "Zelle", applepay: "Apple Pay", chime: "Chime" }[m];
}

function AccountCard({ name, mask, balance, sub }: { name: string; mask: string; balance: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{name} (...{mask})</div>
      <div className="mt-2 text-3xl font-bold">{balance}</div>
      {sub && <div className="mt-1 text-xs font-medium text-emerald-700">{sub}</div>}
    </div>
  );
}

function ServiceTile({ label, sub, accent, icon, active, onClick }: { label: string; sub: string; accent: string; icon: string; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${accent} p-4 text-left text-white shadow-sm transition hover:shadow-md ${active ? "ring-2 ring-offset-2 ring-red-600" : ""}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-lg font-bold backdrop-blur">{icon}</div>
      <div className="mt-3 text-sm font-semibold">{label}</div>
      <div className="text-[11px] opacity-80">{sub}</div>
    </button>
  );
}

function LinkTile({ to, label, sub, accent, icon }: { to: string; label: string; sub: string; accent: string; icon: string }) {
  return (
    <Link to={to} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${accent} p-4 text-left text-white shadow-sm transition hover:shadow-md`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-lg font-bold backdrop-blur">{icon}</div>
      <div className="mt-3 text-sm font-semibold">{label}</div>
      <div className="text-[11px] opacity-80">{sub}</div>
    </Link>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
