import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Firestone Bank of USA - Online Banking" },
      { name: "description", content: "Secure online banking with Firestone Bank of USA. Manage accounts, transfer funds via Zelle, Apple Pay, Chime, and access loans and investments." },
      { property: "og:title", content: "Firestone Bank of USA - Online Banking" },
      { property: "og:description", content: "Secure online banking dashboard." },
    ],
  }),
  component: Dashboard,
});

type TransferMethod = "internal" | "ach" | "zelle" | "applepay" | "chime";

function Dashboard() {
  const [method, setMethod] = useState<TransferMethod>("internal");
  const [fromAccount, setFromAccount] = useState("checking");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [routing, setRouting] = useState("");
  const [toAccount, setToAccount] = useState("savings");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setStatus("Please enter a valid amount.");
      return;
    }
    setStatus(`Transfer of $${Number(amount).toFixed(2)} initiated via ${labelFor(method)}.`);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-700 to-red-900 text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/15 backdrop-blur">
              <span className="text-xl font-bold">F</span>
            </div>
            <div className="leading-tight">
              <div className="text-lg font-bold tracking-tight">FIRESTONE</div>
              <div className="text-[10px] uppercase tracking-widest opacity-80">Bank of USA</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden sm:inline">Welcome back, <span className="font-semibold">John Doe</span></span>
            <button className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20">Secure Logout</button>
          </div>
        </div>
      </header>

      {/* Security notice */}
      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs text-amber-900">
          <span>🔒</span>
          <span><strong>Security Notice:</strong> Your connection is encrypted with 256-bit SSL.</span>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {/* Account Summary */}
        <section>
          <h2 className="mb-3 text-lg font-semibold">Account Summary</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <AccountCard name="Firestone Checking" mask="4829" balance="$5,842.20" />
            <AccountCard name="Firestone Growth Savings" mask="9104" balance="$24,150.85" sub="APY: 4.25%" />
          </div>
        </section>

        {/* Quick Services Grid */}
        <section>
          <h2 className="mb-3 text-lg font-semibold">Quick Services</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <ServiceTile
              label="Zelle"
              sub="Send in minutes"
              accent="from-violet-600 to-purple-700"
              icon="Z"
              active={method === "zelle"}
              onClick={() => setMethod("zelle")}
            />
            <ServiceTile
              label="Apple Pay"
              sub="Tap to pay"
              accent="from-slate-800 to-black"
              icon=""
              active={method === "applepay"}
              onClick={() => setMethod("applepay")}
            />
            <ServiceTile
              label="Chime"
              sub="Instant transfer"
              accent="from-emerald-500 to-emerald-700"
              icon="C"
              active={method === "chime"}
              onClick={() => setMethod("chime")}
            />
            <ServiceTile
              label="Loans"
              sub="Apply & manage"
              accent="from-blue-600 to-blue-800"
              icon="$"
              onClick={() => setStatus("Loans portal coming soon.")}
            />
            <ServiceTile
              label="Investments"
              sub="Grow your wealth"
              accent="from-amber-500 to-orange-600"
              icon="↗"
              onClick={() => setStatus("Investments portal coming soon.")}
            />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Transactions */}
          <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Transactions</h2>
              <button className="text-sm font-medium text-red-700 hover:underline">View All</button>
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
                  <TxnRow date="Jun 05, 2026" desc="Starbucks Coffee #4821" cat="Food & Dining" amt="-$24.50" />
                  <TxnRow date="May 28, 2026" desc="Amazon.com Marketplace" cat="Shopping" amt="-$112.50" />
                  <TxnRow date="May 25, 2026" desc="Payroll Deposit" cat="Income" amt="+$3,420.00" positive />
                  <TxnRow date="May 22, 2026" desc="Shell Gas Station" cat="Transport" amt="-$48.20" />
                </tbody>
              </table>
            </div>
          </section>

          {/* Transfer Funds */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Transfer Funds</h2>

            <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
              {(["internal", "ach", "zelle"] as TransferMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-md py-1.5 capitalize transition ${
                    method === m ? "bg-white text-red-700 shadow-sm" : "text-slate-600"
                  }`}
                >
                  {m === "ach" ? "ACH" : m}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-sm">
              <Field label="From Account">
                <select
                  value={fromAccount}
                  onChange={(e) => setFromAccount(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="checking">Firestone Checking (...4829) - $5,842.20</option>
                  <option value="savings">Firestone Growth Savings (...9104) - $24,150.85</option>
                </select>
              </Field>

              {method === "internal" && (
                <Field label="To Account">
                  <select
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="savings">Firestone Growth Savings (...9104)</option>
                    <option value="checking">Firestone Checking (...4829)</option>
                  </select>
                </Field>
              )}

              {method === "ach" && (
                <>
                  <Field label="Recipient Name">
                    <input
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                      placeholder="Jane Smith"
                    />
                  </Field>
                  <Field label="Routing Number">
                    <input
                      value={routing}
                      onChange={(e) => setRouting(e.target.value)}
                      inputMode="numeric"
                      maxLength={9}
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                      placeholder="9 digits"
                    />
                  </Field>
                  <Field label="Account Number">
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                      placeholder="Account #"
                    />
                  </Field>
                </>
              )}

              {method === "zelle" && (
                <Field label="Recipient Email or Phone">
                  <input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    placeholder="email@example.com or (555) 555-5555"
                  />
                </Field>
              )}

              {method === "applepay" && (
                <div className="rounded-md bg-slate-900 px-3 py-3 text-center text-xs text-white">
                   Pay — confirm on your device
                </div>
              )}

              {method === "chime" && (
                <Field label="Chime $Cashtag">
                  <input
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    placeholder="$username"
                  />
                </Field>
              )}

              <Field label="Amount">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 pl-7"
                    placeholder="0.00"
                  />
                </div>
              </Field>

              <Field label="Memo (optional)">
                <input
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  placeholder="What's it for?"
                />
              </Field>

              <button
                type="submit"
                className="w-full rounded-md bg-gradient-to-r from-red-700 to-red-800 py-2.5 text-sm font-semibold text-white hover:from-red-800 hover:to-red-900"
              >
                Send via {labelFor(method)}
              </button>

              {status && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  {status}
                </div>
              )}
            </form>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        © 2026 Firestone Bank of USA. Member FDIC. Equal Housing Lender.
      </footer>
    </div>
  );
}

function labelFor(m: TransferMethod) {
  return { internal: "Internal Transfer", ach: "ACH", zelle: "Zelle", applepay: "Apple Pay", chime: "Chime" }[m];
}

function AccountCard({ name, mask, balance, sub }: { name: string; mask: string; balance: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{name} (...{mask})</div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{balance}</div>
      {sub && <div className="mt-1 text-xs font-medium text-emerald-700">{sub}</div>}
      <div className="mt-4 flex gap-2">
        <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50">Details</button>
        <button className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">Statements</button>
      </div>
    </div>
  );
}

function ServiceTile({
  label, sub, accent, icon, active, onClick,
}: { label: string; sub: string; accent: string; icon: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${accent} p-4 text-left text-white shadow-sm transition hover:shadow-md ${
        active ? "ring-2 ring-offset-2 ring-red-600" : ""
      }`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-lg font-bold backdrop-blur">
        {icon}
      </div>
      <div className="mt-3 text-sm font-semibold">{label}</div>
      <div className="text-[11px] opacity-80">{sub}</div>
    </button>
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

function TxnRow({ date, desc, cat, amt, positive }: { date: string; desc: string; cat: string; amt: string; positive?: boolean }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-3 pr-3 text-slate-600">{date}</td>
      <td className="py-3 pr-3 font-medium">{desc}</td>
      <td className="py-3 pr-3">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{cat}</span>
      </td>
      <td className={`py-3 text-right font-semibold ${positive ? "text-emerald-700" : "text-slate-900"}`}>{amt}</td>
    </tr>
  );
}
