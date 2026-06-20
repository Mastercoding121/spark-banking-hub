import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core";
import { query, queryOne } from "./db";

const SESSION_COOKIE = "fnx_session";

async function getSessionUserId(): Promise<{ userId: string; name: string; email: string } | null> {
  const sid = getCookie(SESSION_COOKIE);
  if (!sid) return null;
  const row = await queryOne<{ user_id: string; name: string; email: string }>(
    `SELECT s.user_id, u.name, u.email FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [sid]
  );
  return row ? { userId: row.user_id, name: row.name, email: row.email } : null;
}

// ─── getOrCreateTicket ────────────────────────────────────────────────────────
export const getOrCreateTicket = createServerFn({ method: "POST" })
  .inputValidator((input: { ticketId?: string; name?: string; email?: string; topic?: string }) => input)
  .handler(async ({ data }) => {
    // Verify existing ticket
    if (data.ticketId) {
      const existing = await queryOne<{ id: string }>(
        "SELECT id FROM support_tickets WHERE id = $1", [data.ticketId]
      );
      if (existing) return { ticketId: existing.id };
    }

    // Get session user info if logged in
    const sessionUser = await getSessionUserId();
    const userId = sessionUser?.userId ?? null;
    const name = sessionUser?.name ?? data.name ?? "Guest";
    const email = sessionUser?.email ?? data.email ?? null;

    const row = await queryOne<{ id: string }>(
      `INSERT INTO support_tickets (user_id, name, email, topic, status)
       VALUES ($1, $2, $3, $4, 'open') RETURNING id`,
      [userId, name, email, data.topic ?? "General"]
    );
    return { ticketId: row!.id };
  });

// ─── sendSupportMessage ───────────────────────────────────────────────────────
export const sendSupportMessage = createServerFn({ method: "POST" })
  .inputValidator((input: { ticketId: string; content: string; senderRole: "user" | "bot" }) => {
    if (!input.ticketId?.trim()) throw new Error("Ticket ID required");
    if (!input.content?.trim()) throw new Error("Content required");
    if (!["user", "bot"].includes(input.senderRole)) throw new Error("Invalid sender role");
    return { ...input, content: input.content.trim() };
  })
  .handler(async ({ data }) => {
    await query(
      "INSERT INTO support_messages (ticket_id, sender_role, content) VALUES ($1, $2, $3)",
      [data.ticketId, data.senderRole, data.content]
    );
    await query("UPDATE support_tickets SET updated_at = NOW() WHERE id = $1", [data.ticketId]);
    return { ok: true };
  });

// ─── getTicketMessages ────────────────────────────────────────────────────────
export const getTicketMessages = createServerFn({ method: "GET" })
  .inputValidator((input: { ticketId: string; since?: string }) => {
    if (!input.ticketId?.trim()) throw new Error("Ticket ID required");
    return input;
  })
  .handler(async ({ data }) => {
    const rows = await query<{ id: string; sender_role: string; content: string; created_at: string }>(
      data.since
        ? "SELECT id, sender_role, content, created_at FROM support_messages WHERE ticket_id = $1 AND created_at > $2 ORDER BY created_at ASC"
        : "SELECT id, sender_role, content, created_at FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC",
      data.since ? [data.ticketId, data.since] : [data.ticketId]
    );
    return rows.map((r) => ({
      id: r.id,
      role: r.sender_role as "user" | "bot" | "admin",
      content: r.content,
      at: r.created_at,
    }));
  });
