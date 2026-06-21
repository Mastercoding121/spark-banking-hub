// Client-side auth state — UI layer only.
// Actual authentication and session management is handled by user.functions.ts (server-side, cookie-based).

import { useSyncExternalStore } from "react";

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  verified: boolean;
  createdAt: string;
};

const SESSION_KEY = "fnx.auth.session.v3";

function readLocal(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeLocal(u: StoredUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (u) window.localStorage.setItem(SESSION_KEY, JSON.stringify(u));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {}
}

let currentUser: StoredUser | null = readLocal();
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

export const authStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  getSnapshot() { return currentUser?.email ?? ""; },
  getServerSnapshot() { return ""; },
  current(): StoredUser | null { return currentUser; },
  setUser(u: StoredUser | null) {
    currentUser = u;
    writeLocal(u);
    emit();
  },
  signOut() {
    currentUser = null;
    writeLocal(null);
    emit();
  },
};

export function useAuthSession() {
  return useSyncExternalStore(authStore.subscribe, authStore.getSnapshot, authStore.getServerSnapshot);
}

// Centralized useAuth hook
export function useAuth() {
  const user = useSyncExternalStore(authStore.subscribe, () => authStore.current(), () => null);
  return {
    user,
    isLoggedIn: !!user,
    signOut: authStore.signOut,
  };
}

export const SECURITY_QUESTIONS = [
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What was the make of your first car?",
  "What is your favorite teacher's last name?",
];
