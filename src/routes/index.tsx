import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BankShell } from "@/components/BankShell";
import { TRANSACTIONS, CATEGORIES } from "@/lib/transactions";
import { sendChimeTransfer, initiateApplePay } from "@/lib/finance.functions";

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

  const chime = useServerFn(sendChimeTransfer);
  const applepay = useServerFn(initiateApplePay);
  const chimeMut = useMutation({ mutationFn: (v: { cashtag: string; amount: number }) => chime({ data: v }) });
  const applepayMut = useMutation({ mutationFn: (v: { amount: number }) => applepay({ data: v }) });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return setStatus("Please enter a valid amount.");
    setStatus(null);
    if (method === "chime") {
      chimeMut.mutate(
        { cashtag: recipient, amount: amt },
        { onSuccess: (r) => setStatus(`${r.message} · ${r.eta} · ${r.transferId}`), onError: (e) => setStatus((e as Error).message) },
      );
    } else if (method === "applepay") {
      applepayMut.mutate(
        { amount: amt },
        { onSuccess: (r) => setStatus(`${r.message} · Session ${r.sessionId}`), onError: (e) => setStatus((e as Error).message) },
      );
    } else {
      setStatus(`Transfer of $${amt.toFixed(2)} initiated via ${labelFor(method)}.`);
    }
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
            <LinkTile to="/loans" label="Loans" sub="Apply & track" accent="from-blue-600 to-blue-800" icon="$" />
            <LinkTile to="/investments" label="Investments" sub="Live market rates" accent="from-amber-500 to-orange-600" icon="↗" />
            <ServiceTile label="Transfers" sub="Internal · ACH · Wire" accent="from-red-600 to-red-800" icon="⇄" active={method === "internal" || method === "ach"} onClick={() => setMethod("internal")} />
            <ServiceTile label="Zelle" sub="Send in minutes" accent="from-violet-600 to-purple-700" icon="Z" active={method === "zelle"} onClick={() => setMethod("zelle")} />
            <ServiceTile label="Apple Pay" sub="Tap to pay" accent="from-slate-800 to-black" icon="" active={method === "applepay"} onClick={() => setMethod("applepay")} />
            <ServiceTile label="Chime" sub="Instant transfer" accent="from-emerald-500 to-emerald-700" icon="C" active={method === "chime"} onClick={() => setMethod("chime")} />
          </div>
        </section>

        {/* Transfer form — promoted above transactions */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Transfer Funds</h2>
          <div className="mb-4 grid grid-cols-5 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
            {(["internal", "ach", "zelle", "applepay", "chime"] as TransferMethod[]).map((m) => (
              <button key={m} onClick={() => setMethod(m)} className={`rounded-md py-1.5 capitalize transition ${method === m ? "bg-white text-red-700 shadow-sm" : "text-slate-600"}`}>
                {labelFor(m)}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="grid gap-3 text-sm sm:grid-cols-2">
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
            {method === "applepay" && (
              <Field label="Apple Pay">
                <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  You'll confirm with Face ID / Touch ID on your device after submitting.
                </div>
              </Field>
            )}

            <Field label="Amount">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-full rounded-md border border-slate-300 px-3 py-2 pl-7" placeholder="0.00" />
              </div>
            </Field>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={chimeMut.isPending || applepayMut.isPending}
                className="w-full rounded-md bg-gradient-to-r from-red-700 to-red-800 py-2.5 text-sm font-semibold text-white hover:from-red-800 hover:to-red-900 disabled:opacity-60"
              >
                {chimeMut.isPending || applepayMut.isPending ? "Processing…" : `Send via ${labelFor(method)}`}
              </button>
              {status && <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{status}</div>}
            </div>
          </form>
        </section>

        {/* Transactions — moved down */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
      </main>
    </BankShell>
  );
}

function labelFor(m: TransferMethod) {
  return { internal: "Internal", ach: "ACH", zelle: "Zelle", applepay: "Apple Pay", chime: "Chime" }[m];
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
