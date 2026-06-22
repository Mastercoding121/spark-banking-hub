import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { BankShell } from "@/components/BankShell";
import { getStockQuotes, submitInvestmentOrder, getPortfolio, type Position } from "@/lib/finance.functions";
import { getAccounts } from "@/lib/account.functions";
import { getFeatureFlags } from "@/lib/feature-flags.functions";

export const Route = createFileRoute("/investments")({
  head: () => ({
    meta: [
      { title: "Investments & Live Stock Trading — FinextHub Bank of USA" },
      { name: "description", content: "Trade stocks at real-time market rates. Choose from CDs, IRAs, ETFs, and managed portfolios." },
    ],
  }),
  component: InvestmentsPage,
});

const SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM"];

const NAMES: Record<string, string> = {
  AAPL: "Apple Inc.", MSFT: "Microsoft Corp.", GOOGL: "Alphabet Inc.",
  AMZN: "Amazon.com Inc.", TSLA: "Tesla Inc.", NVDA: "NVIDIA Corp.",
  META: "Meta Platforms", JPM: "JPMorgan Chase",
};

const PRODUCTS = [
  { id: "cd-12", name: "12-Month CD", rate: "4.85% APY", min: "$1,000", desc: "Fixed-rate, FDIC insured." },
  { id: "cd-24", name: "24-Month CD", rate: "4.50% APY", min: "$1,000", desc: "Lock in a longer term." },
  { id: "ira-trad", name: "Traditional IRA", rate: "Variable", min: "$0", desc: "Tax-deferred retirement growth." },
  { id: "ira-roth", name: "Roth IRA", rate: "Variable", min: "$0", desc: "Tax-free withdrawals in retirement." },
  { id: "etf-sp500", name: "S&P 500 Index ETF", rate: "~10% historical", min: "$100", desc: "Diversified U.S. equity exposure." },
  { id: "managed", name: "Managed Portfolio", rate: "Risk-based", min: "$5,000", desc: "Advisor-built, auto-rebalanced." },
];

function SystemNotice({ feature, reason, details }: { feature: string; reason?: string | null; details?: string | null }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm mt-8">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-3xl">⚙️</div>
      <h2 className="text-xl font-bold text-slate-800">{feature} Temporarily Unavailable</h2>
      {reason && <p className="mt-2 text-sm font-semibold text-amber-700">{reason}</p>}
      <p className="mt-2 text-sm text-slate-500 leading-relaxed">
        {details || `${feature} is temporarily unavailable. Please check back later or contact support for assistance.`}
      </p>
      <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400">— System</div>
    </div>
  );
}

function PnlBadge({ pnl, pnlPct }: { pnl: number; pnlPct: number }) {
  const up = pnl >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
      {up ? "▲" : "▼"} {up ? "+" : ""}{pnl.toFixed(2)} ({up ? "+" : ""}{pnlPct.toFixed(2)}%)
    </span>
  );
}

function PortfolioSection({ positions, quotes }: { positions: Position[]; quotes: Record<string, number> }) {
  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
        No positions yet — buy your first stock above to start building your portfolio.
      </div>
    );
  }

  let totalCurrentValue = 0;
  let totalInvested = 0;

  const enriched = positions.map((p) => {
    const currentPrice = quotes[p.symbol] ?? p.avgCost;
    const currentValue = currentPrice * p.shares;
    const pnl = currentValue - p.totalInvested;
    const pnlPct = p.totalInvested > 0 ? (pnl / p.totalInvested) * 100 : 0;
    totalCurrentValue += currentValue;
    totalInvested += p.totalInvested;
    return { ...p, currentPrice, currentValue, pnl, pnlPct };
  });

  const totalPnl = totalCurrentValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Portfolio summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Portfolio Value</div>
          <div className="mt-1 text-xl font-bold tabular-nums">${totalCurrentValue.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Invested</div>
          <div className="mt-1 text-xl font-bold tabular-nums">${totalInvested.toFixed(2)}</div>
        </div>
        <div className={`rounded-xl border p-4 ${totalPnl >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <div className={`text-xs font-medium uppercase tracking-wide ${totalPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>Total P&amp;L</div>
          <div className={`mt-1 text-xl font-bold tabular-nums ${totalPnl >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </div>
          <div className={`text-xs tabular-nums ${totalPnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {totalPnl >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Positions table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-right">Shares</th>
              <th className="px-4 py-3 text-right">Avg Cost</th>
              <th className="px-4 py-3 text-right">Current</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-right">P&amp;L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {enriched.map((p) => (
              <tr key={p.symbol} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-bold">{p.symbol}</div>
                  <div className="text-[11px] text-slate-500">{NAMES[p.symbol] ?? p.symbol}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{p.shares.toFixed(4)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">${p.avgCost.toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">${p.currentPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">${p.currentValue.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <PnlBadge pnl={p.pnl} pnlPct={p.pnlPct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvestmentsPage() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isLoggedIn) {
      navigate({ to: "/" });
    }
  }, [isLoggedIn, navigate]);

  const flagsFn = useServerFn(getFeatureFlags);
  const fetchQuotes = useServerFn(getStockQuotes);
  const placeOrder = useServerFn(submitInvestmentOrder);
  const fetchAccounts = useServerFn(getAccounts);
  const fetchPortfolio = useServerFn(getPortfolio);

  const flagsQuery = useQuery({ queryKey: ["feature-flags"], queryFn: () => flagsFn({}), staleTime: 30_000 });
  const quotesQuery = useQuery({
    queryKey: ["quotes", SYMBOLS],
    queryFn: () => fetchQuotes({ data: { symbols: SYMBOLS } }),
    refetchInterval: 15_000,
  });
  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: () => fetchAccounts({}) });
  const portfolioQuery = useQuery({ queryKey: ["portfolio"], queryFn: () => fetchPortfolio({}) });

  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [shares, setShares] = useState(1);
  const [side, setSide] = useState<"buy" | "sell">("buy");

  const orderMutation = useMutation({
    mutationFn: (vars: { symbol: string; shares: number; side: "buy" | "sell"; pricePerShare: number }) =>
      placeOrder({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });

  const selectedQuote = quotesQuery.data?.quotes.find((q) => q.symbol === selectedSymbol);
  const invFlag = flagsQuery.data?.investments;
  const checkingBalance = accountsQuery.data?.find((a) => a.type === "checking")?.balance ?? 0;
  const positions = portfolioQuery.data ?? [];
  const estimatedTotal = (selectedQuote?.price ?? 0) * shares;

  const quoteMap: Record<string, number> = {};
  for (const q of quotesQuery.data?.quotes ?? []) quoteMap[q.symbol] = q.price;

  if (flagsQuery.data && !invFlag?.enabled) {
    return (
      <BankShell>
        <main className="mx-auto max-w-7xl px-4 py-6">
          <SystemNotice feature="Investments" reason={invFlag?.reason} details={invFlag?.details} />
        </main>
      </BankShell>
    );
  }

  return (
    <BankShell>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold">Investments</h1>
            <p className="text-sm text-slate-600">Live market data refreshes every 15 seconds.</p>
          </div>
          <div className="text-right text-xs text-slate-500" suppressHydrationWarning>
            {quotesQuery.isFetching ? "Refreshing…" : quotesQuery.data ? `Updated ${new Date(quotesQuery.data.updatedAt).toLocaleTimeString()}` : "Loading…"}
          </div>
        </div>

        {/* Live ticker */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Real-Time Stock Rates</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(quotesQuery.data?.quotes ?? SYMBOLS.map((s) => ({ symbol: s, name: NAMES[s] ?? s, price: 0, change: 0, changePct: 0, currency: "USD" }))).map((q) => {
              const up = q.change >= 0;
              const active = selectedSymbol === q.symbol;
              return (
                <button
                  key={q.symbol}
                  onClick={() => setSelectedSymbol(q.symbol)}
                  className={`rounded-lg border p-3 text-left transition ${active ? "border-red-600 bg-red-50" : "border-slate-200 bg-white hover:border-slate-400"}`}
                >
                  <div className="flex items-baseline justify-between">
                    <div className="text-sm font-bold">{q.symbol}</div>
                    <div className={`text-[11px] font-semibold ${up ? "text-emerald-600" : "text-red-600"}`}>
                      {up ? "▲" : "▼"} {q.changePct.toFixed(2)}%
                    </div>
                  </div>
                  <div className="truncate text-[10px] text-slate-500">{q.name}</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">{q.price ? `$${q.price.toFixed(2)}` : "—"}</div>
                  <div className={`text-[10px] tabular-nums ${up ? "text-emerald-600" : "text-red-600"}`}>
                    {up ? "+" : ""}{q.change.toFixed(2)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Trade ticket */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-1">
            <h2 className="mb-1 text-lg font-semibold">Place Trade</h2>

            {/* Available balance */}
            <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="text-slate-500">Available (Checking)</span>
              <span className="font-bold tabular-nums text-slate-800">
                {accountsQuery.isLoading ? "…" : `$${checkingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              </span>
            </div>

            <div className="mb-4 rounded-lg bg-slate-900 p-4 text-white">
              <div className="text-xs opacity-70">{selectedQuote?.name ?? NAMES[selectedSymbol] ?? selectedSymbol}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {selectedQuote ? `$${selectedQuote.price.toFixed(2)}` : "—"}
              </div>
              {selectedQuote && (
                <div className={`text-xs ${selectedQuote.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {selectedQuote.change >= 0 ? "+" : ""}{selectedQuote.change.toFixed(2)} ({selectedQuote.changePct.toFixed(2)}%)
                </div>
              )}
            </div>

            <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
              <button onClick={() => setSide("buy")} className={`rounded-md py-1.5 transition ${side === "buy" ? "bg-emerald-600 text-white" : "text-slate-600"}`}>Buy</button>
              <button onClick={() => setSide("sell")} className={`rounded-md py-1.5 transition ${side === "sell" ? "bg-red-600 text-white" : "text-slate-600"}`}>Sell</button>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Symbol</span>
              <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
                {SYMBOLS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>

            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Shares</span>
              <input
                type="number"
                min={0.0001}
                step={0.0001}
                value={shares}
                onChange={(e) => setShares(Math.max(0.0001, Number(e.target.value)))}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">Est. total</span>
                <span className="font-semibold tabular-nums">${estimatedTotal.toFixed(2)}</span>
              </div>
              {side === "buy" && (
                <div className="flex justify-between">
                  <span className="text-slate-600">After purchase</span>
                  <span className={`font-semibold tabular-nums ${checkingBalance - estimatedTotal < 0 ? "text-red-600" : "text-slate-800"}`}>
                    ${(checkingBalance - estimatedTotal).toFixed(2)}
                  </span>
                </div>
              )}
              {side === "sell" && positions.find((p) => p.symbol === selectedSymbol) && (
                <div className="flex justify-between">
                  <span className="text-slate-600">You hold</span>
                  <span className="font-semibold tabular-nums">
                    {positions.find((p) => p.symbol === selectedSymbol)!.shares.toFixed(4)} shares
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => orderMutation.mutate({ symbol: selectedSymbol, shares, side, pricePerShare: selectedQuote?.price ?? 0 })}
              disabled={orderMutation.isPending || !selectedQuote || (side === "buy" && estimatedTotal > checkingBalance)}
              className={`mt-4 w-full rounded-md py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition ${side === "buy" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
            >
              {orderMutation.isPending ? "Placing…" : `${side === "buy" ? "Buy" : "Sell"} ${shares} ${selectedSymbol}`}
            </button>

            {side === "buy" && estimatedTotal > checkingBalance && selectedQuote && (
              <p className="mt-2 text-center text-[11px] text-red-600">Insufficient checking balance</p>
            )}

            {orderMutation.data?.ok && (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                ✓ {orderMutation.data.message}
                <div className="mt-0.5 text-emerald-600">Ref: {orderMutation.data.orderId}</div>
              </div>
            )}
            {orderMutation.isError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {(orderMutation.error as Error).message}
              </div>
            )}
          </section>

          {/* Right column: Portfolio + Products */}
          <div className="space-y-6 lg:col-span-2">
            {/* Portfolio */}
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">My Portfolio</h2>
                {portfolioQuery.isLoading && <span className="text-xs text-slate-400">Loading…</span>}
                {!portfolioQuery.isLoading && positions.length > 0 && (
                  <span className="text-xs text-slate-500">{positions.length} position{positions.length !== 1 ? "s" : ""}</span>
                )}
              </div>
              <PortfolioSection positions={positions} quotes={quoteMap} />
            </section>

            {/* Investment products */}
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Investment Products</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {PRODUCTS.map((p) => (
                  <div key={p.id} className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-400">
                    <div className="flex items-baseline justify-between">
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="text-xs font-semibold text-amber-700">{p.rate}</div>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{p.desc}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">Min: {p.min}</span>
                      <button className="rounded-md bg-slate-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-800">Open</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </BankShell>
  );
}
