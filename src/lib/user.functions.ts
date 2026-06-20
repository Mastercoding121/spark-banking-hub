import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/start-server-core";
import bcrypt from "bcryptjs";
import { query, queryOne } from "./db";

const SESSION_COOKIE = "fnx_session";
const SESSION_TTL_DAYS = 30;

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  verified: boolean;
  createdAt: string;
};

async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  const rows = await query<{ id: string }>(
    "INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING id",
    [userId, expiresAt]
  );
  return rows[0].id;
}

async function getSessionUser(sessionId: string): Promise<PublicUser | null> {
  if (!sessionId) return null;
  const row = await queryOne<{
    id: string; email: string; name: string;
    is_admin: boolean; verified: boolean; created_at: string; expires_at: string;
  }>(
    `SELECT u.id, u.email, u.name, u.is_admin, u.verified, u.created_at, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [sessionId]
  );
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, isAdmin: row.is_admin, verified: row.verified, createdAt: row.created_at };
}

// ─── getSession ───────────────────────────────────────────────────────────────
export const getSession = createServerFn({ method: "GET" }).handler(async (): Promise<PublicUser | null> => {
  const sid = getCookie(SESSION_COOKIE);
  if (!sid) return null;
  return getSessionUser(sid);
});

// ─── signUp ───────────────────────────────────────────────────────────────────
export const signUp = createServerFn({ method: "POST" })
  .inputValidator((input: {
    email: string; name: string; password: string;
    securityQuestion: string; securityAnswer: string;
  }) => {
    const email = input.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (!input.name?.trim()) throw new Error("Full name is required.");
    if (!input.password || input.password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (!input.securityQuestion) throw new Error("Security question is required.");
    if (!input.securityAnswer?.trim()) throw new Error("Security answer is required.");
    return { email, name: input.name.trim(), password: input.password, securityQuestion: input.securityQuestion, securityAnswer: input.securityAnswer.trim().toLowerCase() };
  })
  .handler(async ({ data }): Promise<PublicUser> => {
    const existing = await queryOne("SELECT id FROM users WHERE email = $1", [data.email]);
    if (existing) throw new Error("An account with this email already exists.");

    const passwordHash = await bcrypt.hash(data.password, 12);
    const answerHash = await bcrypt.hash(data.securityAnswer, 10);

    // First user ever → admin
    const countRow = await queryOne<{ count: string }>("SELECT COUNT(*) as count FROM users");
    const isFirstUser = parseInt(countRow?.count ?? "0") === 0;

    const user = await queryOne<{ id: string; email: string; name: string; is_admin: boolean; verified: boolean; created_at: string }>(
      `INSERT INTO users (email, name, password_hash, security_question, security_answer_hash, is_admin)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, is_admin, verified, created_at`,
      [data.email, data.name, passwordHash, data.securityQuestion, answerHash, isFirstUser]
    );
    if (!user) throw new Error("Failed to create account.");

    // Create default checking + savings accounts
    await query(
      `INSERT INTO accounts (user_id, type, balance) VALUES ($1, 'checking', 0), ($1, 'savings', 0)`,
      [user.id]
    );

    const sid = await createSession(user.id);
    setCookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_DAYS * 86400,
      path: "/",
    });

    return { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin, verified: user.verified, createdAt: user.created_at };
  });

// ─── signIn ───────────────────────────────────────────────────────────────────
export const signIn = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => {
    const email = input.email?.trim().toLowerCase();
    if (!email) throw new Error("Email is required.");
    if (!input.password) throw new Error("Password is required.");
    return { email, password: input.password };
  })
  .handler(async ({ data }): Promise<PublicUser> => {
    const user = await queryOne<{
      id: string; email: string; name: string; password_hash: string;
      is_admin: boolean; verified: boolean; created_at: string;
    }>("SELECT * FROM users WHERE email = $1", [data.email]);
    if (!user) throw new Error("No account found for that email.");

    const ok = await bcrypt.compare(data.password, user.password_hash);
    if (!ok) throw new Error("Incorrect password.");

    const sid = await createSession(user.id);
    setCookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_DAYS * 86400,
      path: "/",
    });

    return { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin, verified: user.verified, createdAt: user.created_at };
  });

// ─── signOut ──────────────────────────────────────────────────────────────────
export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const sid = getCookie(SESSION_COOKIE);
  if (sid) {
    await query("DELETE FROM sessions WHERE id = $1", [sid]).catch(() => {});
  }
  deleteCookie(SESSION_COOKIE, { path: "/" });
  return { ok: true };
});

// ─── markVerified ─────────────────────────────────────────────────────────────
export const markVerified = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => ({ email: input.email.trim().toLowerCase() }))
  .handler(async ({ data }) => {
    await query("UPDATE users SET verified = TRUE, updated_at = NOW() WHERE email = $1", [data.email]);
    return { ok: true };
  });

// ─── lookupForReset ───────────────────────────────────────────────────────────
export const lookupForReset = createServerFn({ method: "GET" })
  .inputValidator((input: { email: string }) => ({ email: input.email.trim().toLowerCase() }))
  .handler(async ({ data }) => {
    const user = await queryOne<{ email: string; security_question: string }>(
      "SELECT email, security_question FROM users WHERE email = $1",
      [data.email]
    );
    if (!user) throw new Error("No account found for that email.");
    return { email: user.email, securityQuestion: user.security_question };
  });

// ─── resetPassword ────────────────────────────────────────────────────────────
export const resetPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; answer: string; newPassword: string }) => ({
    email: input.email.trim().toLowerCase(),
    answer: input.answer.trim().toLowerCase(),
    newPassword: input.newPassword,
  }))
  .handler(async ({ data }) => {
    if (data.newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
    const user = await queryOne<{ id: string; security_answer_hash: string }>(
      "SELECT id, security_answer_hash FROM users WHERE email = $1",
      [data.email]
    );
    if (!user) throw new Error("No account found for that email.");
    const ok = await bcrypt.compare(data.answer, user.security_answer_hash);
    if (!ok) throw new Error("Security answer is incorrect.");
    const hash = await bcrypt.hash(data.newPassword, 12);
    await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hash, user.id]);
    return { ok: true };
  });

// ─── updateProfile ────────────────────────────────────────────────────────────
export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator((input: { name?: string; currentPassword?: string; newPassword?: string }) => input)
  .handler(async ({ data }): Promise<PublicUser> => {
    const sid = getCookie(SESSION_COOKIE);
    const sessionUser = sid ? await getSessionUser(sid) : null;
    if (!sessionUser) throw new Error("Not authenticated.");

    if (data.newPassword) {
      if (data.newPassword.length < 8) throw new Error("New password must be at least 8 characters.");
      const row = await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [sessionUser.id]);
      if (!row) throw new Error("User not found.");
      if (!data.currentPassword) throw new Error("Current password required.");
      const ok = await bcrypt.compare(data.currentPassword, row.password_hash);
      if (!ok) throw new Error("Current password is incorrect.");
      const hash = await bcrypt.hash(data.newPassword, 12);
      await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hash, sessionUser.id]);
    }

    if (data.name?.trim()) {
      await query("UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2", [data.name.trim(), sessionUser.id]);
    }

    const updated = await queryOne<{ id: string; email: string; name: string; is_admin: boolean; verified: boolean; created_at: string }>(
      "SELECT id, email, name, is_admin, verified, created_at FROM users WHERE id = $1",
      [sessionUser.id]
    );
    if (!updated) throw new Error("User not found.");
    return { id: updated.id, email: updated.email, name: updated.name, isAdmin: updated.is_admin, verified: updated.verified, createdAt: updated.created_at };
  });
