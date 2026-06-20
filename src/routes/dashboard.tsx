import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BankShell } from "@/components/BankShell";
import { sendChimeTransfer, initiateApplePay } from "@/lib/finance.functions";
import { getFeatureFlags } from "@/lib/feature-flags.functions";
import {
  getTransactions, getAccounts, addTransaction,
  transferBetweenAccounts, recordExternalTransfer,
  CATEGORIES,
} from "@/lib/account.functions";
import { ACCOUNT_DETAILS, useHolder } from "@/lib/store";
import { ReceiptModal, type ReceiptData } from "@/components/Receipt";
import { SecurityPrompt } from "@/components/SecurityPrompt";
import { AccountDetailsModal, type AccountKey } from "@/components/AccountDetails";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FinextHub Bank of USA" },
      { name: "description", content: "Your FinextHub Bank dashboard: balances, transfers, recent transactions." },
    ],
  }),
  component: Dashboard,
});

type TransferMethod = "internal" | "ach" | "zelle" | "applepay" | "chime";

function Dashboard() {
  const qc = useQueryClient();
  const holder = useHolder();
  const [openAccount, setOpenAccount] = useState<AccountKey | null>(null);

  const flagsFn = useServerFn(getFeatureFlags);
  const getTransactionsFn = useServerFn(getTransactions);
  const getAccountsFn = useServerFn(getAccounts);
  const transferFn = useServerFn(transferBetweenAccounts);
  const externalFn = useServerFn(recordExternalTransfer);
  const chimeFn = useServerFn(sendChimeTransfer);
  const applePayFn = useServerFn(initiateApplePay);

  const txQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: () => getTransactionsFn({}),
    staleTime: 30_000,
  });

  const accQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: () => getAccountsFn({}),
    staleTime: 30_000,
  });

  const flagsQuery = useQuery({ queryKey: ["feature-flags"], queryFn: () => flagsFn({}), staleTime: 30_000 });

  const transactions = txQuery.data ?? [];
  const accounts = accQuery.data ?? [];
  const checking = accounts.find((a) => a.type === "checking")?.balance ?? 0;
  const savings = accounts.find((a) => a.type === "savings")?.balance ?? 0;

  const transfersEnabled = !flagsQuery.data || flagsQuery.data.transfers.enabled;
  const depositsEnabled  = !flagsQuery.data || flagsQuery.data.deposits.enabled;
  const withdrawalsEnabled = !flagsQuery.data || flagsQuery.data.withdrawals.enabled;

  const [method, setMethod] = useState<TransferMethod>("internal");
  const [fromAcc, setFromAcc] = useState<"checking" | "savings">("checking");
  const [toAcc, setToAcc] = useState<"checking" | "savings">("savings");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [routing, setRouting] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [pendingAuth, setPendingAuth] = useState<null | { amt: number }>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [txType, setTxType] = useState<"all" | "credit" | "debit">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (searchQuery && !t.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (category !== "All" && t.category !== category) return false;
      if (txType === "credit" && t.amount <= 0) return false;
      if (txType === "debit" && t.amount >= 0) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      return true;
    });
  }, [transactions, searchQuery, category, txType, from, to]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
  };

  const finalizeTransfer = (opts: { reference: string; eta: string; methodLabel: string; toLabel: string; amt: number }) => {
    setReceipt({
      title: `${opts.methodLabel} Transfer`,
      reference: opts.reference,
      amount: opts.amt,
      method: opts.methodLabel,
      from: `FinextHub ${opts.methodLabel === "Internal" ? (fromAcc === "checking" ? "Checking" : "Savings") : "Checking"}`,
      to: opts.toLabel,
      status: "Completed",
      date: new Date().toISOString(),
      memo: memo || undefined,
    });
    setStatus(`${opts.methodLabel}: $${opts.amt.toFixed(2)} sent · ${opts.reference}`);
    setAmount(""); setRecipient(""); setMemo(""); setRouting("");
    invalidate();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return setStatus("Please enter a valid amount.");
    if (method !== "chime" && method !== "applepay" && amt > (fromAcc === "checking" ? checking : savings))
      return setStatus("Insufficient funds.");
    setStatus(null);
    setPendingAuth({ amt });
  };

  const executeTransfer = async (amt: number) => {
    try {
      if (method === "internal") {
        const r = await transferFn({ data: { fromAccount: fromAcc, toAccount: toAcc, amount: amt } });
        finalizeTransfer({
          reference: (r as any).reference,
          eta: "Posted instantly",
          methodLabel: "Internal",
          toLabel: `FinextHub ${toAcc === "checking" ? "Checking" : "Savings"}`,
          amt,
        });
      } else if (method === "chime") {
        const r = await chimeFn({ data: { cashtag: recipient, amount: amt, memo } });
        await externalFn({ data: { amount: amt, description: `Chime to ${recipient}`, method: "Chime" } });
        finalizeTransfer({ reference: r.transferId, eta: r.eta, methodLabel: "Chime", toLabel: recipient, amt });
      } else if (method === "applepay") {
        const r = await applePayFn({ data: { amount: amt } });
        await externalFn({ data: { amount: amt, description: "Apple Pay payment", method: "Apple Pay" } });
        finalizeTransfer({ reference: r.sessionId, eta: "Confirmed on device", methodLabel: "Apple Pay", toLabel: r.merchant, amt });
      } else {
        const label = labelFor(method);
        const toLabel = recipient || (method === "ach" ? "ACH recipient" : "Recipient");
        const r = await externalFn({ data: { amount: amt, description: `${label} to ${toLabel}`, method: label } });
        finalizeTransfer({ reference: (r as any).reference, eta: "1–3 business days", methodLabel: label, toLabel, amt });
      }
    } catch (err: any) {
      setStatus(err?.message ?? "Transfer failed.");
    }
  };

  const openAccountBalance = openAccount === "checking" ? checking : savings;

  return (
    <BankShell>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">

        {/* Welcome */}
        <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-red-700 to-red-900 p-5 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-widest opacity-80">Welcome back</div>
              <div className="text-2xl font-bold">{holder || "Account Holder"}</div>
              <div className="text-xs opacity-80" suppressHydrationWarning>FinextHub Online Banking · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
            </div>
            {accQuery.isFetching && <div className="text-xs opacity-70 animate-pulse">Refreshing…</div>}
          </div>
        </section>

        {/* Accounts */}
        <section>
          <h2 className="mb-3 text-lg font-semibold">Account Summary</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <AccountCard
              name="FinextHub Checking"
              balance={`$${checking.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              loading={accQuery.isLoading}
              onClick={() => setOpenAccount("checking")}
            />
            <AccountCard
              name="FinextHub Growth Savings"
              balance={`$${savings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              sub="APY: 4.25%"
              loading={accQuery.isLoading}
              onClick={() => setOpenAccount("savings")}
            />
          </div>
        </section>

        {/* Quick services */}
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

        {/* Transfer panel */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Transfer Funds</h2>

          {/* System flag notices */}
          {!transfersEnabled && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
              <div className="text-2xl mb-2">⚙️</div>
              <p className="font-semibold text-amber-800 text-sm">Transfers Temporarily Unavailable</p>
              {flagsQuery.data?.transfers.reason && <p className="text-xs text-amber-700 mt-1">{flagsQuery.data.transfers.reason}</p>}
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{flagsQuery.data?.transfers.details || "Transfer services are temporarily unavailable. Please check back later."}</p>
              <p className="text-[10px] text-slate-400 mt-3">— System</p>
            </div>
          )}
          {transfersEnabled && !depositsEnabled && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs">
              <span className="font-semibold text-amber-800">Deposits: </span>
              <span className="text-amber-700">{flagsQuery.data?.deposits.reason || "Deposits"} temporarily unavailable. {flagsQuery.data?.deposits.details || ""}</span>
              <span className="ml-2 text-slate-400">— System</span>
            </div>
          )}
          {transfersEnabled && !withdrawalsEnabled && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs">
              <span className="font-semibold text-amber-800">Withdrawals: </span>
              <span className="text-amber-700">{flagsQuery.data?.withdrawals.reason || "Withdrawals"} temporarily unavailable. {flagsQuery.data?.withdrawals.details || ""}</span>
              <span className="ml-2 text-slate-400">— System</span>
            </div>
          )}

          {transfersEnabled && <div>
          <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
            {(["internal", "ach", "zelle", "applepay", "chime"] as TransferMethod[]).map((m) => (
              <button key={m} type="button" onClick={() => setMethod(m)} className={`flex-1 min-w-[64px] rounded-md py-1.5 capitalize transition ${method === m ? "bg-white text-red-700 shadow-sm" : "text-slate-600"}`}>
                {labelFor(m)}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="grid gap-3 text-sm sm:grid-cols-2">
            <Field label="From Account">
              <select
                value={fromAcc}
                onChange={(e) => setFromAcc(e.target.value as "checking" | "savings")}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              >
                <option value="checking">FinextHub Checking — ${checking.toLocaleString(undefined, { minimumFractionDigits: 2 })}</option>
                <option value="savings">FinextHub Growth Savings — ${savings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</option>
              </select>
            </Field>

            {method === "internal" && (
              <Field label="To Account">
                <select
                  value={toAcc}
                  onChange={(e) => setToAcc(e.target.value as "checking" | "savings")}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="savings">FinextHub Growth Savings</option>
                  <option value="checking">FinextHub Checking</option>
                </select>
              </Field>
            )}
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
                  You'll confirm with Face ID / Touch ID after submitting.
                </div>
              </Field>
            )}

            <Field label="Amount">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-full rounded-md border border-slate-300 px-3 py-2 pl-7" placeholder="0.00" />
              </div>
            </Field>
            <Field label="Memo (optional)">
              <input value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="What's it for?" />
            </Field>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full rounded-md bg-gradient-to-r from-red-700 to-red-800 py-2.5 text-sm font-semibold text-white hover:from-red-800 hover:to-red-900 disabled:opacity-60"
              >
                Send via {labelFor(method)}
              </button>
              {status && <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{status}</div>}
            </div>
          </form>
          </div>}
        </section>

        {/* Transaction history */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Transaction History</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{filtered.length} of {transactions.length}</span>
              <button onClick={invalidate} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:border-red-300 hover:text-red-700">↺ Refresh</button>
            </div>
          </div>

          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <input
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description…" className="rounded-md border border-slate-300 px-3 py-2 text-sm lg:col-span-2"
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option>All</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={txType} onChange={(e) => setTxType(e.target.value as any)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="all">All amounts</option>
              <option value="credit">Credits only</option>
              <option value="debit">Debits only</option>
            </select>
            <div className="flex gap-1">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-2 text-xs" />
            </div>
          </div>

          {txQuery.isLoading ? (
            <div className="py-8 text-center text-sm text-slate-500 animate-pulse">Loading transactions…</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Description</th>
                      <th className="py-2 pr-3">Category</th>
                      <th className="py-2 pr-3">Account</th>
                      <th className="py-2 pr-3 text-right">Amount</th>
                      <th className="py-2 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-500">No transactions yet. Complete a transfer to see it here.</td></tr>
                    )}
                    {filtered.map((t) => {
                      const f = formatTxDate(t.date);
                      return (
                        <tr key={t.id} className="border-b border-slate-100 last:border-0">
                          <td className="py-3 pr-3 text-slate-600">
                            <div>{f.date}</div>
                            {f.time && <div className="text-[11px] text-slate-400">{f.time}</div>}
                          </td>
                          <td className="py-3 pr-3 font-medium">{t.description}</td>
                          <td className="py-3 pr-3"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t.category}</span></td>
                          <td className="py-3 pr-3 text-xs text-slate-500 capitalize">{t.accountType}</td>
                          <td className={`py-3 pr-3 text-right font-semibold ${t.amount > 0 ? "text-emerald-700" : "text-slate-900"}`}>
                            {t.amount > 0 ? "+" : "-"}${Math.abs(t.amount).toFixed(2)}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => setReceipt({
                                title: t.amount > 0 ? "Incoming Transfer" : "Outgoing Transaction",
                                reference: t.id.slice(0, 8).toUpperCase(),
                                amount: Math.abs(t.amount),
                                method: t.category,
                                from: t.amount > 0 ? t.description : `FinextHub ${t.accountType}`,
                                to: t.amount > 0 ? `FinextHub ${t.accountType}` : t.description,
                                status: t.amount > 0 ? "Received" : "Posted",
                                date: t.date,
                              })}
                              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-red-300 hover:text-red-700"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="block sm:hidden space-y-3">
                {filtered.length === 0 && (
                  <div className="py-6 text-center text-sm text-slate-500">No transactions yet.</div>
                )}
                {filtered.map((t) => {
                  const f = formatTxDate(t.date);
                  return (
                    <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-slate-500">{f.date}{f.time ? ` · ${f.time}` : ""}</div>
                          <div className="mt-1 truncate font-semibold text-slate-900">{t.description}</div>
                          <div className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t.category}</div>
                        </div>
                        <div className={`shrink-0 text-base font-bold ${t.amount > 0 ? "text-emerald-700" : "text-slate-900"}`}>
                          {t.amount > 0 ? "+" : "-"}${Math.abs(t.amount).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
      <AccountDetailsModal accountKey={openAccount} balance={openAccountBalance} onClose={() => setOpenAccount(null)} />
      <SecurityPrompt
        open={!!pendingAuth}
        amount={pendingAuth?.amt ?? 0}
        onCancel={() => setPendingAuth(null)}
        onApprove={() => {
          const amt = pendingAuth!.amt;
          setPendingAuth(null);
          executeTransfer(amt);
        }}
      />
    </BankShell>
  );
}

function labelFor(m: TransferMethod) {
  return { internal: "Internal", ach: "ACH", zelle: "Zelle", applepay: "Apple Pay", chime: "Chime" }[m];
}

function AccountCard({ name, balance, sub, loading, onClick }: { name: string; balance: string; sub?: string; loading?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-red-300 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-slate-500">{name}</div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-red-700">Details →</span>
      </div>
      <div className={`mt-2 text-3xl font-bold ${loading ? "animate-pulse text-slate-300" : ""}`}>{loading ? "Loading…" : balance}</div>
      {sub && <div className="mt-1 text-xs font-medium text-emerald-700">{sub}</div>}
    </button>
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

function formatTxDate(d: string): { date: string; time: string | null } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return { date: new Date(d + "T00:00:00").toLocaleDateString(), time: null };
  }
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return { date: d, time: null };
  return {
    date: dt.toLocaleDateString(),
    time: dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}
