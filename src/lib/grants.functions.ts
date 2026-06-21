
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
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { getSessionUser } from "./user.functions";

const SESSION_COOKIE = "fnx_session";

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

async function requireSession(): Promise<string> {
  const sid = getCookie(SESSION_COOKIE);
  if (!sid) throw new Error("Please sign in to apply for grants.");
  const user = await getSessionUser(sid);
  if (!user) throw new Error("Session expired. Please sign in again.");
  return user.id;
}

// ─── getPublicGrants ──────────────────────────────────────────────────────────
export const getPublicGrants = createServerFn({ method: "GET" }).handler(async (): Promise<Grant[]> => {
  try {
    const grantsQuery = query(
      collection(db, "grants"),
      where("status", "==", "active"),
      orderBy("createdAt", "desc")
    );
    const grantsSnap = await getDocs(grantsQuery);
    return grantsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        amount: Number(data.amount),
        eligibilityText: data.eligibilityText || null,
        deadline: data.deadline || null,
        status: data.status as Grant["status"],
        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
});

// ─── applyForGrant ────────────────────────────────────────────────────────────
export const applyForGrant = createServerFn({ method: "POST" })
  .validator((input: { grantId: string; purpose: string; amountRequested: number }) => {
    if (!input.grantId) throw new Error("Grant ID required.");
    if (!input.purpose?.trim() || input.purpose.trim().length < 20)
      throw new Error("Please describe your purpose (at least 20 characters)");
    if (!input.amountRequested || input.amountRequested <= 0)
      throw new Error("Amount must be greater than 0.");
    return { ...input, purpose: input.purpose.trim() };
  })
  .handler(async ({ data }) => {
    const userId = await requireSession();

    // Check grant exists and is active
    const grantDocRef = doc(db, "grants", data.grantId);
    const grantSnap = await getDoc(grantDocRef);
    if (!grantSnap.exists()) throw new Error("Grant not found.");
    const grantData = grantSnap.data();
    if (grantData.status !== "active")
      throw new Error("This grant is not currently accepting applications.");

    const maxAmount = Number(grantData.amount);
    if (data.amountRequested > maxAmount)
      throw new Error(`Amount cannot exceed $${maxAmount.toLocaleString()}.`);

    // Check no existing application
    const existingQuery = query(
      collection(db, "grantApplications"),
      where("grantId", "==", data.grantId),
      where("userId", "==", userId)
    );
    const existingSnap = await getDocs(existingQuery);
    if (!existingSnap.empty)
      throw new Error("You have already applied for this grant.");

    // Create application
    await addDoc(collection(db, "grantApplications"), {
      grantId: data.grantId,
      userId,
      purpose: data.purpose,
      amountRequested: data.amountRequested,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { ok: true, message: "Your application has been submitted and is under review." };
  });

// ─── getMyGrantApplications ───────────────────────────────────────────────────
export const getMyGrantApplications = createServerFn({ method: "GET" }).handler(
  async (): Promise<GrantApplication[]> => {
    try {
      const userId = await requireSession();
      const appsQuery = query(
        collection(db, "grantApplications"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const appsSnap = await getDocs(appsQuery);
      const results: GrantApplication[] = [];
      for (const appDoc of appsSnap.docs) {
        const appData = appDoc.data();
        const grantDoc = await getDoc(doc(db, "grants", appData.grantId));
        const grantTitle = grantDoc.exists() ? grantDoc.data().title : "";
        results.push({
          id: appDoc.id,
          grantId: appData.grantId,
          grantTitle,
          purpose: appData.purpose,
          amountRequested: Number(appData.amountRequested),
          status: appData.status as GrantApplication["status"],
          createdAt: appData.createdAt?.toDate().toISOString() || new Date().toISOString(),
        });
      }
      return results;
    } catch {
      return [];
    }
  }
);

