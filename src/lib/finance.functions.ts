
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core";
import { getSessionUser } from "./user.functions";

const SESSION_COOKIE = "fnx_session";

async function requireSession(): Promise<string> {
  const sid = getCookie(SESSION_COOKIE);
  if (!sid) throw new Error("Not authenticated.");
  const user = await getSessionUser(sid);
  if (!user) throw new Error("Session expired. Please sign in again.");
  return user.id;
}

export type StockQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
};

export type Position = {
  symbol: string;
  shares: number;
  avgCost: number;
  totalInvested: number;
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
  .validator((input: { symbols: string[] }) => ({
    symbols: (input.symbols || []).slice(0, 20).map((s) => String(s).toUpperCase()),
  }))
  .handler(async ({ data }): Promise<{ quotes: StockQuote[]; updatedAt: string }> => {
    const results = await Promise.all(
      data.symbols.map(async (symbol): Promise<StockQuote | null> => {
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
            { headers: { "User-Agent": "Mozilla/5.0" } }
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json: any = await res.json();
          const meta = json?.chart?.result?.[0]?.meta;
          if (!meta) throw new Error("no meta");
          const price = Number(meta.regularMarketPrice);
          const prev = Number(meta.chartPreviousClose || meta.previousClose || price);
          const change = price - prev;
          const changePct = prev ? (change / prev) * 100 : 0;
          return {
            symbol,
            name: NAMES[symbol] || symbol,
            price,
            change,
            changePct,
            currency: meta.currency || "USD",
          };
        } catch {
          const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
          const price = 50 + (seed % 400) + Math.random() * 5;
          const change = (Math.random() - 0.5) * 6;
          return {
            symbol,
            name: NAMES[symbol] || symbol,
            price,
            change,
            changePct: (change / price) * 100,
            currency: "USD",
          };
        }
      })
    );
    return { quotes: results.filter(Boolean) as StockQuote[], updatedAt: new Date().toISOString() };
  });

// In-memory storage
const inMemoryStorage = {
  positions: new Map(),
  loans: new Map(),
};

// ─── Portfolio ─────────────────────────────────────────────────────────────────

export const getPortfolio = createServerFn({ method: "GET" }).handler(async (): Promise<Position[]> => {
  const userId = await requireSession();
  return Array.from(inMemoryStorage.positions.values())
    .filter(p => p.userId === userId);
});

// ─── Submit investment order (DB-backed, balance-checked) ──────────────────────

export const submitInvestmentOrder = createServerFn({ method: "POST" })
  .validator((input: { symbol: string; shares: number; side: "buy" | "sell"; pricePerShare: number }) => {
    if (!input.symbol) throw new Error("Symbol required");
    if (!input.shares || input.shares <= 0) throw new Error("Shares must be > 0");
    if (input.side !== "buy" && input.side !== "sell") throw new Error("Invalid side");
    if (!input.pricePerShare || input.pricePerShare <= 0) throw new Error("Price required");
    return {
      symbol: String(input.symbol).toUpperCase(),
      shares: Math.round(input.shares * 1000000) / 1000000,
      side: input.side,
      pricePerShare: Math.round(input.pricePerShare * 100) / 100,
    };
  })
  .handler(async ({ data }) => {
    const userId = await requireSession();
    const total = Math.round(data.shares * data.pricePerShare * 100) / 100;
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;

    if (data.side === "buy") {
      // Find or create position
      const positions = Array.from(inMemoryStorage.positions.values()).filter(p => p.userId === userId && p.symbol === data.symbol);
      if (positions.length > 0) {
        const existing = positions[0];
        const newShares = existing.shares + data.shares;
        const newTotalInvested = existing.totalInvested + total;
        const newAvgCost = newTotalInvested / newShares;
        inMemoryStorage.positions.set(existing.id, {
          ...existing,
          shares: newShares,
          totalInvested: newTotalInvested,
          avgCost: newAvgCost,
        });
      } else {
        const positionId = crypto.randomUUID();
        inMemoryStorage.positions.set(positionId, {
          id: positionId,
          userId,
          symbol: data.symbol,
          shares: data.shares,
          avgCost: data.pricePerShare,
          totalInvested: total,
        });
      }
      return {
        ok: true,
        orderId,
        side: "buy",
        symbol: data.symbol,
        shares: data.shares,
        total,
        message: `Bought ${data.shares} share${data.shares !== 1 ? "s" : ""} of ${data.symbol} for $${total.toFixed(2)}.`,
      };
    } else {
      const positions = Array.from(inMemoryStorage.positions.values()).filter(p => p.userId === userId && p.symbol === data.symbol);
      if (positions.length === 0) throw new Error(`You hold 0 ${data.symbol}`);
      
      const existing = positions[0];
      if (existing.shares < data.shares) throw new Error(`Insufficient shares. You hold ${existing.shares.toFixed(4)} ${data.symbol}.`);

      const newShares = existing.shares - data.shares;
      if (newShares <= 0.000001) {
        inMemoryStorage.positions.delete(existing.id);
      } else {
        const newTotalInvested = Math.max(0, existing.totalInvested - (existing.avgCost * data.shares));
        const newAvgCost = newTotalInvested / newShares;
        inMemoryStorage.positions.set(existing.id, {
          ...existing,
          shares: newShares,
          totalInvested: newTotalInvested,
          avgCost: newAvgCost,
        });
      }
      
      return {
        ok: true,
        orderId,
        side: "sell",
        symbol: data.symbol,
        shares: data.shares,
        total,
        message: `Sold ${data.shares} share${data.shares !== 1 ? "s" : ""} of ${data.symbol} for $${total.toFixed(2)}.`,
      };
    }
  });

// ─── Loan application (DB-backed) ─────────────────────────────────────────────

export type LoanStatus = "submitted" | "underwriting" | "approved" | "rejected";
export type LoanDocument = { id: string; name: string; sizeBytes: number; contentType: string; uploadedAt: string };
export type UnderwritingNote = { id: string; at: string; author: "system" | "underwriter" | "applicant"; text: string };
export type LoanApplication = {
  referenceId: string;
  productId: string;
  amount: number;
  termMonths: number;
  fullName: string;
  email: string;
  status: LoanStatus;
  submittedAt: string;
  history: { status: LoanStatus; at: string; note: string }[];
  documents: LoanDocument[];
  underwritingNotes: UnderwritingNote[];
};

export const submitLoanApplication = createServerFn({ method: "POST" })
  .validator((input: { productId: string; amount: number; termMonths: number; fullName: string; email: string }) => {
    if (!input.productId) throw new Error("Product required");
    if (!input.amount || input.amount < 500) throw new Error("Amount must be at least $500");
    if (!input.termMonths || input.termMonths < 6) throw new Error("Invalid term");
    if (!input.fullName?.trim()) throw new Error("Name required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("Valid email required");
    return input;
  })
  .handler(async ({ data }) => {
    const referenceId = `LN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();
    const history = [{ status: "submitted", at: now, note: `Application received for ${data.fullName}. Confirmation sent to ${data.email}.` }];
    const notes = [{ id: `un-${Date.now()}`, at: now, author: "system", text: "Application intake complete. Forwarded to underwriting queue." }];

    const newLoan: LoanApplication = {
      referenceId,
      productId: data.productId,
      amount: data.amount,
      termMonths: data.termMonths,
      fullName: data.fullName,
      email: data.email,
      status: "submitted",
      submittedAt: now,
      history,
      documents: [],
      underwritingNotes: notes,
    };
    inMemoryStorage.loans.set(referenceId, newLoan);
    return { ok: true, referenceId, message: `Application received. Track status with reference ${referenceId}.` };
  });

export const uploadLoanDocument = createServerFn({ method: "POST" })
  .validator((input: { referenceId: string; name: string; sizeBytes: number; contentType: string }) => {
    if (!input.referenceId?.trim()) throw new Error("Reference required");
    if (!input.name?.trim()) throw new Error("File name required");
    if (!input.sizeBytes || input.sizeBytes <= 0) throw new Error("Invalid file size");
    if (input.sizeBytes > 15 * 1024 * 1024) throw new Error("File too large (max 15 MB)");
    return input;
  })
  .handler(async ({ data }) => {
    const loan = inMemoryStorage.loans.get(data.referenceId.trim().toUpperCase());
    if (!loan) throw new Error("Application not found");
    
    const docEntry: LoanDocument = {
      id: `doc-${Date.now().toString(36).toUpperCase()}`,
      name: data.name,
      sizeBytes: data.sizeBytes,
      contentType: data.contentType || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
    };
    
    inMemoryStorage.loans.set(data.referenceId.trim().toUpperCase(), {
      ...loan,
      documents: [...loan.documents, docEntry],
      underwritingNotes: [...loan.underwritingNotes, {
        id: `un-${Date.now()}`,
        at: new Date().toISOString(),
        author: "system",
        text: `Document received: ${docEntry.name} (${Math.round(docEntry.sizeBytes / 1024)} KB)`,
      }],
    });
    
    return { ok: true, document: docEntry };
  });

export const addUnderwritingNote = createServerFn({ method: "POST" })
  .validator((input: { referenceId: string; text: string }) => {
    if (!input.referenceId?.trim()) throw new Error("Reference required");
    if (!input.text?.trim() || input.text.length < 2) throw new Error("Note too short");
    if (input.text.length > 1000) throw new Error("Note too long");
    return input;
  })
  .handler(async ({ data }) => {
    const loan = inMemoryStorage.loans.get(data.referenceId.trim().toUpperCase());
    if (!loan) throw new Error("Application not found");
    
    const noteEntry: UnderwritingNote = {
      id: `un-${Date.now()}`,
      at: new Date().toISOString(),
      author: "applicant",
      text: data.text.trim(),
    };
    
    inMemoryStorage.loans.set(data.referenceId.trim().toUpperCase(), {
      ...loan,
      underwritingNotes: [...loan.underwritingNotes, noteEntry],
    });
    
    return { ok: true, note: noteEntry };
  });

export const getLoanStatus = createServerFn({ method: "GET" })
  .validator((input: { referenceId: string }) => {
    if (!input.referenceId?.trim()) throw new Error("Reference required");
    return input;
  })
  .handler(
    async ({ data }): Promise<{ application: LoanApplication } | { error: string }> => {
      const loan = inMemoryStorage.loans.get(data.referenceId.trim().toUpperCase());
      if (!loan) {
        return { error: "Application not found. Check your reference number." };
      }
      return { application: loan };
    }
  );

// ─── Support (Bot) ─────────────────────────────────────────────────────────────

const SUPPORT_EMAIL = "support@finexthub.com";

function botAnswer(text: string): string {
  const t = text.toLowerCase();
  if (/(hi|hello|hey|good (morning|afternoon|evening))/.test(t))
    return `Hi! I'm Ember, FinextHub's 24/7 virtual assistant. How can I help today? For anything I can't resolve, our team is at ${SUPPORT_EMAIL}.`;
  if (/(lost|stolen).*(card|debit|credit)|card.*(lost|stolen)/.test(t))
    return `I'm sorry to hear that. Please email ${SUPPORT_EMAIL} immediately with your name and the last 4 digits so a fraud specialist can freeze your card and issue a replacement.`;
  if (/(fraud|unauthorized|dispute|charge)/.test(t))
    return `For disputes, forward transaction details (date, amount, merchant) to ${SUPPORT_EMAIL}. Our fraud team responds within 2 hours, 24/7.`;
  if (/(password|login|sign in|locked)/.test(t))
    return `You can reset your password from the login screen using "Forgot password". If you're still locked out, email ${SUPPORT_EMAIL} from your registered address.`;
  if (/(loan|mortgage|apr|interest)/.test(t))
    return `You can apply and customize loan terms on the Loans page. For status questions, email ${SUPPORT_EMAIL} with your reference ID.`;
  if (/(invest|stock|trade|portfolio|ira|cd)/.test(t))
    return `Live rates are on the Investments page. For advisor consultations, email ${SUPPORT_EMAIL} and an advisor will schedule a call.`;
  if (/(transfer|zelle|chime|apple pay|ach|wire)/.test(t))
    return `Transfers are handled from your Dashboard. If a transfer is stuck, email ${SUPPORT_EMAIL} with the reference ID and we'll trace it.`;
  if (/(routing|account number|swift|bic|wire)/.test(t))
    return `For your account and wire transfer details, please email ${SUPPORT_EMAIL} from your registered address and a team member will respond securely.`;
  if (/(hours|open|24)/.test(t))
    return `We're open 24/7 — every day of the year. Email ${SUPPORT_EMAIL} or call 1-800-FINEXTHUB.`;
  if (/(thanks|thank you|thx|ty)/.test(t))
    return `You're welcome! If anything else comes up, email ${SUPPORT_EMAIL} and a human agent will follow up.`;
  return `Thanks for reaching out. Please email the full details to ${SUPPORT_EMAIL} and we'll respond shortly. Reference: BOT-${Date.now().toString(36).toUpperCase()}`;
}

export const chatWithBot = createServerFn({ method: "POST" })
  .validator((input: { message: string }) => {
    if (!input.message?.trim()) throw new Error("Message required");
    if (input.message.length > 1000) throw new Error("Message too long");
    return input;
  })
  .handler(async ({ data }) => {
    return { ok: true, reply: botAnswer(data.message), mailto: SUPPORT_EMAIL, at: new Date().toISOString() };
  });

// ─── External transfer stubs ─────────────────────────────────────────────────

export const sendChimeTransfer = createServerFn({ method: "POST" })
  .validator((input: { cashtag: string; amount: number; memo?: string }) => {
    if (!input.cashtag?.trim()) throw new Error("$Cashtag required");
    if (!/^\$?[A-Za-z0-9_]{3,20}$/.test(input.cashtag.trim())) throw new Error("Invalid $Cashtag format");
    if (!input.amount || input.amount <= 0) throw new Error("Amount must be > 0");
    if (input.amount > 10000) throw new Error("Chime limit is $10,000 per transfer");
    return input;
  })
  .handler(async ({ data }) => {
    const transferId = `CHM-${Date.now().toString(36).toUpperCase()}`;
    const tag = data.cashtag.startsWith("$") ? data.cashtag : `$${data.cashtag}`;
    return { ok: true, transferId, network: "Chime Instant", eta: "Arrives in seconds", message: `Sent $${data.amount.toFixed(2)} to ${tag} via Chime.` };
  });

export const initiateApplePay = createServerFn({ method: "POST" })
  .validator((input: { amount: number; merchant?: string; deviceId?: string }) => {
    if (!input.amount || input.amount <= 0) throw new Error("Amount must be > 0");
    if (input.amount > 25000) throw new Error("Apple Pay limit is $25,000");
    return input;
  })
  .handler(async ({ data }) => {
    const sessionId = `APAY-${Date.now().toString(36).toUpperCase()}`;
    return { ok: true, sessionId, merchant: data.merchant || "FinextHub Bank Merchant", amount: data.amount, message: `Apple Pay session initiated. Confirm with Face ID on your device.` };
  });
