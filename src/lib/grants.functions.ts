
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core";
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

const inMemoryStorage = {
  grants: new Map(),
  applications: new Map(),
};

// Seed some sample grants
if (inMemoryStorage.grants.size === 0) {
  const sampleGrants: Grant[] = [
    { id: "1", title: "Small Business Startup Grant", description: "For new entrepreneurs", amount: 10000, eligibilityText: "Must have business plan", deadline: null, status: "active", createdAt: new Date().toISOString() },
    { id: "2", title: "Community Impact Grant", description: "For local nonprofits", amount: 5000, eligibilityText: "Must be 501(c)(3)", deadline: null, status: "active", createdAt: new Date().toISOString() },
  ];
  sampleGrants.forEach(g => inMemoryStorage.grants.set(g.id, g));
}

async function requireSession(): Promise<string> {
  const sid = getCookie(SESSION_COOKIE);
  if (!sid) throw new Error("Please sign in to apply for grants.");
  const user = await getSessionUser(sid);
  if (!user) throw new Error("Session expired. Please sign in again.");
  return user.id;
}

// ─── getPublicGrants ─────────────────────────────────────────────────────────────
export const getPublicGrants = createServerFn({ method: "GET" }).handler(async (): Promise<Grant[]> => {
  return Array.from(inMemoryStorage.grants.values()).filter(g => g.status === "active");
});

// ─── applyForGrant ────────────────────────────────────────────────────────────
export const applyForGrant = createServerFn({ method: "POST" })
  .validator((input: { grantId: string; purpose: string; amountRequested: number }) => {
    if (!input.grantId) throw new Error("Grant ID required");
    if (!input.purpose?.trim() || input.purpose.trim().length < 20)
      throw new Error("Please describe your purpose (at least 20 characters)");
    if (!input.amountRequested || input.amountRequested <= 0)
      throw new Error("Amount must be greater than 0");
    return { ...input, purpose: input.purpose.trim() };
  })
  .handler(async ({ data }) => {
    const userId = await requireSession();
    const grant = inMemoryStorage.grants.get(data.grantId);
    if (!grant) throw new Error("Grant not found");
    if (grant.status !== "active") throw new Error("This grant is not currently accepting applications");
    if (data.amountRequested > grant.amount) throw new Error(`Amount cannot exceed $${grant.amount.toLocaleString()}`);

    // Check existing applications
    const existing = Array.from(inMemoryStorage.applications.values()).find(a => a.grantId === data.grantId && a.userId === userId);
    if (existing) throw new Error("You have already applied for this grant");

    const applicationId = crypto.randomUUID();
    const newApp: GrantApplication & { userId: string } = {
      id: applicationId,
      grantId: data.grantId,
      userId,
      purpose: data.purpose,
      amountRequested: data.amountRequested,
      status: "pending",
      createdAt: new Date().toISOString(),
      grantTitle: grant.title,
    };
    inMemoryStorage.applications.set(applicationId, newApp);

    return { ok: true, message: "Your application has been submitted and is under review" };
  });

// ─── getMyGrantApplications ───────────────────────────────────────────────────
export const getMyGrantApplications = createServerFn({ method: "GET" }).handler(
  async (): Promise<GrantApplication[]> => {
    const userId = await requireSession();
    const userApps = Array.from(inMemoryStorage.applications.values()).filter(a => a.userId === userId);
    return userApps.map(app => ({
      ...app,
      grantTitle: inMemoryStorage.grants.get(app.grantId)?.title || "",
    }));
  }
);
