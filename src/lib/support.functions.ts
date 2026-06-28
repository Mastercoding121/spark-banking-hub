
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core";
import { getSessionUser } from "./user.functions";

const SESSION_COOKIE = "fnx_session";

// In-memory storage for demo
const tickets = new Map();
const messages = new Map();

async function getSessionUserId(): Promise<{ userId: string; name: string; email: string } | null> {
  const sid = getCookie(SESSION_COOKIE);
  if (!sid) return null;
  return getSessionUser(sid);
}

// ─── getOrCreateTicket ────────────────────────────────────────────────────────
export const getOrCreateTicket = createServerFn({ method: "POST" })
  .validator((input: { ticketId?: string; name?: string; email?: string; topic?: string }) => input)
  .handler(async ({ data }) => {
    if (data.ticketId && tickets.has(data.ticketId)) {
      return { ticketId: data.ticketId };
    }

    const sessionUser = await getSessionUserId();
    const userId = sessionUser?.id || null;
    const name = sessionUser?.name || data.name || "Guest";
    const email = sessionUser?.email || data.email || null;

    const ticketId = crypto.randomUUID();
    const newTicket = {
      id: ticketId,
      userId,
      name,
      email,
      topic: data.topic || "General",
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tickets.set(ticketId, newTicket);
    messages.set(ticketId, []);

    return { ticketId };
  });

// ─── sendSupportMessage ───────────────────────────────────────────────────────
export const sendSupportMessage = createServerFn({ method: "POST" })
  .validator((input: { ticketId: string; content: string; senderRole: "user" | "bot" }) => {
    if (!input.ticketId?.trim()) throw new Error("Ticket ID required");
    if (!input.content?.trim()) throw new Error("Content required");
    if (!["user", "bot"].includes(input.senderRole)) throw new Error("Invalid sender role");
    return { ...input, content: input.content.trim() };
  })
  .handler(async ({ data }) => {
    if (!tickets.has(data.ticketId)) {
      throw new Error("Ticket not found");
    }
    const ticketMsgList = messages.get(data.ticketId) || [];
    const newMsg = {
      id: crypto.randomUUID(),
      ticketId: data.ticketId,
      role: data.senderRole,
      content: data.content,
      at: new Date().toISOString(),
    };
    ticketMsgList.push(newMsg);
    messages.set(data.ticketId, ticketMsgList);
    // Update ticket's updatedAt
    const ticket = tickets.get(data.ticketId);
    if (ticket) {
      tickets.set(data.ticketId, { ...ticket, updatedAt: new Date().toISOString() });
    }
    return { ok: true };
  });

// ─── submitSupportMessage ───────────────────────────────────────────────────
export const submitSupportMessage = createServerFn({ method: "POST" })
  .validator((input: { name: string; email: string; topic: string; message: string }) => {
    if (!input.name?.trim()) throw new Error("Name required");
    if (!input.email?.trim()) throw new Error("Email required");
    if (!input.message?.trim()) throw new Error("Message required");
    return input;
  })
  .handler(async ({ data }) => {
    const ticketId = crypto.randomUUID();
    const newTicket = {
      id: ticketId,
      userId: null,
      name: data.name,
      email: data.email,
      topic: data.topic,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tickets.set(ticketId, newTicket);

    const initialMsg = {
      id: crypto.randomUUID(),
      ticketId: ticketId,
      role: "user",
      content: data.message,
      at: new Date().toISOString(),
    };
    messages.set(ticketId, [initialMsg]);

    return { ok: true, message: `Ticket ${ticketId} opened successfully` };
  });

export const getTicketMessages = createServerFn({ method: "GET" })
  .validator((input: { ticketId: string; since?: string }) => {
    if (!input.ticketId?.trim()) throw new Error("Ticket ID required");
    return input;
  })
  .handler(async ({ data }) => {
    const msgList = messages.get(data.ticketId) || [];
    if (data.since) {
      const sinceDate = new Date(data.since);
      return msgList.filter((msg) => new Date(msg.at) > sinceDate);
    }
    return msgList;
  });
