// Client-side UI stores — thin wrappers for display state only.
// All financial data (transactions, balances) now lives in PostgreSQL and is
// fetched via server functions in account.functions.ts.

import { useSyncExternalStore } from "react";

// ─── Account holder name (display only) ──────────────────────────────────────
const HOLDER_KEY = "fnx.holder.v3";

function readHolder(): string {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(HOLDER_KEY) ?? ""; } catch { return ""; }
}

let holder = readHolder();
const holderListeners = new Set<() => void>();

export const holderStore = {
  subscribe(l: () => void) { holderListeners.add(l); return () => { holderListeners.delete(l); }; },
  getSnapshot() { return holder; },
  getServerSnapshot() { return ""; },
  set(name: string) {
    holder = name;
    if (typeof window !== "undefined") {
      try {
        if (name) window.localStorage.setItem(HOLDER_KEY, name);
        else window.localStorage.removeItem(HOLDER_KEY);
      } catch {}
    }
    holderListeners.forEach((l) => l());
  },
};

export function useHolder() {
  return useSyncExternalStore(holderStore.subscribe, holderStore.getSnapshot, holderStore.getServerSnapshot);
}

// ─── ACCOUNT_DETAILS (static bank info) ──────────────────────────────────────
export const ACCOUNT_DETAILS = {
  bankName: "FinextHub Bank of USA",
  routingNumber: "021000089",
  swift: "FNXBUS33XXX",
  branch: "Wilmington, DE",
  checking: { name: "FinextHub Checking", mask: "", number: "", type: "Personal Checking" },
  savings: { name: "FinextHub Growth Savings", mask: "", number: "", type: "High-Yield Savings", apy: "4.25%" },
};

// ─── Legacy type re-exports (keep existing imports from breaking) ─────────────
export type Balances = { checking: number; savings: number };
export type { StoredUser } from "./auth";
