import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BankShell } from "@/components/BankShell";
import { getStockQuotes, submitInvestmentOrder } from "@/lib/finance.functions";

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

const PRODUCTS = [
  { id: "cd-12", name: "12-Month CD", rate: "4.85% APY", min: "$1,000", desc: "Fixed-rate, FDIC insured." },
  { id: "cd-24", name: "24-Month CD", rate: "4.50% APY", min: "$1,000", desc: "Lock in a longer term." },
  { id: "ira-trad", name: "Traditional IRA", rate: "Variable", min: "$0", desc: "Tax-deferred retirement growth." },
  { id: "ira-roth", name: "Roth IRA", rate: "Variable", min: "$0", desc: "Tax-free withdrawals in retirement." },
  { id: "etf-sp500", name: "S&P 500 Index ETF", rate: "~10% historical", min: "$100", desc: "Diversified U.S. equity exposure." },
  { id: "managed", name: "Managed Portfolio", rate: "Risk-based", min: "$5,000", desc: "Advisor-built, auto-rebalanced." },
];

function InvestmentsPage() {
  const fetchQuotes = useServerFn(getStockQuotes);
  const placeOrder = useServerFn(submitInvestmentOrder);

  const quotesQuery = useQuery({
    queryKey: ["quotes", SYMBOLS],
    queryFn: () => fetchQuotes({ data: { symbols: SYMBOLS } }),
    refetchInterval: 15_000,
  });

  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [shares, setShares] = useState(1);
  const [side, setSide] = useState<"buy" | "sell">("buy");

  const orderMutation = useMutation({
    mutationFn: (vars: { symbol: string; shares: number; side: "buy" | "sell" }) => placeOrder({ data: vars }),
  });

  const selectedQuote = quotesQuery.data?.quotes.find((q) => q.symbol === selectedSymbol);

  return (
    <BankShell>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold">Investments</h1>
            <p className="text-sm text-slate-600">Live market data refreshes every 15 seconds.</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            {quotesQuery.isFetching ? "Refreshing…" : quotesQuery.data ? `Updated ${new Date(quotesQuery.data.updatedAt).toLocaleTimeString()}` : "Loading…"}
          </div>
        </div>

        {/* Live ticker */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Real-Time Stock Rates</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(quotesQuery.data?.quotes ?? SYMBOLS.map((s) => ({ symbol: s, name: s, price: 0, change: 0, changePct: 0, currency: "USD" }))).map((q) => {
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
            <h2 className="mb-4 text-lg font-semibold">Place Trade</h2>

            <div className="mb-4 rounded-lg bg-slate-900 p-4 text-white">
              <div className="text-xs opacity-70">{selectedQuote?.name ?? selectedSymbol}</div>
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
              <button onClick={() => setSide("buy")} className={`rounded-md py-1.5 ${side === "buy" ? "bg-emerald-600 text-white" : "text-slate-600"}`}>Buy</button>
              <button onClick={() => setSide("sell")} className={`rounded-md py-1.5 ${side === "sell" ? "bg-red-600 text-white" : "text-slate-600"}`}>Sell</button>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Symbol</span>
              <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
                {SYMBOLS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>

            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Shares</span>
              <input type="number" min={1} value={shares} onChange={(e) => setShares(Math.max(1, Number(e.target.value)))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
            </label>

            <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs">
              <div className="flex justify-between"><span className="text-slate-600">Est. total</span><span className="font-semibold">${((selectedQuote?.price ?? 0) * shares).toFixed(2)}</span></div>
            </div>

            <button
              onClick={() => orderMutation.mutate({ symbol: selectedSymbol, shares, side })}
              disabled={orderMutation.isPending || !selectedQuote}
              className={`mt-4 w-full rounded-md py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${side === "buy" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
            >
              {orderMutation.isPending ? "Placing…" : `${side === "buy" ? "Buy" : "Sell"} ${shares} ${selectedSymbol}`}
            </button>

            {orderMutation.data?.ok && (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                ✓ {orderMutation.data.message} · Order {orderMutation.data.orderId}
              </div>
            )}
            {orderMutation.isError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {(orderMutation.error as Error).message}
              </div>
            )}
          </section>

          {/* Investment products */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
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
      </main>
    </BankShell>
  );
}
