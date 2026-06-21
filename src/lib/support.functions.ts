
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { getSessionUser } from "./user.functions";

const SESSION_COOKIE = "fnx_session";

async function getSessionUserId(): Promise<{ userId: string; name: string; email: string } | null> {
  const sid = getCookie(SESSION_COOKIE);
  if (!sid) return null;
  return getSessionUser(sid);
}

// ─── getOrCreateTicket ────────────────────────────────────────────────────────
export const getOrCreateTicket = createServerFn({ method: "POST" })
  .validator((input: { ticketId?: string; name?: string; email?: string; topic?: string }) => input)
  .handler(async ({ data }) => {
    // Verify existing ticket
    if (data.ticketId) {
      const ticketDoc = await getDoc(doc(db, "supportTickets", data.ticketId));
      if (ticketDoc.exists()) return { ticketId: ticketDoc.id };
    }

    // Get session user info if logged in
    const sessionUser = await getSessionUserId();
    const userId = sessionUser?.id || null;
    const name = sessionUser?.name || data.name || "Guest";
    const email = sessionUser?.email || data.email || null;

    const ticketDocRef = await addDoc(collection(db, "supportTickets"), {
      userId,
      name,
      email,
      topic: data.topic || "General",
      status: "open",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { ticketId: ticketDocRef.id };
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
    await addDoc(collection(db, "supportMessages"), {
      ticketId: data.ticketId,
      senderRole: data.senderRole,
      content: data.content,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "supportTickets", data.ticketId), {
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  });

// ─── getTicketMessages ────────────────────────────────────────────────────────
// ─── submitSupportMessage ───────────────────────────────────────────────────
export const submitSupportMessage = createServerFn({ method: "POST" })
  .validator((input: { name: string; email: string; topic: string; message: string }) => {
    if (!input.name?.trim()) throw new Error("Name required");
    if (!input.email?.trim()) throw new Error("Email required");
    if (!input.message?.trim()) throw new Error("Message required");
    return input;
  })
  .handler(async ({ data }) => {
    const ticketDocRef = await addDoc(collection(db, "supportTickets"), {
      userId: null,
      name: data.name,
      email: data.email,
      topic: data.topic,
      status: "open",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await addDoc(collection(db, "supportMessages"), {
      ticketId: ticketDocRef.id,
      senderRole: "user",
      content: data.message,
      createdAt: serverTimestamp(),
    });
    return { ok: true, message: `Ticket ${ticketDocRef.id} opened successfully` };
  });

export const getTicketMessages = createServerFn({ method: "GET" })
  .validator((input: { ticketId: string; since?: string }) => {
    if (!input.ticketId?.trim()) throw new Error("Ticket ID required");
    return input;
  })
  .handler(async ({ data }) => {
    let messagesQuery = query(
      collection(db, "supportMessages"),
      where("ticketId", "==", data.ticketId),
      orderBy("createdAt", "asc")
    );
    const messagesSnap = await getDocs(messagesQuery);
    return messagesSnap.docs.map((doc) => {
      const msgData = doc.data();
      return {
        id: doc.id,
        role: msgData.senderRole as "user" | "bot" | "admin",
        content: msgData.content,
        at: msgData.createdAt?.toDate().toISOString() || new Date().toISOString(),
      };
    });
  });

