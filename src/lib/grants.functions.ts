import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core";
import { query, queryOne } from "./db";

const SESSION_COOKIE = "fnx_session";

async function requireSession(): Promise<string> {
  const sid = getCookie(SESSION_COOKIE);
  if (!sid) throw new Error("Please sign in to apply for grants.");
  const row = await queryOne<{ user_id: string }>(
    "SELECT user_id FROM sessions WHERE id = $1 AND expires_at > NOW()", [sid]
  );
  if (!row) throw new Error("Session expired. Please sign in again.");
  return row.user_id;
}

export type Grant = {
  id: string;
  title: string;
  description: string;
  amount: number;
  eligibilityText: string | null;
  deadline: string | null;
  status: "active" | "inactive" | "closed";
  createdAt: string;
};

export type GrantApplication = {
  id: string;
  grantId: string;
  grantTitle: string;
  purpose: string;
  amountRequested: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

// ─── getPublicGrants ──────────────────────────────────────────────────────────
export const getPublicGrants = createServerFn({ method: "GET" }).handler(async (): Promise<Grant[]> => {
  try {
    const rows = await query<{
      id: string; title: string; description: string; amount: string;
      eligibility_text: string | null; deadline: string | null;
      status: string; created_at: string;
    }>(
      "SELECT id, title, description, amount, eligibility_text, deadline, status, created_at FROM grants WHERE status = 'active' ORDER BY created_at DESC"
    );
    return rows.map((r) => ({
      id: r.id, title: r.title, description: r.description,
      amount: parseFloat(r.amount), eligibilityText: r.eligibility_text,
      deadline: r.deadline ? r.deadline.split("T")[0] : null,
      status: r.status as Grant["status"], createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
});

// ─── applyForGrant ────────────────────────────────────────────────────────────
export const applyForGrant = createServerFn({ method: "POST" })
  .inputValidator((input: { grantId: string; purpose: string; amountRequested: number }) => {
    if (!input.grantId) throw new Error("Grant ID required");
    if (!input.purpose?.trim() || input.purpose.trim().length < 20) throw new Error("Please describe your purpose (at least 20 characters)");
    if (!input.amountRequested || input.amountRequested <= 0) throw new Error("Amount must be greater than 0");
    return { ...input, purpose: input.purpose.trim() };
  })
  .handler(async ({ data }) => {
    const userId = await requireSession();

    // Check grant exists and is active
    const grant = await queryOne<{ id: string; amount: string; status: string }>(
      "SELECT id, amount, status FROM grants WHERE id = $1", [data.grantId]
    );
    if (!grant) throw new Error("Grant not found.");
    if (grant.status !== "active") throw new Error("This grant is not currently accepting applications.");

    const maxAmount = parseFloat(grant.amount);
    if (data.amountRequested > maxAmount) throw new Error(`Amount cannot exceed $${maxAmount.toLocaleString()}.`);

    // Check no existing application
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM grant_applications WHERE grant_id = $1 AND user_id = $2", [data.grantId, userId]
    );
    if (existing) throw new Error("You have already applied for this grant.");

    await query(
      `INSERT INTO grant_applications (grant_id, user_id, purpose, amount_requested, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [data.grantId, userId, data.purpose, data.amountRequested]
    );
    return { ok: true, message: "Your application has been submitted and is under review." };
  });

// ─── getMyGrantApplications ───────────────────────────────────────────────────
export const getMyGrantApplications = createServerFn({ method: "GET" }).handler(async (): Promise<GrantApplication[]> => {
  try {
    const userId = await requireSession();
    const rows = await query<{
      id: string; grant_id: string; title: string; purpose: string;
      amount_requested: string; status: string; created_at: string;
    }>(
      `SELECT ga.id, ga.grant_id, g.title, ga.purpose, ga.amount_requested, ga.status, ga.created_at
       FROM grant_applications ga
       JOIN grants g ON g.id = ga.grant_id
       WHERE ga.user_id = $1
       ORDER BY ga.created_at DESC`,
      [userId]
    );
    return rows.map((r) => ({
      id: r.id, grantId: r.grant_id, grantTitle: r.title, purpose: r.purpose,
      amountRequested: parseFloat(r.amount_requested),
      status: r.status as GrantApplication["status"], createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
});
