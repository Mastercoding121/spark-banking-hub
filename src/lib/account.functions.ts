
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { getSessionUser } from "./user.functions";

const SESSION_COOKIE = "fnx_session";

export type Transaction = {
  id: string;
  accountType: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  createdAt: string;
};

export type Account = {
  type: string;
  balance: number;
};

export const CATEGORIES = [
  "Food & Dining",
  "Shopping",
  "Income",
  "Transport",
  "Entertainment",
  "Groceries",
  "Transfer",
  "Bills",
  "Housing",
  "Healthcare",
  "Utilities",
  "Education",
  "Travel",
  "Personal Care",
  "Other",
];

export const ACCOUNT_DETAILS = {
  bankName: "FinextHub Bank of USA",
  branch: "Wilmington, DE",
  checking: { name: "FinextHub Checking", type: "Personal Checking" },
  savings: { name: "FinextHub Growth Savings", type: "High-Yield Savings", apy: "4.25%" },
};

// Helper to ensure we have db
const getDb = () => {
  if (!db) {
    console.warn("Firebase Firestore not initialized! Using in-memory fallback.");
    return { 
      inMemory: true, 
      accounts: new Map(),
      transactions: new Map()
    };
  }
  return db;
};

async function requireSession(): Promise<string> {
  const sid = getCookie(SESSION_COOKIE);
  if (!sid) throw new Error("Not authenticated.");
  const user = await getSessionUser(sid);
  if (!user) throw new Error("Session expired. Please sign in again.");
  return user.id;
}

// ─── getAccounts ──────────────────────────────────────────────────────────────
export const getAccounts = createServerFn({ method: "GET" }).handler(async (): Promise<Account[]> => {
  const userId = await requireSession();
  const currentDb = getDb();
  
  if ("inMemory" in currentDb) {
    // In-memory demo data: return default checking and savings if not exists
    if (!currentDb.accounts.has(`${userId}_checking`)) {
      currentDb.accounts.set(`${userId}_checking`, { userId, type: "checking", balance: 0, createdAt: new Date() });
    }
    if (!currentDb.accounts.has(`${userId}_savings`)) {
      currentDb.accounts.set(`${userId}_savings`, { userId, type: "savings", balance: 0, createdAt: new Date() });
    }
    return Array.from(currentDb.accounts.values())
      .filter(acc => acc.userId === userId)
      .sort((a, b) => a.type.localeCompare(b.type))
      .map(acc => ({ type: acc.type, balance: Number(acc.balance) }));
  }

  const accountsQuery = query(collection(currentDb, "accounts"), where("userId", "==", userId), orderBy("type"));
  const accountsSnap = await getDocs(accountsQuery);
  return accountsSnap.docs.map((doc) => ({
    type: doc.data().type,
    balance: Number(doc.data().balance || 0),
  }));
});

// ─── getTransactions ──────────────────────────────────────────────────────────
export const getTransactions = createServerFn({ method: "GET" }).handler(async (): Promise<Transaction[]> => {
  const userId = await requireSession();
  const currentDb = getDb();

  if ("inMemory" in currentDb) {
    return Array.from(currentDb.transactions.values())
      .filter(tx => tx.userId === userId)
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
      })
      .map(tx => ({
        id: tx.id,
        accountType: tx.accountType,
        date: tx.date,
        description: tx.description,
        category: tx.category,
        amount: Number(tx.amount),
        createdAt: tx.createdAt?.toISOString() || new Date().toISOString(),
      }));
  }

  const txQuery = query(
    collection(currentDb, "transactions"),
    where("userId", "==", userId),
    orderBy("date", "desc"),
    orderBy("createdAt", "desc")
  );
  const txSnap = await getDocs(txQuery);
  return txSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      accountType: data.accountType,
      date: data.date,
      description: data.description,
      category: data.category,
      amount: Number(data.amount),
      createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
    };
  });
});

// ─── addTransaction ───────────────────────────────────────────────────────────
export const addTransaction = createServerFn({ method: "POST" })
  .validator((input: {
    accountType: string;
    date: string;
    description: string;
    category: string;
    amount: number;
  }) => {
    if (!input.description?.trim()) throw new Error("Description required.");
    if (!input.date) throw new Error("Date required.");
    if (typeof input.amount !== "number" || isNaN(input.amount)) throw new Error("Valid amount required.");
    return {
      accountType: input.accountType ?? "checking",
      date: input.date,
      description: input.description.trim(),
      category: input.category ?? "Other",
      amount: Math.round(input.amount * 100) / 100,
    };
  })
  .handler(async ({ data }): Promise<Transaction> => {
    const userId = await requireSession();
    const currentDb = getDb();
    const accountId = `${userId}_${data.accountType}`;

    if ("inMemory" in currentDb) {
      // In-memory logic
      if (!currentDb.accounts.has(accountId)) {
        currentDb.accounts.set(accountId, { userId, type: data.accountType, balance: 0, createdAt: new Date() });
      }
      const account = currentDb.accounts.get(accountId)!;
      account.balance = Number(account.balance) + data.amount;
      account.updatedAt = new Date();

      const txId = crypto.randomUUID();
      const tx = {
        id: txId,
        userId,
        accountType: data.accountType,
        date: data.date,
        description: data.description,
        category: data.category,
        amount: data.amount,
        createdAt: new Date(),
      };
      currentDb.transactions.set(txId, tx);

      return {
        ...tx,
        createdAt: tx.createdAt.toISOString(),
      };
    }

    // Adjust account balance
    const accountDocRef = doc(currentDb, "accounts", accountId);
    const accountSnap = await getDoc(accountDocRef);
    if (!accountSnap.exists()) throw new Error("Account not found.");
    const currentBalance = Number(accountSnap.data().balance || 0);
    await updateDoc(accountDocRef, {
      balance: currentBalance + data.amount,
      updatedAt: serverTimestamp(),
    });

    // Create transaction
    const txDocRef = await addDoc(collection(currentDb, "transactions"), {
      userId,
      accountType: data.accountType,
      date: data.date,
      description: data.description,
      category: data.category,
      amount: data.amount,
      createdAt: serverTimestamp(),
    });
    const txSnap = await getDoc(txDocRef);
    const txData = txSnap.data()!;
    return {
      id: txDocRef.id,
      accountType: txData.accountType,
      date: txData.date,
      description: txData.description,
      category: txData.category,
      amount: Number(txData.amount),
      createdAt: txData.createdAt?.toDate().toISOString() || new Date().toISOString(),
    };
  });

// ─── deleteTransaction ────────────────────────────────────────────────────────
export const deleteTransaction = createServerFn({ method: "POST" })
  .validator((input: { transactionId: string }) => {
    if (!input.transactionId) throw new Error("Transaction ID required.");
    return input;
  })
  .handler(async ({ data }) => {
    const userId = await requireSession();
    const currentDb = getDb();

    if ("inMemory" in currentDb) {
      const tx = currentDb.transactions.get(data.transactionId);
      if (!tx) throw new Error("Transaction not found.");
      if (tx.userId !== userId) throw new Error("Not authorized.");

      // Reverse balance effect
      const accountId = `${userId}_${tx.accountType}`;
      const account = currentDb.accounts.get(accountId);
      if (account) {
        account.balance = Number(account.balance) - Number(tx.amount);
        account.updatedAt = new Date();
      }

      currentDb.transactions.delete(data.transactionId);
      return { ok: true };
    }

    // Get transaction
    const txDocRef = doc(currentDb, "transactions", data.transactionId);
    const txSnap = await getDoc(txDocRef);
    if (!txSnap.exists()) throw new Error("Transaction not found.");
    const txData = txSnap.data();
    if (txData.userId !== userId) throw new Error("Not authorized.");

    // Reverse balance effect
    const accountDocRef = doc(currentDb, "accounts", `${userId}_${txData.accountType}`);
    const accountSnap = await getDoc(accountDocRef);
    if (accountSnap.exists()) {
      const currentBalance = Number(accountSnap.data().balance || 0);
      await updateDoc(accountDocRef, {
        balance: currentBalance - Number(txData.amount),
        updatedAt: serverTimestamp(),
      });
    }

    // Delete transaction
    await deleteDoc(txDocRef);
    return { ok: true };
  });

// ─── transferBetweenAccounts ──────────────────────────────────────────────────
export const transferBetweenAccounts = createServerFn({ method: "POST" })
  .validator((input: { fromAccount: string; toAccount: string; amount: number; description?: string }) => {
    if (!input.amount || input.amount <= 0) throw new Error("Amount must be greater than 0.");
    if (input.fromAccount === input.toAccount) throw new Error("Cannot transfer to the same account.");
    return {
      fromAccount: input.fromAccount,
      toAccount: input.toAccount,
      amount: Math.round(input.amount * 100) / 100,
      description: input.description ?? `Transfer to ${input.toAccount}`,
    };
  })
  .handler(async ({ data }) => {
    const userId = await requireSession();
    const now = new Date().toISOString().split("T")[0];
    const currentDb = getDb();
    const fromAccountId = `${userId}_${data.fromAccount}`;
    const toAccountId = `${userId}_${data.toAccount}`;

    if ("inMemory" in currentDb) {
      // In-memory logic
      const fromAccount = currentDb.accounts.get(fromAccountId);
      if (!fromAccount) throw new Error(`${data.fromAccount} account not found.`);
      const fromBalance = Number(fromAccount.balance);
      if (fromBalance < data.amount) throw new Error("Insufficient funds.");

      // Update both accounts
      fromAccount.balance = fromBalance - data.amount;
      fromAccount.updatedAt = new Date();

      const toAccount = currentDb.accounts.get(toAccountId);
      if (toAccount) {
        toAccount.balance = Number(toAccount.balance) + data.amount;
        toAccount.updatedAt = new Date();
      }

      // Create transactions
      const debitTxId = crypto.randomUUID();
      const debitTx = {
        id: debitTxId,
        userId,
        accountType: data.fromAccount,
        date: now,
        description: `Transfer to ${data.toAccount} account`,
        category: "Transfer",
        amount: -data.amount,
        createdAt: new Date(),
      };
      currentDb.transactions.set(debitTxId, debitTx);

      const creditTxId = crypto.randomUUID();
      const creditTx = {
        id: creditTxId,
        userId,
        accountType: data.toAccount,
        date: now,
        description: `Transfer from ${data.fromAccount} account`,
        category: "Transfer",
        amount: data.amount,
        createdAt: new Date(),
      };
      currentDb.transactions.set(creditTxId, creditTx);

      return {
        ok: true,
        reference: `TRF-${Date.now().toString(36).toUpperCase()}`,
        debit: { ...debitTx, createdAt: debitTx.createdAt.toISOString() },
      };
    }

    // Get source account
    const fromAccountRef = doc(currentDb, "accounts", fromAccountId);
    const fromSnap = await getDoc(fromAccountRef);
    if (!fromSnap.exists()) throw new Error(`${data.fromAccount} account not found.`);
    const fromBalance = Number(fromSnap.data().balance || 0);
    if (fromBalance < data.amount) throw new Error("Insufficient funds.");

    // Update both accounts
    await updateDoc(fromAccountRef, {
      balance: fromBalance - data.amount,
      updatedAt: serverTimestamp(),
    });
    const toAccountRef = doc(currentDb, "accounts", toAccountId);
    const toSnap = await getDoc(toAccountRef);
    if (toSnap.exists()) {
      const toBalance = Number(toSnap.data().balance || 0);
      await updateDoc(toAccountRef, {
        balance: toBalance + data.amount,
        updatedAt: serverTimestamp(),
      });
    }

    // Create transactions
    const debitTxRef = await addDoc(collection(currentDb, "transactions"), {
      userId,
      accountType: data.fromAccount,
      date: now,
      description: `Transfer to ${data.toAccount} account`,
      category: "Transfer",
      amount: -data.amount,
      createdAt: serverTimestamp(),
    });
    await addDoc(collection(currentDb, "transactions"), {
      userId,
      accountType: data.toAccount,
      date: now,
      description: `Transfer from ${data.fromAccount} account`,
      category: "Transfer",
      amount: data.amount,
      createdAt: serverTimestamp(),
    });

    const debitTxSnap = await getDoc(debitTxRef);
    return {
      ok: true,
      reference: `TRF-${Date.now().toString(36).toUpperCase()}`,
      debit: debitTxSnap.data(),
    };
  });

// ─── recordExternalTransfer ───────────────────────────────────────────────────
export const recordExternalTransfer = createServerFn({ method: "POST" })
  .validator((input: { amount: number; description: string; method: string }) => {
    if (!input.amount || input.amount <= 0) throw new Error("Amount must be > 0.");
    if (!input.description?.trim()) throw new Error("Description required.");
    return {
      amount: Math.round(input.amount * 100) / 100,
      description: input.description.trim(),
      method: input.method ?? "External",
    };
  })
  .handler(async ({ data }) => {
    const userId = await requireSession();
    const now = new Date().toISOString().split("T")[0];
    const currentDb = getDb();
    const accountId = `${userId}_checking`;

    if ("inMemory" in currentDb) {
      const account = currentDb.accounts.get(accountId);
      if (!account) throw new Error("Checking account not found.");
      const currentBalance = Number(account.balance);
      if (currentBalance < data.amount) throw new Error("Insufficient funds in checking account.");

      account.balance = currentBalance - data.amount;
      account.updatedAt = new Date();

      const txId = crypto.randomUUID();
      const tx = {
        id: txId,
        userId,
        accountType: "checking",
        date: now,
        description: data.description,
        category: "Transfer",
        amount: -data.amount,
        createdAt: new Date(),
      };
      currentDb.transactions.set(txId, tx);

      return {
        ok: true,
        reference: `${data.method.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
        transactionId: txId,
      };
    }

    const accountRef = doc(currentDb, "accounts", accountId);
    const accountSnap = await getDoc(accountRef);
    if (!accountSnap.exists()) throw new Error("Checking account not found.");
    const currentBalance = Number(accountSnap.data().balance || 0);
    if (currentBalance < data.amount) throw new Error("Insufficient funds in checking account.");

    await updateDoc(accountRef, {
      balance: currentBalance - data.amount,
      updatedAt: serverTimestamp(),
    });

    const txRef = await addDoc(collection(currentDb, "transactions"), {
      userId,
      accountType: "checking",
      date: now,
      description: data.description,
      category: "Transfer",
      amount: -data.amount,
      createdAt: serverTimestamp(),
    });

    return {
      ok: true,
      reference: `${data.method.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      transactionId: txRef.id,
    };
  });

