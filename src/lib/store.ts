import { useSyncExternalStore } from "react";
import { TRANSACTIONS as SEED, type Transaction } from "./transactions";

// ---- Transactions store (client-side, persisted) ----
const TX_KEY = "firestone.txs.v1";
const REFS_KEY = "firestone.loanRefs.v1";
const HOLDER_KEY = "firestone.holder.v1";
const BAL_KEY = "firestone.balances.v1";
const CREDITED_KEY = "firestone.creditedLoans.v1";

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

// ---- Balances store ----
export type Balances = { checking: number; savings: number };
const DEFAULT_BAL: Balances = { checking: 2300, savings: 1800 };

export const ACCOUNT_DETAILS = {
  bankName: "Firestone Bank of USA",
  routingNumber: "021000089",
  swift: "FRSTUS33XXX",
  branch: "Wilmington, DE",
  checking: { name: "Firestone Checking", mask: "4829", number: "8829 1140 0000 4829", type: "Personal Checking" },
  savings: { name: "Firestone Growth Savings", mask: "9104", number: "8829 1140 0000 9104", type: "High-Yield Savings", apy: "4.25%" },
};

function readBal(): Balances {
  if (typeof window === "undefined") return DEFAULT_BAL;
  try {
    const raw = window.localStorage.getItem(BAL_KEY);
    if (!raw) return DEFAULT_BAL;
    return { ...DEFAULT_BAL, ...JSON.parse(raw) };
  } catch { return DEFAULT_BAL; }
}
let balances: Balances = readBal();
const balListeners = new Set<() => void>();
function persistBal() {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(BAL_KEY, JSON.stringify(balances)); } catch {}
  }
  balListeners.forEach((l) => l());
}
export const balanceStore = {
  subscribe(l: () => void) { balListeners.add(l); return () => { balListeners.delete(l); }; },
  getSnapshot() { return balances; },
  getServerSnapshot() { return DEFAULT_BAL; },
  adjust(account: keyof Balances, delta: number) {
    balances = { ...balances, [account]: Math.max(0, Number((balances[account] + delta).toFixed(2))) };
    persistBal();
  },
  set(next: Partial<Balances>) {
    balances = { ...balances, ...next };
    persistBal();
  },
};
export function useBalances() {
  return useSyncExternalStore(balanceStore.subscribe, balanceStore.getSnapshot, balanceStore.getServerSnapshot);
}

// ---- Credited loans (to avoid double-crediting on approval) ----
function readCredited(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(CREDITED_KEY) ?? "[]"); } catch { return []; }
}
let credited = readCredited();
const credListeners = new Set<() => void>();
export const creditedLoanStore = {
  subscribe(l: () => void) { credListeners.add(l); return () => { credListeners.delete(l); }; },
  getSnapshot() { return credited; },
  getServerSnapshot() { return [] as string[]; },
  has(ref: string) { return credited.includes(ref); },
  add(ref: string) {
    if (credited.includes(ref)) return;
    credited = [ref, ...credited];
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(CREDITED_KEY, JSON.stringify(credited)); } catch {}
    }
    credListeners.forEach((l) => l());
  },
};

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
