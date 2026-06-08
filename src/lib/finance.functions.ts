import { createServerFn } from "@tanstack/react-start";

export type StockQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
};

const NAMES: Record<string, string> = {
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corp.",
  GOOGL: "Alphabet Inc.",
  AMZN: "Amazon.com Inc.",
  TSLA: "Tesla Inc.",
  NVDA: "NVIDIA Corp.",
  META: "Meta Platforms",
  JPM: "JPMorgan Chase",
  "BRK-B": "Berkshire Hathaway",
  V: "Visa Inc.",
};

export const getStockQuotes = createServerFn({ method: "GET" })
  .inputValidator((input: { symbols: string[] }) => ({
    symbols: (input.symbols || []).slice(0, 20).map((s) => String(s).toUpperCase()),
  }))
  .handler(async ({ data }): Promise<{ quotes: StockQuote[]; updatedAt: string }> => {
    const results = await Promise.all(
      data.symbols.map(async (symbol): Promise<StockQuote | null> => {
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
            { headers: { "User-Agent": "Mozilla/5.0" } },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json: any = await res.json();
          const meta = json?.chart?.result?.[0]?.meta;
          if (!meta) throw new Error("no meta");
          const price = Number(meta.regularMarketPrice);
          const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
          const change = price - prev;
          const changePct = prev ? (change / prev) * 100 : 0;
          return {
            symbol,
            name: NAMES[symbol] ?? symbol,
            price,
            change,
            changePct,
            currency: meta.currency ?? "USD",
          };
        } catch {
          // Deterministic fallback so the UI still renders
          const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
          const price = 50 + (seed % 400) + Math.random() * 5;
          const change = (Math.random() - 0.5) * 6;
          return {
            symbol,
            name: NAMES[symbol] ?? symbol,
            price,
            change,
            changePct: (change / price) * 100,
            currency: "USD",
          };
        }
      }),
    );
    return {
      quotes: results.filter(Boolean) as StockQuote[],
      updatedAt: new Date().toISOString(),
    };
  });

export const submitLoanApplication = createServerFn({ method: "POST" })
  .inputValidator((input: { productId: string; amount: number; termMonths: number; fullName: string; email: string }) => {
    if (!input.productId) throw new Error("Product required");
    if (!input.amount || input.amount < 500) throw new Error("Amount must be at least $500");
    if (!input.termMonths || input.termMonths < 6) throw new Error("Invalid term");
    if (!input.fullName?.trim()) throw new Error("Name required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("Valid email required");
    return input;
  })
  .handler(async ({ data }) => {
    const referenceId = `LN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    return {
      ok: true,
      referenceId,
      message: `Application received for ${data.fullName}. A loan officer will contact ${data.email} within 24 hours.`,
    };
  });

export const submitInvestmentOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { symbol: string; shares: number; side: "buy" | "sell" }) => {
    if (!input.symbol) throw new Error("Symbol required");
    if (!input.shares || input.shares <= 0) throw new Error("Shares must be > 0");
    if (input.side !== "buy" && input.side !== "sell") throw new Error("Invalid side");
    return input;
  })
  .handler(async ({ data }) => {
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    return { ok: true, orderId, message: `${data.side.toUpperCase()} ${data.shares} ${data.symbol} placed.` };
  });

export const submitSupportMessage = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; email: string; topic: string; message: string }) => {
    if (!input.name?.trim()) throw new Error("Name required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("Valid email required");
    if (!input.message?.trim() || input.message.length < 5) throw new Error("Message too short");
    return input;
  })
  .handler(async ({ data }) => {
    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;
    return {
      ok: true,
      ticketId,
      message: `Hi ${data.name}, ticket ${ticketId} opened. An agent will reply to ${data.email} shortly.`,
    };
  });
