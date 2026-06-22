import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/lib/auth";
import { BankShell } from "@/components/BankShell";
import { getAccounts } from "@/lib/account.functions";
import { getPortfolio, getStockQuotes, type Position } from "@/lib/finance.functions";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "Wallet — FinextHub Bank of USA" }] }),
  component: WalletPage,
});

const NAMES: Record<string, string> = {
  AAPL: "Apple Inc.", MSFT: "Microsoft Corp.", GOOGL: "Alphabet Inc.",
  AMZN: "Amazon.com Inc.", TSLA: "Tesla Inc.", NVDA: "NVIDIA Corp.",
  META: "Meta Platforms", JPM: "JPMorgan Chase",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BalanceCard({
  label, sub, balance, accent, icon, loading,
}: {
  label: string; sub: string; balance: number; accent: string; icon: React.ReactNode; loading?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-6 text-white ${accent} shadow-md`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest opacity-80">{label}</div>
          <div className="text-[11px] opacity-60 mt-0.5">{sub}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">{icon}</div>
      </div>
      <div className="flex items-center gap-2">
        {loading ? (
          <>
            <LoadingSpinner size="md" className="text-white" />
            <span className="text-xl font-bold tabular-nums text-white/60">Loading…</span>
          </>
        ) : (
          <div className="text-3xl font-bold tabular-nums">${fmt(balance)}</div>
        )}
      </div>
    </div>
  );
}

function PnlChip({ value, pct }: { value: number; pct: number }) {
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${up ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
      {up ? "▲" : "▼"} {up ? "+" : ""}${Math.abs(value).toFixed(2)} ({up ? "+" : ""}{pct.toFixed(2)}%)
    </span>
  );
}

function AllocationBar({ positions, quotes }: { positions: Position[]; quotes: Record<string, number> }) {
  const colors = ["bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500", "bg-red-500", "bg-cyan-500", "bg-pink-500", "bg-orange-500"];
  const enriched = positions.map((p, i) => ({
    ...p,
    currentValue: (quotes[p.symbol] ?? p.avgCost) * p.shares,
    color: colors[i % colors.length],
  }));
  const total = enriched.reduce((s, p) => s + p.currentValue, 0);
  if (total <= 0) return null;
  return (
    <div className="mt-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        {enriched.map((p) => (
          <div key={p.symbol} className={`${p.color} transition-all`} style={{ width: `${(p.currentValue / total) * 100}%` }} title={`${p.symbol}: ${((p.currentValue / total) * 100).toFixed(1)}%`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {enriched.map((p) => (
          <div key={p.symbol} className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <div className={`h-2 w-2 rounded-full ${p.color}`} />
            <span>{p.symbol} {((p.currentValue / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletPage() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const fetchAccounts = useServerFn(getAccounts);
  const fetchPortfolio = useServerFn(getPortfolio);
  const fetchQuotes = useServerFn(getStockQuotes);
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate({ to: "/" });
    } else {
      const timer = setTimeout(() => {
        setIsPageLoading(false);
      }, 2500); // 2.5 seconds
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, navigate]);

  const accountsQuery = useQuery({ queryKey: ["accounts"], queryFn: () => fetchAccounts({}) });
  const portfolioQuery = useQuery({ queryKey: ["portfolio"], queryFn: () => fetchPortfolio({}) });

  const positions = portfolioQuery.data ?? [];
  const symbols = positions.map((p) => p.symbol);

  const quotesQuery = useQuery({
    queryKey: ["quotes", symbols],
    queryFn: () => fetchQuotes({ data: { symbols } }),
    enabled: symbols.length > 0,
    refetchInterval: 30_000,
  });

  const checking = accountsQuery.data?.find((a) => a.type === "checking")?.balance ?? 0;
  const savings = accountsQuery.data?.find((a) => a.type === "savings")?.balance ?? 0;

  const quoteMap: Record<string, number> = {};
  for (const q of quotesQuery.data?.quotes ?? []) quoteMap[q.symbol] = q.price;

  const enrichedPositions = positions.map((p) => {
    const currentPrice = quoteMap[p.symbol] ?? p.avgCost;
    const currentValue = currentPrice * p.shares;
    const pnl = currentValue - p.totalInvested;
    const pnlPct = p.totalInvested > 0 ? (pnl / p.totalInvested) * 100 : 0;
    return { ...p, currentPrice, currentValue, pnl, pnlPct };
  });

  const portfolioValue = enrichedPositions.reduce((s, p) => s + p.currentValue, 0);
  const totalInvested = enrichedPositions.reduce((s, p) => s + p.totalInvested, 0);
  const portfolioPnl = portfolioValue - totalInvested;
  const portfolioPnlPct = totalInvested > 0 ? (portfolioPnl / totalInvested) * 100 : 0;
  const netWorth = checking + savings + portfolioValue;

  const isContentLoading = accountsQuery.isLoading || portfolioQuery.isLoading;

  if (isPageLoading) {
    return (
      <BankShell>
        <main className="mx-auto max-w-4xl px-4 py-20 text-center">
          <LoadingSpinner size="lg" />
          <h2 className="mt-4 text-2xl font-bold">Preparing your wallet…</h2>
          <p className="mt-2 text-slate-500">Please wait while we load your account data.</p>
        </main>
      </BankShell>
    );
  }

  return (
    <BankShell>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Wallet</h1>
          <p className="mt-1 text-sm text-slate-500">A complete view of your balances, investments, and net worth.</p>
        </div>

        {/* Net Worth Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-red-950 to-slate-900 p-8 text-white shadow-xl">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 70% 50%, #dc2626 0%, transparent 60%)" }} />
          <div className="relative">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/60">Total Net Worth</div>
            <div className="mt-2 flex items-center gap-2">
              {isContentLoading ? (
                <>
                  <LoadingSpinner size="lg" className="text-white" />
                  <span className="text-3xl font-bold tabular-nums text-white/60">Calculating…</span>
                </>
              ) : (
                <span className="text-5xl font-bold tabular-nums">${fmt(netWorth)}</span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/70">
              <div><span className="text-white/50">Checking</span> <span className="font-semibold text-white">${fmt(checking)}</span></div>
              <div className="opacity-40">·</div>
              <div><span className="text-white/50">Savings</span> <span className="font-semibold text-white">${fmt(savings)}</span></div>
              <div className="opacity-40">·</div>
              <div><span className="text-white/50">Portfolio</span> <span className="font-semibold text-white">${fmt(portfolioValue)}</span></div>
            </div>
          </div>
        </div>

        {/* Account cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <BalanceCard
            label="Checking"
            sub="FinextHub Checking"
            balance={checking}
            loading={accountsQuery.isLoading}
            accent="bg-gradient-to-br from-slate-800 to-slate-700"
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            }
          />
          <BalanceCard
            label="Savings"
            sub="4.25% APY · FDIC Insured"
            balance={savings}
            loading={accountsQuery.isLoading}
            accent="bg-gradient-to-br from-blue-700 to-blue-600"
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
                <path d="M12 6v6l4 2" />
              </svg>
            }
          />
          <BalanceCard
            label="Investments"
            sub={positions.length > 0 ? `${positions.length} position${positions.length !== 1 ? "s" : ""}` : "No positions yet"}
            balance={portfolioValue}
            loading={portfolioQuery.isLoading}
            accent={`bg-gradient-to-br ${portfolioPnl >= 0 ? "from-emerald-700 to-emerald-600" : "from-red-700 to-red-600"}`}
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            }
          />
        </div>

        {/* Investment Portfolio Detail */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="font-semibold text-slate-900">Investment Portfolio</h2>
              {positions.length > 0 && !portfolioQuery.isLoading && (
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Total invested ${fmt(totalInvested)}</span>
                  <PnlChip value={portfolioPnl} pct={portfolioPnlPct} />
                </div>
              )}
            </div>
            <Link to="/investments" className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 transition-colors">
              Trade →
            </Link>
          </div>

          {portfolioQuery.isLoading ? (
            <div className="px-6 py-10 text-center text-sm text-slate-400 animate-pulse">Loading portfolio…</div>
          ) : positions.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl">📈</div>
              <p className="text-sm font-medium text-slate-700">No investments yet</p>
              <p className="mt-1 text-xs text-slate-500">Visit the Investments page to buy stocks with your checking balance.</p>
              <Link to="/investments" className="mt-4 inline-block rounded-lg bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800 transition-colors">
                Start Investing
              </Link>
            </div>
          ) : (
            <div className="px-6 py-4 space-y-4">
              {/* Allocation bar */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Portfolio Allocation</div>
                <AllocationBar positions={positions} quotes={quoteMap} />
              </div>

              {/* Positions table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="pb-2 text-left">Asset</th>
                      <th className="pb-2 text-right">Shares</th>
                      <th className="pb-2 text-right">Avg Cost</th>
                      <th className="pb-2 text-right">Price</th>
                      <th className="pb-2 text-right">Value</th>
                      <th className="pb-2 text-right">P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {enrichedPositions.map((p) => (
                      <tr key={p.symbol} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3">
                          <div className="font-bold text-slate-900">{p.symbol}</div>
                          <div className="text-[11px] text-slate-500">{NAMES[p.symbol] ?? p.symbol}</div>
                        </td>
                        <td className="py-3 text-right tabular-nums text-slate-700">{p.shares.toFixed(4)}</td>
                        <td className="py-3 text-right tabular-nums text-slate-500">${p.avgCost.toFixed(2)}</td>
                        <td className="py-3 text-right tabular-nums font-medium">
                          {quoteMap[p.symbol] ? `$${p.currentPrice.toFixed(2)}` : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-3 text-right tabular-nums font-semibold">${p.currentValue.toFixed(2)}</td>
                        <td className="py-3 text-right">
                          <PnlChip value={p.pnl} pct={p.pnlPct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-semibold">
                      <td className="pt-3 text-sm">Total</td>
                      <td colSpan={3} />
                      <td className="pt-3 text-right tabular-nums">${fmt(portfolioValue)}</td>
                      <td className="pt-3 text-right">
                        <PnlChip value={portfolioPnl} pct={portfolioPnlPct} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Transfer Funds", icon: "⇄", to: "/dashboard" },
            { label: "Invest Now", icon: "📈", to: "/investments" },
            { label: "Apply for Loan", icon: "🏦", to: "/loans" },
            { label: "View Profile", icon: "👤", to: "/profile" },
          ].map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            >
              <span className="text-2xl">{a.icon}</span>
              {a.label}
            </Link>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="text-center text-[11px] text-slate-400 pb-4">
          Investment values fluctuate with market conditions. Portfolio P&amp;L reflects unrealized gains/losses based on live quotes. Past performance is not indicative of future results.
        </p>
      </main>
    </BankShell>
  );
}
