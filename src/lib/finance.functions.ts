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
          return { symbol, name: NAMES[symbol] ?? symbol, price, change, changePct, currency: meta.currency ?? "USD" };
        } catch {
          const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
          const price = 50 + (seed % 400) + Math.random() * 5;
          const change = (Math.random() - 0.5) * 6;
          return { symbol, name: NAMES[symbol] ?? symbol, price, change, changePct: (change / price) * 100, currency: "USD" };
        }
      }),
    );
    return { quotes: results.filter(Boolean) as StockQuote[], updatedAt: new Date().toISOString() };
  });

// ---------- Loan application + status tracking ----------

export type LoanStatus = "submitted" | "underwriting" | "approved";

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

// In-memory store. Survives within a server instance.
const LOAN_STORE = new Map<string, LoanApplication>();

function advanceLoan(app: LoanApplication) {
  const elapsed = Date.now() - new Date(app.submittedAt).getTime();
  // Simulate workflow: submitted -> underwriting (after 20s) -> approved (after 45s)
  if (elapsed > 45_000 && app.status !== "approved") {
    app.status = "approved";
    app.history.push({ status: "approved", at: new Date().toISOString(), note: "Approved by underwriting. Loan officer will reach out to finalize." });
    app.underwritingNotes.push({ id: `un-${Date.now()}`, at: new Date().toISOString(), author: "underwriter", text: "Credit profile and income verified. Loan approved at quoted APR. Closing docs to follow." });
  } else if (elapsed > 20_000 && app.status === "submitted") {
    app.status = "underwriting";
    app.history.push({ status: "underwriting", at: new Date().toISOString(), note: "Credit review and income verification in progress." });
    app.underwritingNotes.push({ id: `un-${Date.now()}`, at: new Date().toISOString(), author: "system", text: "Soft credit pull completed. Awaiting income documentation upload." });
  }
}

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
    const now = new Date().toISOString();
    const app: LoanApplication = {
      referenceId,
      productId: data.productId,
      amount: data.amount,
      termMonths: data.termMonths,
      fullName: data.fullName,
      email: data.email,
      status: "submitted",
      submittedAt: now,
      history: [{ status: "submitted", at: now, note: `Application received for ${data.fullName}. Confirmation sent to ${data.email}.` }],
      documents: [],
      underwritingNotes: [{ id: `un-${Date.now()}`, at: now, author: "system", text: "Application intake complete. Forwarded to underwriting queue." }],
    };
    LOAN_STORE.set(referenceId, app);
    return { ok: true, referenceId, message: `Application received. Track status with reference ${referenceId}.` };
  });

export const uploadLoanDocument = createServerFn({ method: "POST" })
  .inputValidator((input: { referenceId: string; name: string; sizeBytes: number; contentType: string }) => {
    if (!input.referenceId?.trim()) throw new Error("Reference required");
    if (!input.name?.trim()) throw new Error("File name required");
    if (!input.sizeBytes || input.sizeBytes <= 0) throw new Error("Invalid file size");
    if (input.sizeBytes > 15 * 1024 * 1024) throw new Error("File too large (max 15 MB)");
    return input;
  })
  .handler(async ({ data }) => {
    const app = LOAN_STORE.get(data.referenceId.trim().toUpperCase());
    if (!app) throw new Error("Application not found");
    const doc: LoanDocument = {
      id: `doc-${Date.now().toString(36).toUpperCase()}`,
      name: data.name,
      sizeBytes: data.sizeBytes,
      contentType: data.contentType || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
    };
    app.documents.push(doc);
    app.underwritingNotes.push({ id: `un-${Date.now()}`, at: new Date().toISOString(), author: "system", text: `Document received: ${doc.name} (${Math.round(doc.sizeBytes / 1024)} KB).` });
    return { ok: true, document: doc };
  });

export const addUnderwritingNote = createServerFn({ method: "POST" })
  .inputValidator((input: { referenceId: string; text: string }) => {
    if (!input.referenceId?.trim()) throw new Error("Reference required");
    if (!input.text?.trim() || input.text.length < 2) throw new Error("Note too short");
    if (input.text.length > 1000) throw new Error("Note too long");
    return input;
  })
  .handler(async ({ data }) => {
    const app = LOAN_STORE.get(data.referenceId.trim().toUpperCase());
    if (!app) throw new Error("Application not found");
    const note: UnderwritingNote = { id: `un-${Date.now()}`, at: new Date().toISOString(), author: "applicant", text: data.text.trim() };
    app.underwritingNotes.push(note);
    return { ok: true, note };
  });

export const getLoanStatus = createServerFn({ method: "GET" })
  .inputValidator((input: { referenceId: string }) => {
    if (!input.referenceId?.trim()) throw new Error("Reference required");
    return input;
  })
  .handler(async ({ data }): Promise<{ application: LoanApplication } | { error: string }> => {
    const app = LOAN_STORE.get(data.referenceId.trim().toUpperCase());
    if (!app) return { error: "Application not found. Check your reference number." };
    advanceLoan(app);
    return { application: app };
  });

// ---------- Investments ----------

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

// ---------- Chime transfer backend ----------

export const sendChimeTransfer = createServerFn({ method: "POST" })
  .inputValidator((input: { cashtag: string; amount: number; memo?: string }) => {
    if (!input.cashtag?.trim()) throw new Error("$Cashtag required");
    if (!/^\$?[A-Za-z0-9_]{3,20}$/.test(input.cashtag.trim())) throw new Error("Invalid $Cashtag format");
    if (!input.amount || input.amount <= 0) throw new Error("Amount must be > 0");
    if (input.amount > 10_000) throw new Error("Chime limit is $10,000 per transfer");
    return input;
  })
  .handler(async ({ data }) => {
    const transferId = `CHM-${Date.now().toString(36).toUpperCase()}`;
    const tag = data.cashtag.startsWith("$") ? data.cashtag : `$${data.cashtag}`;
    return {
      ok: true,
      transferId,
      network: "Chime Instant",
      eta: "Arrives in seconds",
      message: `Sent $${data.amount.toFixed(2)} to ${tag} via Chime.`,
    };
  });

// ---------- Apple Pay backend ----------

export const initiateApplePay = createServerFn({ method: "POST" })
  .inputValidator((input: { amount: number; merchant?: string; deviceId?: string }) => {
    if (!input.amount || input.amount <= 0) throw new Error("Amount must be > 0");
    if (input.amount > 25_000) throw new Error("Apple Pay limit is $25,000");
    return input;
  })
  .handler(async ({ data }) => {
    const sessionId = `APAY-${Date.now().toString(36).toUpperCase()}`;
    const token = `tok_${Math.random().toString(36).slice(2, 14)}`;
    return {
      ok: true,
      sessionId,
      paymentToken: token,
      merchant: data.merchant ?? "Firestone Bank Merchant",
      amount: data.amount,
      message: `Apple Pay session created. Confirm with Face ID on your device.`,
    };
  });

// ---------- 24/7 Support bot ----------

export const submitSupportMessage = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; email: string; topic: string; message: string }) => {
    if (!input.name?.trim()) throw new Error("Name required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("Valid email required");
    if (!input.message?.trim() || input.message.length < 5) throw new Error("Message too short");
    return input;
  })
  .handler(async ({ data }) => {
    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;
    return { ok: true, ticketId, message: `Hi ${data.name}, ticket ${ticketId} opened. An agent will reply to ${data.email} shortly.` };
  });

const SUPPORT_EMAIL = "support@firestonebank.us";

function botAnswer(text: string): string {
  const t = text.toLowerCase();
  if (/(hi|hello|hey|good (morning|afternoon|evening))/.test(t)) {
    return `Hi! I'm Ember, Firestone's 24/7 virtual assistant. How can I help today? For anything I can't resolve, our team is at ${SUPPORT_EMAIL}.`;
  }
  if (/(lost|stolen).*(card|debit|credit)|card.*(lost|stolen)/.test(t)) {
    return `I'm sorry to hear that. I've flagged your card for immediate freeze. Please email ${SUPPORT_EMAIL} with the last 4 digits so a fraud specialist can issue a replacement.`;
  }
  if (/(fraud|unauthorized|dispute|charge)/.test(t)) {
    return `For disputes, please forward transaction details (date, amount, merchant) to ${SUPPORT_EMAIL}. Our fraud team responds within 2 hours, 24/7.`;
  }
  if (/(password|login|sign in|locked)/.test(t)) {
    return `You can reset your password from the login screen using "Forgot password". If you're still locked out, email ${SUPPORT_EMAIL} from your registered address.`;
  }
  if (/(loan|mortgage|apr|interest)/.test(t)) {
    return `You can apply and customize loan terms on the Loans page. For status questions or pre-approval letters, email ${SUPPORT_EMAIL} with your reference ID.`;
  }
  if (/(invest|stock|trade|portfolio|ira|cd)/.test(t)) {
    return `Live rates and trading are on the Investments page. For advisor consultations, email ${SUPPORT_EMAIL} and an advisor will schedule a call.`;
  }
  if (/(transfer|zelle|chime|apple pay|ach|wire)/.test(t)) {
    return `Transfers are handled from your Dashboard. If a transfer is stuck or missing, email ${SUPPORT_EMAIL} with the reference ID and we'll trace it.`;
  }
  if (/(routing|account number|swift|bic)/.test(t)) {
    return `Firestone routing number is 021000089. For your account number and wire details, please email ${SUPPORT_EMAIL} from your registered address for security.`;
  }
  if (/(hours|open|24)/.test(t)) {
    return `We're open 24/7 — every day of the year. For anything urgent, email ${SUPPORT_EMAIL} or call 1-800-FIRESTONE.`;
  }
  if (/(thanks|thank you|thx|ty)/.test(t)) {
    return `You're welcome! If anything else comes up, email ${SUPPORT_EMAIL} and a human agent will follow up.`;
  }
  return `Thanks for reaching out. I'll make sure a specialist sees this — please email the full details to ${SUPPORT_EMAIL} and we'll respond shortly. Reference: ${`BOT-${Date.now().toString(36).toUpperCase()}`}`;
}

export const chatWithBot = createServerFn({ method: "POST" })
  .inputValidator((input: { message: string }) => {
    if (!input.message?.trim()) throw new Error("Message required");
    if (input.message.length > 1000) throw new Error("Message too long");
    return input;
  })
  .handler(async ({ data }) => {
    return {
      ok: true,
      reply: botAnswer(data.message),
      mailto: SUPPORT_EMAIL,
      at: new Date().toISOString(),
    };
  });
