import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core";
import { query, queryOne } from "./db";
import { getSession } from "./user.functions";

const SESSION_COOKIE = "fnx_session";

export type Transaction = {
  id: string;
  accountType: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  createdAt: string;
};

export type Account = {
  type: string;
  balance: number;
};

export const CATEGORIES = [
  "Food & Dining", "Shopping", "Income", "Transport", "Entertainment",
  "Groceries", "Transfer", "Bills", "Housing", "Healthcare", "Utilities",
  "Education", "Travel", "Personal Care", "Other",
];

export const ACCOUNT_DETAILS = {
  bankName: "FinextHub Bank of USA",
  branch: "Wilmington, DE",
  checking: { name: "FinextHub Checking", type: "Personal Checking" },
  savings: { name: "FinextHub Growth Savings", type: "High-Yield Savings", apy: "4.25%" },
};

async function requireSession() {
  const sid = getCookie(SESSION_COOKIE);
  if (!sid) throw new Error("Not authenticated.");
  const { queryOne: q } = await import("./db");
  const row = await q<{ user_id: string; expires_at: string }>(
    "SELECT user_id, expires_at FROM sessions WHERE id = $1 AND expires_at > NOW()",
    [sid]
  );
  if (!row) throw new Error("Session expired. Please sign in again.");
  return row.user_id;
}

// ─── getAccounts ──────────────────────────────────────────────────────────────
export const getAccounts = createServerFn({ method: "GET" }).handler(async (): Promise<Account[]> => {
  const userId = await requireSession();
  const rows = await query<{ type: string; balance: string }>(
    "SELECT type, balance FROM accounts WHERE user_id = $1 ORDER BY type",
    [userId]
  );
  return rows.map((r) => ({ type: r.type, balance: parseFloat(r.balance) }));
});

// ─── getTransactions ──────────────────────────────────────────────────────────
export const getTransactions = createServerFn({ method: "GET" }).handler(async (): Promise<Transaction[]> => {
  const userId = await requireSession();
  const rows = await query<{
    id: string; account_type: string; date: string;
    description: string; category: string; amount: string; created_at: string;
  }>(
    "SELECT id, account_type, date, description, category, amount, created_at FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC",
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    accountType: r.account_type,
    date: r.date.split("T")[0],
    description: r.description,
    category: r.category,
    amount: parseFloat(r.amount),
    createdAt: r.created_at,
  }));
});

// ─── addTransaction ───────────────────────────────────────────────────────────
export const addTransaction = createServerFn({ method: "POST" })
  .inputValidator((input: {
    accountType: string; date: string; description: string;
    category: string; amount: number;
  }) => {
    if (!input.description?.trim()) throw new Error("Description required.");
    if (!input.date) throw new Error("Date required.");
    if (typeof input.amount !== "number" || isNaN(input.amount)) throw new Error("Valid amount required.");
    return {
      accountType: input.accountType ?? "checking",
      date: input.date,
      description: input.description.trim(),
      category: input.category ?? "Other",
      amount: Math.round(input.amount * 100) / 100,
    };
  })
  .handler(async ({ data }): Promise<Transaction> => {
    const userId = await requireSession();

    // Adjust balance
    const delta = data.amount;
    await query(
      "UPDATE accounts SET balance = balance + $1 WHERE user_id = $2 AND type = $3",
      [delta, userId, data.accountType]
    );

    const row = await queryOne<{
      id: string; account_type: string; date: string;
      description: string; category: string; amount: string; created_at: string;
    }>(
      `INSERT INTO transactions (user_id, account_type, date, description, category, amount)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, account_type, date, description, category, amount, created_at`,
      [userId, data.accountType, data.date, data.description, data.category, data.amount]
    );
    if (!row) throw new Error("Failed to add transaction.");

    return {
      id: row.id,
      accountType: row.account_type,
      date: row.date.split("T")[0],
      description: row.description,
      category: row.category,
      amount: parseFloat(row.amount),
      createdAt: row.created_at,
    };
  });

// ─── deleteTransaction ────────────────────────────────────────────────────────
export const deleteTransaction = createServerFn({ method: "POST" })
  .inputValidator((input: { transactionId: string }) => {
    if (!input.transactionId) throw new Error("Transaction ID required.");
    return input;
  })
  .handler(async ({ data }) => {
    const userId = await requireSession();

    // Reverse the balance effect before deleting
    const tx = await queryOne<{ account_type: string; amount: string }>(
      "SELECT account_type, amount FROM transactions WHERE id = $1 AND user_id = $2",
      [data.transactionId, userId]
    );
    if (!tx) throw new Error("Transaction not found.");

    await query(
      "UPDATE accounts SET balance = balance - $1 WHERE user_id = $2 AND type = $3",
      [parseFloat(tx.amount), userId, tx.account_type]
    );

    await query("DELETE FROM transactions WHERE id = $1 AND user_id = $2", [data.transactionId, userId]);
    return { ok: true };
  });

// ─── transferBetweenAccounts ──────────────────────────────────────────────────
export const transferBetweenAccounts = createServerFn({ method: "POST" })
  .inputValidator((input: { fromAccount: string; toAccount: string; amount: number; description?: string }) => {
    if (!input.amount || input.amount <= 0) throw new Error("Amount must be greater than 0.");
    if (input.fromAccount === input.toAccount) throw new Error("Cannot transfer to the same account.");
    return {
      fromAccount: input.fromAccount,
      toAccount: input.toAccount,
      amount: Math.round(input.amount * 100) / 100,
      description: input.description ?? `Transfer to ${input.toAccount}`,
    };
  })
  .handler(async ({ data }) => {
    const userId = await requireSession();

    const fromAcc = await queryOne<{ balance: string }>(
      "SELECT balance FROM accounts WHERE user_id = $1 AND type = $2",
      [userId, data.fromAccount]
    );
    if (!fromAcc) throw new Error(`${data.fromAccount} account not found.`);
    if (parseFloat(fromAcc.balance) < data.amount) throw new Error("Insufficient funds.");

    const now = new Date().toISOString().split("T")[0];

    await query("UPDATE accounts SET balance = balance - $1 WHERE user_id = $2 AND type = $3", [data.amount, userId, data.fromAccount]);
    await query("UPDATE accounts SET balance = balance + $1 WHERE user_id = $2 AND type = $3", [data.amount, userId, data.toAccount]);

    const debitRow = await queryOne<{ id: string; account_type: string; date: string; description: string; category: string; amount: string; created_at: string }>(
      `INSERT INTO transactions (user_id, account_type, date, description, category, amount)
       VALUES ($1, $2, $3, $4, 'Transfer', $5) RETURNING id, account_type, date, description, category, amount, created_at`,
      [userId, data.fromAccount, now, `Transfer to ${data.toAccount} account`, -data.amount]
    );
    await query(
      `INSERT INTO transactions (user_id, account_type, date, description, category, amount)
       VALUES ($1, $2, $3, $4, 'Transfer', $5)`,
      [userId, data.toAccount, now, `Transfer from ${data.fromAccount} account`, data.amount]
    );

    return {
      ok: true,
      reference: `TRF-${Date.now().toString(36).toUpperCase()}`,
      debit: debitRow,
    };
  });

// ─── recordExternalTransfer ───────────────────────────────────────────────────
export const recordExternalTransfer = createServerFn({ method: "POST" })
  .inputValidator((input: { amount: number; description: string; method: string }) => {
    if (!input.amount || input.amount <= 0) throw new Error("Amount must be > 0.");
    if (!input.description?.trim()) throw new Error("Description required.");
    return { amount: Math.round(input.amount * 100) / 100, description: input.description.trim(), method: input.method ?? "External" };
  })
  .handler(async ({ data }) => {
    const userId = await requireSession();

    const acc = await queryOne<{ balance: string }>(
      "SELECT balance FROM accounts WHERE user_id = $1 AND type = 'checking'",
      [userId]
    );
    if (!acc) throw new Error("Checking account not found.");
    if (parseFloat(acc.balance) < data.amount) throw new Error("Insufficient funds in checking account.");

    await query("UPDATE accounts SET balance = balance - $1 WHERE user_id = $2 AND type = 'checking'", [data.amount, userId]);

    const now = new Date().toISOString().split("T")[0];
    const row = await queryOne<{ id: string }>(
      `INSERT INTO transactions (user_id, account_type, date, description, category, amount)
       VALUES ($1, 'checking', $2, $3, 'Transfer', $4) RETURNING id`,
      [userId, now, data.description, -data.amount]
    );

    return {
      ok: true,
      reference: `${data.method.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      transactionId: row?.id,
    };
  });
