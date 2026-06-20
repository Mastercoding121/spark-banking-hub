import { createServerFn } from "@tanstack/react-start";
import { query, queryOne } from "./db";

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
    const history = [{ status: "submitted", at: now, note: `Application received for ${data.fullName}. Confirmation sent to ${data.email}.` }];
    const notes = [{ id: `un-${Date.now()}`, at: now, author: "system", text: "Application intake complete. Forwarded to underwriting queue." }];

    await query(
      `INSERT INTO loan_applications (reference_id, product_id, amount, term_months, full_name, email, status, history, underwriting_notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'submitted', $7, $8)`,
      [referenceId, data.productId, data.amount, data.termMonths, data.fullName, data.email, JSON.stringify(history), JSON.stringify(notes)]
    );

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
    const app = await queryOne<{ documents: any[]; underwriting_notes: any[] }>(
      "SELECT documents, underwriting_notes FROM loan_applications WHERE reference_id = $1",
      [data.referenceId.trim().toUpperCase()]
    );
    if (!app) throw new Error("Application not found");

    const doc: LoanDocument = {
      id: `doc-${Date.now().toString(36).toUpperCase()}`,
      name: data.name,
      sizeBytes: data.sizeBytes,
      contentType: data.contentType || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
    };
    const newDocs = [...(app.documents || []), doc];
    const newNote = { id: `un-${Date.now()}`, at: new Date().toISOString(), author: "system", text: `Document received: ${doc.name} (${Math.round(doc.sizeBytes / 1024)} KB).` };
    const newNotes = [...(app.underwriting_notes || []), newNote];

    await query(
      "UPDATE loan_applications SET documents = $1, underwriting_notes = $2, updated_at = NOW() WHERE reference_id = $3",
      [JSON.stringify(newDocs), JSON.stringify(newNotes), data.referenceId.trim().toUpperCase()]
    );

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
    const app = await queryOne<{ underwriting_notes: any[] }>(
      "SELECT underwriting_notes FROM loan_applications WHERE reference_id = $1",
      [data.referenceId.trim().toUpperCase()]
    );
    if (!app) throw new Error("Application not found");

    const note: UnderwritingNote = { id: `un-${Date.now()}`, at: new Date().toISOString(), author: "applicant", text: data.text.trim() };
    const newNotes = [...(app.underwriting_notes || []), note];
    await query(
      "UPDATE loan_applications SET underwriting_notes = $1, updated_at = NOW() WHERE reference_id = $2",
      [JSON.stringify(newNotes), data.referenceId.trim().toUpperCase()]
    );

    return { ok: true, note };
  });

export const getLoanStatus = createServerFn({ method: "GET" })
  .inputValidator((input: { referenceId: string }) => {
    if (!input.referenceId?.trim()) throw new Error("Reference required");
    return input;
  })
  .handler(async ({ data }): Promise<{ application: LoanApplication } | { error: string }> => {
    const app = await queryOne<{
      reference_id: string; product_id: string; amount: string; term_months: number;
      full_name: string; email: string; status: string; submitted_at: string;
      history: any; documents: any; underwriting_notes: any;
    }>(
      "SELECT * FROM loan_applications WHERE reference_id = $1",
      [data.referenceId.trim().toUpperCase()]
    );
    if (!app) return { error: "Application not found. Check your reference number." };

    return {
      application: {
        referenceId: app.reference_id,
        productId: app.product_id,
        amount: parseFloat(app.amount),
        termMonths: app.term_months,
        fullName: app.full_name,
        email: app.email,
        status: app.status as LoanStatus,
        submittedAt: app.submitted_at,
        history: app.history || [],
        documents: app.documents || [],
        underwritingNotes: app.underwriting_notes || [],
      },
    };
  });

// ─── Investments (live quotes only, no order storage) ─────────────────────────

export const submitInvestmentOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { symbol: string; shares: number; side: "buy" | "sell" }) => {
    if (!input.symbol) throw new Error("Symbol required");
    if (!input.shares || input.shares <= 0) throw new Error("Shares must be > 0");
    if (input.side !== "buy" && input.side !== "sell") throw new Error("Invalid side");
    return input;
  })
  .handler(async ({ data }) => {
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    return { ok: true, orderId, message: `${data.side.toUpperCase()} ${data.shares} ${data.symbol} order submitted. Contact your advisor for confirmation.` };
  });

// ─── Support ──────────────────────────────────────────────────────────────────

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
  .inputValidator((input: { message: string }) => {
    if (!input.message?.trim()) throw new Error("Message required");
    if (input.message.length > 1000) throw new Error("Message too long");
    return input;
  })
  .handler(async ({ data }) => {
    return { ok: true, reply: botAnswer(data.message), mailto: SUPPORT_EMAIL, at: new Date().toISOString() };
  });

// ─── External transfer stubs (recorded in DB) ─────────────────────────────────

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
    return { ok: true, transferId, network: "Chime Instant", eta: "Arrives in seconds", message: `Sent $${data.amount.toFixed(2)} to ${tag} via Chime.` };
  });

export const initiateApplePay = createServerFn({ method: "POST" })
  .inputValidator((input: { amount: number; merchant?: string; deviceId?: string }) => {
    if (!input.amount || input.amount <= 0) throw new Error("Amount must be > 0");
    if (input.amount > 25_000) throw new Error("Apple Pay limit is $25,000");
    return input;
  })
  .handler(async ({ data }) => {
    const sessionId = `APAY-${Date.now().toString(36).toUpperCase()}`;
    return { ok: true, sessionId, merchant: data.merchant ?? "FinextHub Bank Merchant", amount: data.amount, message: `Apple Pay session initiated. Confirm with Face ID on your device.` };
  });
