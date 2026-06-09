import { useSyncExternalStore } from "react";
import { TRANSACTIONS as SEED, type Transaction } from "./transactions";

// ---- Transactions store (client-side, persisted) ----
const TX_KEY = "firestone.txs.v1";
const REFS_KEY = "firestone.loanRefs.v1";
const HOLDER_KEY = "firestone.holder.v1";

function readPersistedTxs(): Transaction[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TX_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Transaction[];
  } catch { return null; }
}

let txs: Transaction[] = readPersistedTxs() ?? SEED;
const txListeners = new Set<() => void>();

function persistTxs() {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(TX_KEY, JSON.stringify(txs)); } catch {}
  }
  txListeners.forEach((l) => l());
}

export const txStore = {
  subscribe(l: () => void) { txListeners.add(l); return () => { txListeners.delete(l); }; },
  getSnapshot() { return txs; },
  getServerSnapshot() { return SEED; },
  add(tx: Omit<Transaction, "id">): Transaction {
    const full: Transaction = { ...tx, id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    txs = [full, ...txs];
    persistTxs();
    return full;
  },
  reset() { txs = SEED; persistTxs(); },
};

export function useTransactions() {
  return useSyncExternalStore(txStore.subscribe, txStore.getSnapshot, txStore.getServerSnapshot);
}

// ---- Account holder name ----
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

// ---- My loan refs ----
function readRefs(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(REFS_KEY) ?? "[]"); } catch { return []; }
}
let refs = readRefs();
const refListeners = new Set<() => void>();
export const loanRefStore = {
  subscribe(l: () => void) { refListeners.add(l); return () => { refListeners.delete(l); }; },
  getSnapshot() { return refs; },
  getServerSnapshot() { return [] as string[]; },
  add(r: string) {
    if (refs.includes(r)) return;
    refs = [r, ...refs];
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(REFS_KEY, JSON.stringify(refs)); } catch {}
    }
    refListeners.forEach((l) => l());
  },
};
export function useLoanRefs() {
  return useSyncExternalStore(loanRefStore.subscribe, loanRefStore.getSnapshot, loanRefStore.getServerSnapshot);
}
