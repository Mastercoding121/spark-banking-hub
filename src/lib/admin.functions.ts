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

// ─── runSchemaMigration ───────────────────────────────────────────────────────
export const runSchemaMigration = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();

  const TABLES = [
    {
      name: "users",
      sql: `CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        security_question TEXT,
        security_answer_hash TEXT,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "sessions",
      sql: `CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "accounts",
      sql: `CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('checking', 'savings')),
        balance NUMERIC(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, type)
      )`,
    },
    {
      name: "transactions",
      sql: `CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_type TEXT NOT NULL,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        description TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Other',
        amount NUMERIC(15,2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "loan_applications",
      sql: `CREATE TABLE IF NOT EXISTS loan_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reference_id TEXT UNIQUE NOT NULL,
        product_id TEXT NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        term_months INTEGER NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'submitted',
        history JSONB NOT NULL DEFAULT '[]',
        documents JSONB NOT NULL DEFAULT '[]',
        underwriting_notes JSONB NOT NULL DEFAULT '[]',
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "support_tickets",
      sql: `CREATE TABLE IF NOT EXISTS support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        name TEXT,
        email TEXT,
        topic TEXT NOT NULL DEFAULT 'General',
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "support_messages",
      sql: `CREATE TABLE IF NOT EXISTS support_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        sender_role TEXT NOT NULL DEFAULT 'user',
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "feature_flags",
      sql: `CREATE TABLE IF NOT EXISTS feature_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feature_key TEXT UNIQUE NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        reason TEXT,
        details TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "grants",
      sql: `CREATE TABLE IF NOT EXISTS grants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        eligibility_text TEXT,
        deadline DATE,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "grant_applications",
      sql: `CREATE TABLE IF NOT EXISTS grant_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        grant_id UUID NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL,
        amount_requested NUMERIC(15,2) NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    },
  ];

  const INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC)",
    "CREATE INDEX IF NOT EXISTS idx_loans_email ON loan_applications(email)",
    "CREATE INDEX IF NOT EXISTS idx_loans_status ON loan_applications(status)",
    "CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status)",
    "CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages(ticket_id)",
    "CREATE INDEX IF NOT EXISTS idx_grant_applications_user_id ON grant_applications(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_grant_applications_grant_id ON grant_applications(grant_id)",
  ];

  // Seed default feature flags
  const FLAG_KEYS = ["investments", "grants", "deposits", "withdrawals", "transfers", "loans"];
  for (const key of FLAG_KEYS) {
    try {
      await query(
        `INSERT INTO feature_flags (feature_key, enabled) VALUES ($1, TRUE) ON CONFLICT (feature_key) DO NOTHING`,
        [key]
      );
    } catch {}
  }

  const results: { name: string; status: "ok" | "error"; message: string }[] = [];

  for (const table of TABLES) {
    try {
      await query(table.sql);
      results.push({ name: table.name, status: "ok", message: "Table ensured" });
    } catch (e: any) {
      results.push({ name: table.name, status: "error", message: e?.message ?? "Unknown error" });
    }
  }

  for (const idx of INDEXES) {
    try {
      await query(idx);
    } catch {}
  }

  const errorCount = results.filter((r) => r.status === "error").length;
  return { ok: errorCount === 0, results, at: new Date().toISOString() };
});

// ─── adminListTickets ─────────────────────────────────────────────────────────
export const adminListTickets = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const rows = await query<{
    id: string; user_id: string | null; name: string | null; email: string | null;
    topic: string; status: string; created_at: string; updated_at: string;
    message_count: string; latest_content: string | null; latest_role: string | null;
  }>(
    `SELECT
       st.id, st.user_id, st.name, st.email, st.topic, st.status,
       st.created_at, st.updated_at,
       COUNT(sm.id)::TEXT as message_count,
       (SELECT content  FROM support_messages WHERE ticket_id = st.id ORDER BY created_at DESC LIMIT 1) as latest_content,
       (SELECT sender_role FROM support_messages WHERE ticket_id = st.id ORDER BY created_at DESC LIMIT 1) as latest_role
     FROM support_tickets st
     LEFT JOIN support_messages sm ON sm.ticket_id = st.id
     GROUP BY st.id
     ORDER BY st.updated_at DESC
     LIMIT 300`
  );
  return rows.map((r) => ({
    id: r.id, userId: r.user_id, name: r.name ?? "Guest", email: r.email ?? "—",
    topic: r.topic, status: r.status,
    createdAt: r.created_at, updatedAt: r.updated_at,
    messageCount: parseInt(r.message_count ?? "0"),
    latestContent: r.latest_content,
    latestRole: r.latest_role as "user" | "bot" | "admin" | null,
  }));
});

// ─── adminGetTicketMessages ───────────────────────────────────────────────────
export const adminGetTicketMessages = createServerFn({ method: "GET" })
  .inputValidator((input: { ticketId: string }) => {
    if (!input.ticketId) throw new Error("Ticket ID required");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    const rows = await query<{ id: string; sender_role: string; content: string; created_at: string }>(
      "SELECT id, sender_role, content, created_at FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC",
      [data.ticketId]
    );
    return rows.map((r) => ({
      id: r.id, role: r.sender_role as "user" | "bot" | "admin",
      content: r.content, at: r.created_at,
    }));
  });

// ─── adminReplyTicket ─────────────────────────────────────────────────────────
export const adminReplyTicket = createServerFn({ method: "POST" })
  .inputValidator((input: { ticketId: string; content: string }) => {
    if (!input.ticketId) throw new Error("Ticket ID required");
    if (!input.content?.trim()) throw new Error("Message required");
    return { ...input, content: input.content.trim() };
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    await query(
      "INSERT INTO support_messages (ticket_id, sender_role, content) VALUES ($1, 'admin', $2)",
      [data.ticketId, data.content]
    );
    await query("UPDATE support_tickets SET updated_at = NOW() WHERE id = $1", [data.ticketId]);
    return { ok: true };
  });

// ─── adminUpdateTicketStatus ──────────────────────────────────────────────────
export const adminUpdateTicketStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { ticketId: string; status: "open" | "resolved" }) => {
    if (!["open", "resolved"].includes(input.status)) throw new Error("Invalid status");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    await query("UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2", [data.status, data.ticketId]);
    return { ok: true };
  });

// ─── getRecentActivity ────────────────────────────────────────────────────────
export const getRecentActivity = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const [txRows, userRows, loanRows] = await Promise.all([
    query<{
      id: string; user_id: string; date: string; description: string;
      category: string; amount: string; account_type: string; created_at: string;
      user_name: string; user_email: string;
    }>(
      `SELECT t.id, t.user_id, t.date, t.description, t.category, t.amount, t.account_type, t.created_at,
        u.name as user_name, u.email as user_email
       FROM transactions t JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC LIMIT 15`
    ),
    query<{ id: string; name: string; email: string; is_admin: boolean; verified: boolean; created_at: string }>(
      "SELECT id, name, email, is_admin, verified, created_at FROM users ORDER BY created_at DESC LIMIT 8"
    ),
    query<{ id: string; reference_id: string; full_name: string; email: string; amount: string; status: string; submitted_at: string }>(
      "SELECT id, reference_id, full_name, email, amount, status, submitted_at FROM loan_applications ORDER BY submitted_at DESC LIMIT 8"
    ),
  ]);
  return {
    recentTransactions: txRows.map((r) => ({
      id: r.id, userId: r.user_id, date: r.date, description: r.description,
      category: r.category, amount: parseFloat(r.amount), accountType: r.account_type,
      createdAt: r.created_at, userName: r.user_name, userEmail: r.user_email,
    })),
    recentUsers: userRows.map((r) => ({
      id: r.id, name: r.name, email: r.email,
      isAdmin: r.is_admin, verified: r.verified, createdAt: r.created_at,
    })),
    recentLoans: loanRows.map((r) => ({
      id: r.id, referenceId: r.reference_id, fullName: r.full_name,
      email: r.email, amount: parseFloat(r.amount), status: r.status, submittedAt: r.submitted_at,
    })),
  };
});

// ─── adminResetPassword ───────────────────────────────────────────────────────
export const adminResetPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; newPassword: string }) => {
    if (!input.newPassword || input.newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    const hash = await bcrypt.hash(data.newPassword, 12);
    await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hash, data.userId]);
    return { ok: true };
  });

// ─── adminToggleVerified ──────────────────────────────────────────────────────
export const adminToggleVerified = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; verified: boolean }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    await query("UPDATE users SET verified = $1, updated_at = NOW() WHERE id = $2", [data.verified, data.userId]);
    return { ok: true };
  });

// ─── adminToggleAdmin ─────────────────────────────────────────────────────────
export const adminToggleAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; isAdmin: boolean }) => input)
  .handler(async ({ data }) => {
    const selfId = await requireAdmin();
    if (data.userId === selfId && !data.isAdmin) throw new Error("Cannot remove your own admin access.");
    await query("UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2", [data.isAdmin, data.userId]);
    return { ok: true };
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

// ─── adminUpdateUserCreatedAt ─────────────────────────────────────────────────
export const adminUpdateUserCreatedAt = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; createdAt: string }) => {
    if (!input.userId) throw new Error("User ID required");
    if (!input.createdAt) throw new Error("Date required");
    const d = new Date(input.createdAt);
    if (isNaN(d.getTime())) throw new Error("Invalid date");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    await query("UPDATE users SET created_at = $1 WHERE id = $2", [data.createdAt, data.userId]);
    return { ok: true };
  });

// ─── Feature Flags ────────────────────────────────────────────────────────────
export const adminGetFeatureFlags = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const rows = await query<{
    feature_key: string; enabled: boolean; reason: string | null;
    details: string | null; updated_at: string;
  }>("SELECT feature_key, enabled, reason, details, updated_at FROM feature_flags ORDER BY feature_key");
  return rows.map((r) => ({
    key: r.feature_key, enabled: r.enabled,
    reason: r.reason, details: r.details, updatedAt: r.updated_at,
  }));
});

export const adminSetFeatureFlag = createServerFn({ method: "POST" })
  .inputValidator((input: { key: string; enabled: boolean; reason?: string; details?: string }) => {
    if (!input.key?.trim()) throw new Error("Feature key required");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    await query(
      `INSERT INTO feature_flags (feature_key, enabled, reason, details)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (feature_key) DO UPDATE SET enabled = $2, reason = $3, details = $4, updated_at = NOW()`,
      [data.key, data.enabled, data.reason ?? null, data.details ?? null]
    );
    return { ok: true };
  });

// ─── Grants (Admin) ───────────────────────────────────────────────────────────
export const adminListGrants = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const rows = await query<{
    id: string; title: string; description: string; amount: string;
    eligibility_text: string | null; deadline: string | null;
    status: string; created_at: string;
    app_count: string;
  }>(
    `SELECT g.id, g.title, g.description, g.amount, g.eligibility_text, g.deadline, g.status, g.created_at,
       COUNT(ga.id)::TEXT as app_count
     FROM grants g LEFT JOIN grant_applications ga ON ga.grant_id = g.id
     GROUP BY g.id ORDER BY g.created_at DESC`
  );
  return rows.map((r) => ({
    id: r.id, title: r.title, description: r.description,
    amount: parseFloat(r.amount), eligibilityText: r.eligibility_text,
    deadline: r.deadline ? r.deadline.split("T")[0] : null,
    status: r.status, createdAt: r.created_at,
    applicationCount: parseInt(r.app_count ?? "0"),
  }));
});

export const adminCreateGrant = createServerFn({ method: "POST" })
  .inputValidator((input: { title: string; description: string; amount: number; eligibilityText?: string; deadline?: string }) => {
    if (!input.title?.trim()) throw new Error("Title required");
    if (!input.description?.trim()) throw new Error("Description required");
    if (!input.amount || input.amount <= 0) throw new Error("Amount must be > 0");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    const row = await queryOne<{ id: string }>(
      `INSERT INTO grants (title, description, amount, eligibility_text, deadline, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
      [data.title.trim(), data.description.trim(), data.amount, data.eligibilityText ?? null, data.deadline ?? null]
    );
    return { ok: true, id: row!.id };
  });

export const adminUpdateGrant = createServerFn({ method: "POST" })
  .inputValidator((input: {
    grantId: string; title: string; description: string; amount: number;
    eligibilityText?: string; deadline?: string; status: string;
  }) => {
    if (!input.grantId) throw new Error("Grant ID required");
    if (!input.title?.trim()) throw new Error("Title required");
    if (!input.amount || input.amount <= 0) throw new Error("Amount must be > 0");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    await query(
      `UPDATE grants SET title=$1, description=$2, amount=$3, eligibility_text=$4, deadline=$5, status=$6, updated_at=NOW()
       WHERE id=$7`,
      [data.title.trim(), data.description.trim(), data.amount, data.eligibilityText ?? null, data.deadline ?? null, data.status, data.grantId]
    );
    return { ok: true };
  });

export const adminDeleteGrant = createServerFn({ method: "POST" })
  .inputValidator((input: { grantId: string }) => {
    if (!input.grantId) throw new Error("Grant ID required");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    await query("DELETE FROM grants WHERE id = $1", [data.grantId]);
    return { ok: true };
  });

export const adminListGrantApplications = createServerFn({ method: "GET" })
  .inputValidator((input: { grantId?: string }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();
    const rows = await query<{
      id: string; grant_id: string; grant_title: string; user_id: string; user_name: string;
      user_email: string; purpose: string; amount_requested: string; status: string; created_at: string;
    }>(
      data.grantId
        ? `SELECT ga.id, ga.grant_id, g.title as grant_title, ga.user_id, u.name as user_name, u.email as user_email,
             ga.purpose, ga.amount_requested, ga.status, ga.created_at
           FROM grant_applications ga
           JOIN grants g ON g.id = ga.grant_id
           JOIN users u ON u.id = ga.user_id
           WHERE ga.grant_id = $1 ORDER BY ga.created_at DESC`
        : `SELECT ga.id, ga.grant_id, g.title as grant_title, ga.user_id, u.name as user_name, u.email as user_email,
             ga.purpose, ga.amount_requested, ga.status, ga.created_at
           FROM grant_applications ga
           JOIN grants g ON g.id = ga.grant_id
           JOIN users u ON u.id = ga.user_id
           ORDER BY ga.created_at DESC LIMIT 200`,
      data.grantId ? [data.grantId] : []
    );
    return rows.map((r) => ({
      id: r.id, grantId: r.grant_id, grantTitle: r.grant_title,
      userId: r.user_id, userName: r.user_name, userEmail: r.user_email,
      purpose: r.purpose, amountRequested: parseFloat(r.amount_requested),
      status: r.status, createdAt: r.created_at,
    }));
  });

export const adminUpdateGrantApplication = createServerFn({ method: "POST" })
  .inputValidator((input: { applicationId: string; status: "approved" | "rejected" }) => {
    if (!["approved", "rejected"].includes(input.status)) throw new Error("Invalid status");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    await query(
      "UPDATE grant_applications SET status = $1, updated_at = NOW() WHERE id = $2",
      [data.status, data.applicationId]
    );
    return { ok: true };
  });
