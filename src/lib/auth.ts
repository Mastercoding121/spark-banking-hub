import { useSyncExternalStore } from "react";

// Lightweight client-side credential store for demo banking auth.
// Persists in localStorage. Passwords hashed with SHA-256 before storage.

const USERS_KEY = "firestone.auth.users.v1";
const SESSION_KEY = "firestone.auth.session.v1";

export type StoredUser = {
  email: string;
  name: string;
  passwordHash: string;
  securityQuestion: string;
  securityAnswerHash: string;
  createdAt: string;
};

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readUsers(): Record<string, StoredUser> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(USERS_KEY) ?? "{}"); } catch { return {}; }
}
function writeUsers(u: Record<string, StoredUser>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USERS_KEY, JSON.stringify(u));
}
function readSession(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SESSION_KEY) ?? "";
}

let sessionEmail = readSession();
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

export const authStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  getSnapshot() { return sessionEmail; },
  getServerSnapshot() { return ""; },
  current(): StoredUser | null {
    if (!sessionEmail) return null;
    return readUsers()[sessionEmail.toLowerCase()] ?? null;
  },
  async signUp(input: { email: string; name: string; password: string; securityQuestion: string; securityAnswer: string }) {
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (!input.name.trim()) throw new Error("Full name is required.");
    if (!input.securityAnswer.trim()) throw new Error("Security answer is required.");
    const users = readUsers();
    if (users[email]) throw new Error("An account with this email already exists.");
    const user: StoredUser = {
      email,
      name: input.name.trim(),
      passwordHash: await sha256(input.password),
      securityQuestion: input.securityQuestion,
      securityAnswerHash: await sha256(input.securityAnswer.trim().toLowerCase()),
      createdAt: new Date().toISOString(),
    };
    users[email] = user;
    writeUsers(users);
    sessionEmail = email;
    window.localStorage.setItem(SESSION_KEY, email);
    emit();
    return user;
  },
  async signIn(email: string, password: string) {
    const key = email.trim().toLowerCase();
    const user = readUsers()[key];
    if (!user) throw new Error("No account found for that email.");
    const hash = await sha256(password);
    if (hash !== user.passwordHash) throw new Error("Incorrect password.");
    sessionEmail = key;
    window.localStorage.setItem(SESSION_KEY, key);
    emit();
    return user;
  },
  signOut() {
    sessionEmail = "";
    if (typeof window !== "undefined") window.localStorage.removeItem(SESSION_KEY);
    emit();
  },
  async lookupForReset(email: string) {
    const user = readUsers()[email.trim().toLowerCase()];
    if (!user) throw new Error("No account found for that email.");
    return { email: user.email, securityQuestion: user.securityQuestion };
  },
  async resetPassword(email: string, answer: string, newPassword: string) {
    const key = email.trim().toLowerCase();
    const users = readUsers();
    const user = users[key];
    if (!user) throw new Error("No account found for that email.");
    const aHash = await sha256(answer.trim().toLowerCase());
    if (aHash !== user.securityAnswerHash) throw new Error("Security answer is incorrect.");
    if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
    user.passwordHash = await sha256(newPassword);
    users[key] = user;
    writeUsers(users);
    return true;
  },
};

export function useAuthSession() {
  return useSyncExternalStore(authStore.subscribe, authStore.getSnapshot, authStore.getServerSnapshot);
}

export const SECURITY_QUESTIONS = [
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What was the make of your first car?",
  "What is your favorite teacher's last name?",
];
