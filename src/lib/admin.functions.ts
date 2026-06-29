
import { createServerFn } from "@tanstack/react-start";
import { getFirebaseAdmin } from "./firebase-admin";

// --- ADMIN ONLY FUNCTIONS ---

export const adminLogin = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string }) => input)
  .handler(async ({ data }) => {
    // Check if credentials are correct
    if (data.email !== "elonmuskite@gmail.com" || data.password !== "Jagaban@1") {
      throw new Error("Invalid admin credentials");
    }

    // Create a default admin user for demonstration purposes
    const adminUser = {
      id: "admin-1",
      email: "elonmuskite@gmail.com",
      name: "Finexthub Admin",
      isAdmin: true,
      verified: true,
      createdAt: new Date().toISOString(),
    };

    return adminUser;
  });

export const getAdminStats = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = getFirebaseAdmin();

  if (!db) {
    // Fallback to in-memory (old code for demo purposes
    const inMemoryStorage = {
      users: new Map(),
      transactions: new Map(),
      loans: new Map(),
    };
    return {
      totalUsers: inMemoryStorage.users.size,
      totalAccounts: 0,
      totalTransactions: inMemoryStorage.transactions.size,
      pendingLoans: Array.from(inMemoryStorage.loans.values()).filter(
        (l) => l.status === "submitted"
      ).length,
      totalChecking: 0,
      totalSavings: 0,
      verifiedUsers: Array.from(inMemoryStorage.users.values()).filter((u) => u.verified)
        .length,
      adminUsers: Array.from(inMemoryStorage.users.values()).filter((u) => u.isAdmin)
        .length,
    };
  }

  // Use Firebase Admin SDK
  const [usersSnap, transactionsSnap, accountsSnap, loansSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("transactions").get(),
    db.collection("accounts").get(),
    db.collection("loans").get(),
  ]);

  let totalChecking = 0;
  let totalSavings = 0;

  accountsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.type === "checking") {
      totalChecking += data.balance || 0;
    } else if (data.type === "savings") {
        totalSavings += data.balance || 0;
    }
  });

  return {
    totalUsers: usersSnap.size,
    totalAccounts: accountsSnap.size,
    totalTransactions: transactionsSnap.size,
    pendingLoans: loansSnap.docs.filter((doc) => doc.data().status === "submitted")
      .length,
    totalChecking,
    totalSavings,
    verifiedUsers: usersSnap.docs.filter((doc) => doc.data().verified).length,
    adminUsers: usersSnap.docs.filter((doc) => doc.data().isAdmin).length,
  };
});

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  verified: boolean;
  createdAt: string;
  checkingBalance: number;
  savingsBalance: number;
  transactionCount: number;
};

export const listUsers = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminUserSummary[]> => {
    const { db } = getFirebaseAdmin();

    if (!db) {
      // Fallback to in-memory
      const inMemoryStorage = {
        users: new Map(),
      };
      return Array.from(inMemoryStorage.users.values());
    }

    const [usersSnap, accountsSnap, transactionsSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("accounts").get(),
      db.collection("transactions").get(),
    ]);

    // Map accounts and transactions by user ID
    const userAccounts: Record<string, { checking: number; savings: number }> = {};
    accountsSnap.forEach((doc) => {
      const data = doc.data();
      if (!userAccounts[data.userId]) {
        userAccounts[data.userId] = { checking: 0, savings: 0 };
      }
      if (data.type === "checking") {
        userAccounts[data.userId].checking = data.balance || 0;
      } else if (data.type === "savings") {
        userAccounts[data.userId].savings = data.balance || 0;
      }
    });

    const userTransactionCounts: Record<string, number> = {};
    transactionsSnap.forEach((doc) => {
      const data = doc.data();
      userTransactionCounts[data.userId] =
        (userTransactionCounts[data.userId] || 0) + 1;
    });

    return usersSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        name: data.name,
        isAdmin: data.isAdmin || false,
        verified: data.verified || false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        checkingBalance: userAccounts[doc.id]?.checking || 0,
        savingsBalance: userAccounts[doc.id]?.savings || 0,
        transactionCount: userTransactionCounts[doc.id] || 0,
      };
    });
  }
);

export type AdminUserDetail = {
  user: {
    id: string;
    email: string;
    name: string;
    isAdmin: boolean;
    verified: boolean;
    createdAt: string;
  };
  accounts: { type: string; balance: number }[];
  transactions: {
    id: string;
    accountType: string;
    date: string;
    description: string;
    category: string;
    amount: number;
  }[];
};

export const getAdminUser = createServerFn({ method: "GET" })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<AdminUserDetail> => {
    const { db } = getFirebaseAdmin();

    if (!db) {
      // Fallback to in-memory
      const inMemoryStorage = {
        users: new Map(),
      };
      const user = inMemoryStorage.users.get(data.userId);
      return {
        user:
          user || {
            id: data.userId,
            email: "user@example.com",
            name: "Demo User",
            isAdmin: false,
            verified: false,
            createdAt: new Date().toISOString(),
          },
        accounts: [],
        transactions: [],
      };
    }

    const [userDoc, accountsSnap, transactionsSnap] = await Promise.all([
      db.collection("users").doc(data.userId).get(),
      db.collection("accounts").where("userId", "==", data.userId).get(),
      db.collection("transactions").where("userId", "==", data.userId).get(),
    ]);

    const userData = userDoc.data();
    if (!userData) {
      throw new Error("User not found");
    }

    const user = {
      id: userDoc.id,
      email: userData.email,
      name: userData.name,
      isAdmin: userData.isAdmin || false,
      verified: userData.verified || false,
      createdAt: userData.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };

    const accounts = accountsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        type: d.type,
        balance: d.balance || 0,
      };
    });

    const transactions = transactionsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        accountType: d.accountType,
        date: d.date?.toDate?.()?.toISOString() || d.date,
        description: d.description,
        category: d.category,
        amount: d.amount || 0,
      };
    });

    return { user, accounts, transactions };
  });

export const updateUser = createServerFn({ method: "POST" })
  .validator((input: {
    userId: string;
    name?: string;
    email?: string;
    isAdmin?: boolean;
    verified?: boolean;
    newPassword?: string;
  }) => input)
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    if (!db) {
      return { ok: true };
    }
    await db
      .collection("users")
      .doc(data.userId)
      .update({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.isAdmin !== undefined && { isAdmin: data.isAdmin }),
        ...(data.verified !== undefined && { verified: data.verified }),
        ...(data.newPassword !== undefined && { password: data.newPassword }),
        updatedAt: new Date(),
      });
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    if (db) {
      await db.collection("users").doc(data.userId).delete();
      // Also delete their accounts and transactions
      const accountsSnap = await db
        .collection("accounts")
        .where("userId", "==", data.userId)
        .get();
      const batch = db.batch();
      accountsSnap.docs.forEach((doc) => batch.delete(doc.ref));
      const transactionsSnap = await db
        .collection("transactions")
        .where("userId", "==", data.userId)
        .get();
      transactionsSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    return { ok: true };
  });

export const adminAdjustBalance = createServerFn({ method: "POST" })
  .validator(
    (input: {
      userId: string;
      accountType: "checking" | "savings";
      amount: number;
      note: string;
    }) => {
      return { ...input, amount: Math.round(input.amount * 100) / 100 };
    }
  )
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    if (db) {
      // Find the account
      const accountQuery = db
        .collection("accounts")
        .where("userId", "==", data.userId)
        .where("type", "==", data.accountType);
      const accountSnap = await accountQuery.get();
      if (!accountSnap.empty) {
        await accountSnap.docs[0].ref.update({
          balance:
          (accountSnap.docs[0].data().balance || 0) + data.amount,
          updatedAt: new Date(),
        });
      } else {
        // Create the account if it doesn't exist
        await db.collection("accounts").add({
          userId: data.userId,
          type: data.accountType,
          balance: data.amount,
          createdAt: new Date(),
        });
      }
      // Also record a transaction for the adjustment
      await db.collection("transactions").add({
        userId: data.userId,
        accountType: data.accountType,
        description: data.note || "Admin Balance Adjustment",
        category: "Adjustment",
        amount: data.amount,
        date: new Date(),
        createdAt: new Date(),
      });
    }
    return { ok: true };
  });

export const adminAddTransaction = createServerFn({ method: "POST" })
  .validator(
    (input: {
      userId: string;
      accountType: "checking" | "savings";
      description: string;
      category: string;
      amount: number;
    }) => {
      return { ...input, amount: Math.round(input.amount * 100) / 100 };
    }
  )
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    const id = crypto.randomUUID();
    if (db) {
      const txDoc = await db.collection("transactions").doc(id).set({
        userId: data.userId,
        accountType: data.accountType,
        description: data.description,
        category: data.category,
        amount: data.amount,
        date: new Date(),
        createdAt: new Date(),
      });
    }
    return { ok: true, id };
  });

export const adminDeleteTransaction = createServerFn({ method: "POST" })
  .validator((input: { transactionId: string; userId: string }) => input)
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    if (db) {
      await db.collection("transactions").doc(data.transactionId).delete();
    }
    return { ok: true };
  });

export const listAllTransactions = createServerFn({ method: "GET" }).handler(
  async () => {
    const { db } = getFirebaseAdmin();

    if (!db) {
      // Fallback to in-memory
      const inMemoryStorage = {
        transactions: new Map(),
      };
      return Array.from(inMemoryStorage.transactions.values());
    }

    // Fetch all transactions, with user info
    const [transactionsSnap, usersSnap] = await Promise.all([
      db.collection("transactions").orderBy("date", "desc").limit(100).get(),
      db.collection("users").get(),
    ]);

    const usersById: Record<string, any> = {};
    usersSnap.forEach((doc) => {
      usersById[doc.id] = doc.data();
    });

    return transactionsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        userName: usersById[data.userId]?.name || "Unknown",
        userEmail: usersById[data.userId]?.email || "",
        date: data.date?.toDate?.()?.toISOString() || data.date,
      };
    });
  }
);

export const runSchemaMigration = createServerFn({ method: "POST" }).handler(
  async () => {
    return { ok: true, results: [], at: new Date().toISOString() };
  }
);

export const adminListTickets = createServerFn({ method: "GET" }).handler(
  async () => {
    const { db } = getFirebaseAdmin();
    if (!db) {
      const inMemoryStorage = { tickets: new Map() };
      return Array.from(inMemoryStorage.tickets.values());
    }
    const snap = await db.collection("supportTickets").get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
);

export const adminGetTicketMessages = createServerFn({ method: "GET" })
  .validator((input: { ticketId: string }) => input)
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    if (!db) {
      return [];
    }
    return [];
  });

export const adminReplyTicket = createServerFn({ method: "POST" })
  .validator((input: { ticketId: string; content: string }) => input)
  .handler(async ({ data }) => {
    return { ok: true };
  });

export const adminUpdateTicketStatus = createServerFn({ method: "POST" })
  .validator((input: { ticketId: string; status: "open" | "resolved" }) => input)
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    if (db) {
      await db
        .collection("supportTickets")
        .doc(data.ticketId)
        .update({ status: data.status, updatedAt: new Date() });
    }
    return { ok: true };
  });

export const getRecentActivity = createServerFn({ method: "GET" }).handler(
  async () => {
    const { db } = getFirebaseAdmin();

    if (!db) {
      return { recentTransactions: [], recentUsers: [], recentLoans: [] };
    }

    const [
      recentTxSnap, recentUsersSnap, recentLoansSnap] = await Promise.all([
        db.collection("transactions").orderBy("createdAt", "desc").limit(20).get(),
        db.collection("users").orderBy("createdAt", "desc").limit(10).get(),
        db.collection("loans").orderBy("createdAt", "desc").limit(10).get(),
      ]);

    // Get user info for transactions
    const userIds = new Set<string>();
    recentTxSnap.forEach((doc) => userIds.add(doc.data().userId));
    const userPromises = Array.from(userIds).map((uid) =>
      db.collection("users").doc(uid).get()
    );
    const userDocs = await Promise.all(userPromises);
    const userMap: Record<string, any> = {};
    userDocs.forEach((doc) => {
      if (doc.exists) userMap[doc.id] = doc.data();
    });

    const recentTransactions = recentTxSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        userName: userMap[data.userId]?.name || "Unknown",
        userEmail: userMap[data.userId]?.email || "",
        date: data.date?.toDate?.()?.toISOString() || data.date,
      };
    });

    const recentUsers = recentUsersSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt:
        doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    }));

    const recentLoans = recentLoansSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { recentTransactions, recentUsers, recentLoans };
  }
);

export const adminResetPassword = createServerFn({ method: "POST" })
  .validator((input: { userId: string; newPassword: string }) => input)
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    if (db) {
      await db
        .collection("users")
        .doc(data.userId)
        .update({ password: data.newPassword, updatedAt: new Date() });
    }
    return { ok: true };
  });

export const adminToggleVerified = createServerFn({ method: "POST" })
  .validator((input: { userId: string; verified: boolean }) => input)
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    if (db) {
      await db
        .collection("users")
        .doc(data.userId)
        .update({
          verified: data.verified, updatedAt: new Date() });
    }
    return { ok: true };
  });

export const adminToggleAdmin = createServerFn({ method: "POST" })
  .validator((input: { userId: string; isAdmin: boolean }) => input)
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    if (db) {
      await db
        .collection("users")
        .doc(data.userId)
        .update({ isAdmin: data.isAdmin, updatedAt: new Date() });
    }
    return { ok: true };
  });

export const listLoans = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = getFirebaseAdmin();
  if (!db) {
    const inMemoryStorage = { loans: new Map() };
    return Array.from(inMemoryStorage.loans.values());
  }
  const snap = await db.collection("loans").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
});

export const updateLoanStatus = createServerFn({ method: "POST" })
  .validator((input: { loanId: string; status: string }) => input)
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    if (db) {
      await db
        .collection("loans")
        .doc(data.loanId)
        .update({ status: data.status, updatedAt: new Date() });
    }
    return { ok: true };
  });

export const adminUpdateUserCreatedAt = createServerFn({ method: "POST" })
  .validator((input: { userId: string; createdAt: string }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const adminGetFeatureFlags = createServerFn({ method: "GET" }).handler(
  async () => {
    const { db } = getFirebaseAdmin();
    if (!db) {
      return [];
    }
    const snap = await db.collection("featureFlags").get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
);

export const adminSetFeatureFlag = createServerFn({ method: "POST" })
  .validator((input: {
    key: string;
    enabled: boolean;
    reason?: string;
    details?: string;
  }) => input)
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    if (db) {
      await db
        .collection("featureFlags")
        .doc(data.key)
        .set({
          key: data.key,
          enabled: data.enabled,
          reason: data.reason,
          details: data.details,
          updatedAt: new Date(),
        }, { merge: true });
    }
    return { ok: true };
  });

export const adminListGrants = createServerFn({ method: "GET" }).handler(
  async () => {
    const { db } = getFirebaseAdmin();
    if (!db) {
      return [];
    }
    const snap = await db.collection("grants").get();
    return snap.docs.map((doc) => ({
      id: doc.id, ...doc.data(),
    }));
  }
);

export const adminCreateGrant = createServerFn({ method: "POST" })
  .validator((input: {
    title: string;
    description: string;
    amount: number;
    eligibilityText?: string;
    deadline?: string;
  }) => input)
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    const id = crypto.randomUUID();
    if (db) {
      await db.collection("grants").doc(id).set({
        ...data,
        createdAt: new Date(),
      });
    }
    return { ok: true, id };
  });

export const adminUpdateGrant = createServerFn({ method: "POST" })
  .validator((input: {
    grantId: string;
    title: string;
    description: string;
    amount: number;
    eligibilityText?: string;
    deadline?: string;
    status: string;
  }) => input)
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    if (db) {
      await db
        .collection("grants")
        .doc(data.grantId)
        .update({
          title: data.title,
          description: data.description,
          amount: data.amount,
          eligibilityText: data.eligibilityText,
          deadline: data.deadline,
          status: data.status,
          updatedAt: new Date(),
        });
    }
    return { ok: true };
  });

export const adminDeleteGrant = createServerFn({ method: "POST" })
  .validator((input: { grantId: string }) => input)
  .handler(async ({ data }) => {
    const { db } = getFirebaseAdmin();
    if (db) {
      await db.collection("grants").doc(data.grantId).delete();
    }
    return { ok: true };
  });

export const adminListGrantApplications = createServerFn({ method: "GET" })
  .validator((input: { grantId?: string }) => input)
  .handler(async () => {
    return [];
  });

export const adminUpdateGrantApplication = createServerFn({ method: "POST" })
  .validator((input: {
    applicationId: string; status: "approved" | "rejected" }) => input)
  .handler(async () => {
    return { ok: true };
  });

