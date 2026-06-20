import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core";
import { query, queryOne } from "./db";
import bcrypt from "bcryptjs";

const SESSION_COOKIE = "fnx_session";

async function requireAdmin(): Promise<string> {
  const sid = getCookie(SESSION_COOKIE);
  if (!sid) throw new Error("Not authenticated.");
  const row = await queryOne<{ user_id: string; is_admin: boolean }>(
    `SELECT s.user_id, u.is_admin FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [sid]
  );
  if (!row) throw new Error("Session expired.");
  if (!row.is_admin) throw new Error("Admin access required.");
  return row.user_id;
}

// ─── getAdminStats ────────────────────────────────────────────────────────────
export const getAdminStats = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();

  const [totalUsersRow, totalAccountsRow, totalTransactionsRow, pendingLoansRow, checkingRow, savingsRow, verifiedRow, adminRow] = await Promise.all([
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM accounts"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM transactions"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM loan_applications WHERE status = 'pending'"),
    queryOne<{ total: string }>("SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE type = 'checking'"),
    queryOne<{ total: string }>("SELECT COALESCE(SUM(balance), 0) as total FROM accounts WHERE type = 'savings'"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users WHERE verified = TRUE"),
    queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users WHERE is_admin = TRUE"),
  ]);

  return {
    totalUsers: parseInt(totalUsersRow?.count ?? "0"),
    totalAccounts: parseInt(totalAccountsRow?.count ?? "0"),
    totalTransactions: parseInt(totalTransactionsRow?.count ?? "0"),
    pendingLoans: parseInt(pendingLoansRow?.count ?? "0"),
    totalChecking: parseFloat(checkingRow?.total ?? "0"),
    totalSavings: parseFloat(savingsRow?.total ?? "0"),
    verifiedUsers: parseInt(verifiedRow?.count ?? "0"),
    adminUsers: parseInt(adminRow?.count ?? "0"),
  };
});

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  verified: boolean;
  createdAt: string;
  checkingBalance: number;
  savingsBalance: number;
  transactionCount: number;
};

// ─── listUsers ────────────────────────────────────────────────────────────────
export const listUsers = createServerFn({ method: "GET" }).handler(async (): Promise<AdminUserSummary[]> => {
  await requireAdmin();
  const rows = await query<{
    id: string; email: string; name: string; is_admin: boolean;
    verified: boolean; created_at: string;
    checking_balance: string; savings_balance: string; tx_count: string;
  }>(
    `SELECT u.id, u.email, u.name, u.is_admin, u.verified, u.created_at,
      COALESCE(c.balance, 0) as checking_balance,
      COALESCE(s.balance, 0) as savings_balance,
      COALESCE(t.tx_count, 0) as tx_count
    FROM users u
    LEFT JOIN accounts c ON c.user_id = u.id AND c.type = 'checking'
    LEFT JOIN accounts s ON s.user_id = u.id AND s.type = 'savings'
    LEFT JOIN (SELECT user_id, COUNT(*) as tx_count FROM transactions GROUP BY user_id) t ON t.user_id = u.id
    ORDER BY u.created_at DESC
    LIMIT 500`
  );
  return rows.map((r) => ({
    id: r.id, email: r.email, name: r.name,
    isAdmin: r.is_admin, verified: r.verified, createdAt: r.created_at,
    checkingBalance: parseFloat(r.checking_balance),
    savingsBalance: parseFloat(r.savings_balance),
    transactionCount: parseInt(r.tx_count),
  }));
});

export type AdminUserDetail = {
  user: { id: string; email: string; name: string; isAdmin: boolean; verified: boolean; createdAt: string };
  accounts: { type: string; balance: number }[];
  transactions: { id: string; accountType: string; date: string; description: string; category: string; amount: number }[];
};

// ─── getAdminUser ─────────────────────────────────────────────────────────────
export const getAdminUser = createServerFn({ method: "GET" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<AdminUserDetail> => {
    await requireAdmin();

    const [userRow, acctRows, txRows] = await Promise.all([
      queryOne<{ id: string; email: string; name: string; is_admin: boolean; verified: boolean; created_at: string }>(
        "SELECT id, email, name, is_admin, verified, created_at FROM users WHERE id = $1",
        [data.userId]
      ),
      query<{ type: string; balance: string }>(
        "SELECT type, balance FROM accounts WHERE user_id = $1",
        [data.userId]
      ),
      query<{ id: string; account_type: string; date: string; description: string; category: string; amount: string }>(
        "SELECT id, account_type, date, description, category, amount FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC LIMIT 200",
        [data.userId]
      ),
    ]);

    if (!userRow) throw new Error("User not found.");

    return {
      user: {
        id: userRow.id, email: userRow.email, name: userRow.name,
        isAdmin: userRow.is_admin, verified: userRow.verified, createdAt: userRow.created_at,
      },
      accounts: acctRows.map((a) => ({ type: a.type, balance: parseFloat(a.balance) })),
      transactions: txRows.map((t) => ({
        id: t.id, accountType: t.account_type, date: t.date,
        description: t.description, category: t.category, amount: parseFloat(t.amount),
      })),
    };
  });

// ─── updateUser ───────────────────────────────────────────────────────────────
export const updateUser = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; name?: string; email?: string; isAdmin?: boolean; verified?: boolean; newPassword?: string }) => input)
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    if (data.userId === adminId && data.isAdmin === false) throw new Error("Cannot remove your own admin status.");

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { sets.push(`name = $${idx++}`); params.push(data.name.trim()); }
    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email.");
      sets.push(`email = $${idx++}`); params.push(email);
    }
    if (data.isAdmin !== undefined) { sets.push(`is_admin = $${idx++}`); params.push(data.isAdmin); }
    if (data.verified !== undefined) { sets.push(`verified = $${idx++}`); params.push(data.verified); }
    if (data.newPassword) {
      if (data.newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
      const hash = await bcrypt.hash(data.newPassword, 12);
      sets.push(`password_hash = $${idx++}`); params.push(hash);
    }

    if (sets.length === 0) throw new Error("Nothing to update.");
    sets.push(`updated_at = NOW()`);
    params.push(data.userId);

    await query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}`, params);
    return { ok: true };
  });

// ─── deleteUser ───────────────────────────────────────────────────────────────
export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    if (data.userId === adminId) throw new Error("Cannot delete your own account.");
    await query("DELETE FROM users WHERE id = $1", [data.userId]);
    return { ok: true };
  });

// ─── adminAdjustBalance ───────────────────────────────────────────────────────
// Adjusts by a delta amount (positive = credit, negative = debit), creates a transaction record.
export const adminAdjustBalance = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; accountType: "checking" | "savings"; amount: number; note: string }) => {
    if (typeof input.amount !== "number" || isNaN(input.amount) || input.amount === 0)
      throw new Error("Amount must be a non-zero number.");
    if (!input.note?.trim()) throw new Error("Admin note is required.");
    return { ...input, amount: Math.round(input.amount * 100) / 100 };
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    await query(
      "UPDATE accounts SET balance = balance + $1 WHERE user_id = $2 AND type = $3",
      [data.amount, data.userId, data.accountType]
    );
    await query(
      `INSERT INTO transactions (user_id, account_type, date, description, category, amount)
       VALUES ($1, $2, CURRENT_DATE, $3, 'Admin Adjustment', $4)`,
      [data.userId, data.accountType, data.note, data.amount]
    );
    return { ok: true };
  });

// ─── adminAddTransaction ──────────────────────────────────────────────────────
export const adminAddTransaction = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; accountType: "checking" | "savings"; description: string; category: string; amount: number }) => {
    if (!input.description?.trim()) throw new Error("Description required.");
    if (typeof input.amount !== "number" || isNaN(input.amount) || input.amount === 0) throw new Error("Valid non-zero amount required.");
    return { ...input, description: input.description.trim(), amount: Math.round(input.amount * 100) / 100 };
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    await query(
      "UPDATE accounts SET balance = balance + $1 WHERE user_id = $2 AND type = $3",
      [data.amount, data.userId, data.accountType]
    );
    const row = await queryOne<{ id: string }>(
      `INSERT INTO transactions (user_id, account_type, date, description, category, amount)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5) RETURNING id`,
      [data.userId, data.accountType, data.description, data.category, data.amount]
    );
    return { ok: true, id: row?.id };
  });

// ─── adminDeleteTransaction ───────────────────────────────────────────────────
export const adminDeleteTransaction = createServerFn({ method: "POST" })
  .inputValidator((input: { transactionId: string; userId: string }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    const tx = await queryOne<{ account_type: string; amount: string }>(
      "SELECT account_type, amount FROM transactions WHERE id = $1 AND user_id = $2",
      [data.transactionId, data.userId]
    );
    if (!tx) throw new Error("Transaction not found.");
    await query(
      "UPDATE accounts SET balance = balance - $1 WHERE user_id = $2 AND type = $3",
      [parseFloat(tx.amount), data.userId, tx.account_type]
    );
    await query("DELETE FROM transactions WHERE id = $1", [data.transactionId]);
    return { ok: true };
  });

// ─── listAllTransactions ──────────────────────────────────────────────────────
export const listAllTransactions = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const rows = await query<{
    id: string; user_id: string; account_type: string; date: string;
    description: string; category: string; amount: string; created_at: string;
    user_name: string; user_email: string;
  }>(
    `SELECT t.id, t.user_id, t.account_type, t.date, t.description, t.category, t.amount, t.created_at,
      u.name as user_name, u.email as user_email
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT 1000`
  );
  return rows.map((r) => ({
    id: r.id, userId: r.user_id, accountType: r.account_type,
    date: r.date, description: r.description, category: r.category,
    amount: parseFloat(r.amount), createdAt: r.created_at,
    userName: r.user_name, userEmail: r.user_email,
  }));
});

// ─── listLoans ────────────────────────────────────────────────────────────────
export const listLoans = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const rows = await query<{
    id: string; reference_id: string; email: string; full_name: string;
    amount: string; term_months: string; product_id: string;
    status: string; submitted_at: string; created_at: string;
    user_name: string;
  }>(
    `SELECT la.id, la.reference_id, la.email, la.full_name, la.amount, la.term_months,
      la.product_id, la.status,
      la.submitted_at,
      COALESCE(u.name, la.full_name, la.email) as user_name
     FROM loan_applications la
     LEFT JOIN users u ON u.email = la.email
     ORDER BY la.submitted_at DESC
     LIMIT 500`
  );
  return rows.map((r) => ({
    id: r.id, referenceId: r.reference_id, email: r.email,
    fullName: r.full_name,
    amount: parseFloat(r.amount),
    term: r.term_months, type: r.product_id,
    purpose: r.full_name,
    status: r.status,
    createdAt: r.submitted_at ?? r.created_at,
    userName: r.user_name, userEmail: r.email,
  }));
});

// ─── updateLoanStatus ─────────────────────────────────────────────────────────
export const updateLoanStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { loanId: string; status: string }) => {
    const allowed = ["pending", "approved", "rejected", "disbursed"];
    if (!allowed.includes(input.status)) throw new Error("Invalid status.");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    const result = await query(
      "UPDATE loan_applications SET status = $1, updated_at = NOW() WHERE id = $2",
      [data.status, data.loanId]
    );
    return { ok: true };
  });
