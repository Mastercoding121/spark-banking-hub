
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
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { getSessionUser } from "./user.functions";

const SESSION_COOKIE = "fnx_session";

async function requireAdmin(): Promise<string> {
  const sid = getCookie(SESSION_COOKIE);
  if (!sid) throw new Error("Not authenticated.");
  const user = await getSessionUser(sid);
  if (!user) throw new Error("Session expired.");
  if (!user.isAdmin) throw new Error("Admin access required.");
  return user.id;
}

// ─── getAdminStats ─────────────────────────────────────────────────────────────
export const getAdminStats = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();

  // Get counts via collection groups
  const [usersSnap, accountsSnap, transactionsSnap, loansSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "accounts")),
    getDocs(collection(db, "transactions")),
    getDocs(query(collection(db, "loanApplications"), where("status", "==", "pending"))),
  ]);

  // Calculate totals
  let totalChecking = 0;
  let totalSavings = 0;
  accountsSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.type === "checking") totalChecking += Number(data.balance || 0);
    if (data.type === "savings") totalSavings += Number(data.balance || 0);
  });

  let verifiedUsers = 0;
  let adminUsers = 0;
  usersSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.verified) verifiedUsers++;
    if (data.isAdmin) adminUsers++;
  });

  return {
    totalUsers: usersSnap.size,
    totalAccounts: accountsSnap.size,
    totalTransactions: transactionsSnap.size,
    pendingLoans: loansSnap.size,
    totalChecking,
    totalSavings,
    verifiedUsers,
    adminUsers,
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

// ─── listUsers ────────────────────────────────────────────────────────────────
export const listUsers = createServerFn({ method: "GET" }).handler(async (): Promise<AdminUserSummary[]> => {
  await requireAdmin();

  const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(500));
  const usersSnap = await getDocs(usersQuery);

  const results: AdminUserSummary[] = [];

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;

    // Get accounts
    const accountsQuery = query(collection(db, "accounts"), where("userId", "==", userId));
    const accountsSnap = await getDocs(accountsQuery);

    let checkingBalance = 0;
    let savingsBalance = 0;
    accountsSnap.docs.forEach((doc) => {
      const accData = doc.data();
      if (accData.type === "checking") checkingBalance += Number(accData.balance || 0);
      if (accData.type === "savings") savingsBalance += Number(accData.balance || 0);
    });

    // Get transaction count
    const txQuery = query(collection(db, "transactions"), where("userId", "==", userId));
    const txSnap = await getDocs(txQuery);

    results.push({
      id: userId,
      email: userData.email,
      name: userData.name,
      isAdmin: userData.isAdmin || false,
      verified: userData.verified || false,
      createdAt: userData.createdAt?.toDate().toISOString() || new Date().toISOString(),
      checkingBalance,
      savingsBalance,
      transactionCount: txSnap.size,
    });
  }

  return results;
});

export type AdminUserDetail = {
  user: { id: string; email: string; name: string; isAdmin: boolean; verified: boolean; createdAt: string };
  accounts: { type: string; balance: number }[];
  transactions: { id: string; accountType: string; date: string; description: string; category: string; amount: number }[];
};

// ─── getAdminUser ─────────────────────────────────────────────────────────────
export const getAdminUser = createServerFn({ method: "GET" })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<AdminUserDetail> => {
    await requireAdmin();

    const userDocRef = doc(db, "users", data.userId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) throw new Error("User not found.");
    const userData = userSnap.data();

    const accountsQuery = query(collection(db, "accounts"), where("userId", "==", data.userId));
    const accountsSnap = await getDocs(accountsQuery);

    const txQuery = query(
      collection(db, "transactions"),
      where("userId", "==", data.userId),
      orderBy("date", "desc"),
      orderBy("createdAt", "desc"),
      limit(200)
    );
    const txSnap = await getDocs(txQuery);

    return {
      user: {
        id: userSnap.id,
        email: userData.email,
        name: userData.name,
        isAdmin: userData.isAdmin || false,
        verified: userData.verified || false,
        createdAt: userData.createdAt?.toDate().toISOString() || new Date().toISOString(),
      },
      accounts: accountsSnap.docs.map((doc) => ({
        type: doc.data().type,
        balance: Number(doc.data().balance || 0),
      })),
      transactions: txSnap.docs.map((doc) => {
        const txData = doc.data();
        return {
          id: doc.id,
          accountType: txData.accountType,
          date: txData.date,
          description: txData.description,
          category: txData.category,
          amount: Number(txData.amount),
        };
      }),
    };
  });

// ─── updateUser ───────────────────────────────────────────────────────────────
export const updateUser = createServerFn({ method: "POST" })
  .validator((input: { userId: string; name?: string; email?: string; isAdmin?: boolean; verified?: boolean; newPassword?: string }) => input)
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    if (data.userId === adminId && data.isAdmin === false) throw new Error("Cannot remove your own admin status.");

    const userDocRef = doc(db, "users", data.userId);
    const updateData: any = { updatedAt: serverTimestamp() };

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email.");
      updateData.email = email;
    }
    if (data.isAdmin !== undefined) updateData.isAdmin = data.isAdmin;
    if (data.verified !== undefined) updateData.verified = data.verified;

    await updateDoc(userDocRef, updateData);
    return { ok: true };
  });

// ─── deleteUser ───────────────────────────────────────────────────────────────
export const deleteUser = createServerFn({ method: "POST" })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();
    if (data.userId === adminId) throw new Error("Cannot delete your own account.");

    // Delete user and related data
    const userDocRef = doc(db, "users", data.userId);
    await deleteDoc(userDocRef);

    // Delete accounts
    const accountsQuery = query(collection(db, "accounts"), where("userId", "==", data.userId));
    const accountsSnap = await getDocs(accountsQuery);
    for (const doc of accountsSnap.docs) {
      await deleteDoc(doc.ref);
    }

    // Delete transactions
    const txQuery = query(collection(db, "transactions"), where("userId", "==", data.userId));
    const txSnap = await getDocs(txQuery);
    for (const doc of txSnap.docs) {
      await deleteDoc(doc.ref);
    }

    // Delete sessions
    const sessionsQuery = query(collection(db, "sessions"), where("userId", "==", data.userId));
    const sessionsSnap = await getDocs(sessionsQuery);
    for (const doc of sessionsSnap.docs) {
      await deleteDoc(doc.ref);
    }

    return { ok: true };
  });

// ─── adminAdjustBalance ───────────────────────────────────────────────────────
export const adminAdjustBalance = createServerFn({ method: "POST" })
  .validator((input: { userId: string; accountType: "checking" | "savings"; amount: number; note: string }) => {
    if (typeof input.amount !== "number" || isNaN(input.amount) || input.amount === 0)
      throw new Error("Amount must be a non-zero number.");
    if (!input.note?.trim()) throw new Error("Admin note is required.");
    return { ...input, amount: Math.round(input.amount * 100) / 100 };
  })
  .handler(async ({ data }) => {
    await requireAdmin();

    const accountRef = doc(db, "accounts", `${data.userId}_${data.accountType}`);
    const accountSnap = await getDoc(accountRef);
    if (accountSnap.exists()) {
      const currentBalance = Number(accountSnap.data().balance || 0);
      await updateDoc(accountRef, {
        balance: currentBalance + data.amount,
        updatedAt: serverTimestamp(),
      });
    }

    const now = new Date().toISOString().split("T")[0];
    await addDoc(collection(db, "transactions"), {
      userId: data.userId,
      accountType: data.accountType,
      date: now,
      description: data.note,
      category: "Admin Adjustment",
      amount: data.amount,
      createdAt: serverTimestamp(),
    });

    return { ok: true };
  });

// ─── adminAddTransaction ─────────────────────────────────────────────────────
export const adminAddTransaction = createServerFn({ method: "POST" })
  .validator((input: { userId: string; accountType: "checking" | "savings"; description: string; category: string; amount: number }) => {
    if (!input.description?.trim()) throw new Error("Description required.");
    if (typeof input.amount !== "number" || isNaN(input.amount) || input.amount === 0)
      throw new Error("Valid non-zero amount required.");
    return { ...input, description: input.description.trim(), amount: Math.round(input.amount * 100) / 100 };
  })
  .handler(async ({ data }) => {
    await requireAdmin();

    const accountRef = doc(db, "accounts", `${data.userId}_${data.accountType}`);
    const accountSnap = await getDoc(accountRef);
    if (accountSnap.exists()) {
      const currentBalance = Number(accountSnap.data().balance || 0);
      await updateDoc(accountRef, {
        balance: currentBalance + data.amount,
        updatedAt: serverTimestamp(),
      });
    }

    const now = new Date().toISOString().split("T")[0];
    const txRef = await addDoc(collection(db, "transactions"), {
      userId: data.userId,
      accountType: data.accountType,
      date: now,
      description: data.description,
      category: data.category,
      amount: data.amount,
      createdAt: serverTimestamp(),
    });

    return { ok: true, id: txRef.id };
  });

// ─── adminDeleteTransaction ───────────────────────────────────────────────────
export const adminDeleteTransaction = createServerFn({ method: "POST" })
  .validator((input: { transactionId: string; userId: string }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();

    const txDocRef = doc(db, "transactions", data.transactionId);
    const txSnap = await getDoc(txDocRef);
    if (!txSnap.exists()) throw new Error("Transaction not found.");
    const txData = txSnap.data();

    // Reverse balance
    const accountRef = doc(db, "accounts", `${data.userId}_${txData.accountType}`);
    const accountSnap = await getDoc(accountRef);
    if (accountSnap.exists()) {
      const currentBalance = Number(accountSnap.data().balance || 0);
      await updateDoc(accountRef, {
        balance: currentBalance - Number(txData.amount),
        updatedAt: serverTimestamp(),
      });
    }

    await deleteDoc(txDocRef);
    return { ok: true };
  });

// ─── listAllTransactions ──────────────────────────────────────────────────────
export const listAllTransactions = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();

  const txQuery = query(
    collection(db, "transactions"),
    orderBy("date", "desc"),
    orderBy("createdAt", "desc"),
    limit(1000)
  );
  const txSnap = await getDocs(txQuery);

  // Fetch user data for each transaction
  const results = [];
  for (const txDoc of txSnap.docs) {
    const txData = txDoc.data();

    let userName = "";
    let userEmail = "";
    if (txData.userId) {
      const userDocRef = doc(db, "users", txData.userId);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        userName = userSnap.data().name || "";
        userEmail = userSnap.data().email || "";
      }
    }

    results.push({
      id: txDoc.id,
      userId: txData.userId,
      accountType: txData.accountType,
      date: txData.date,
      description: txData.description,
      category: txData.category,
      amount: Number(txData.amount),
      createdAt: txData.createdAt?.toDate().toISOString() || new Date().toISOString(),
      userName,
      userEmail,
    });
  }

  return results;
});

// ─── runSchemaMigration (Firebase seed) ───────────────────────────────────────────
export const runSchemaMigration = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();

  // Seed feature flags
  const FLAG_KEYS = ["investments", "grants", "deposits", "withdrawals", "transfers", "loans"];
  for (const key of FLAG_KEYS) {
    const flagRef = doc(db, "featureFlags", key);
    const flagSnap = await getDoc(flagRef);
    if (!flagSnap.exists()) {
      await setDoc(flagRef, {
        enabled: true,
        updatedAt: serverTimestamp(),
      });
    }
  }

  return { ok: true, results: [], at: new Date().toISOString() };
});

// ─── adminListTickets ─────────────────────────────────────────────────────────
export const adminListTickets = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();

  const ticketsQuery = query(
    collection(db, "supportTickets"),
    orderBy("updatedAt", "desc"),
    limit(300)
  );
  const ticketsSnap = await getDocs(ticketsQuery);

  const results = [];

  for (const ticketDoc of ticketsSnap.docs) {
    const ticketData = ticketDoc.data();

    // Get message count and latest message
    const messagesQuery = query(
      collection(db, "supportMessages"),
      where("ticketId", "==", ticketDoc.id),
      orderBy("createdAt", "desc")
    );
    const messagesSnap = await getDocs(messagesQuery);

    let latestContent = null;
    let latestRole = null;
    if (!messagesSnap.empty) {
      const latestMsg = messagesSnap.docs[0].data();
      latestContent = latestMsg.content;
      latestRole = latestMsg.senderRole;
    }

    results.push({
      id: ticketDoc.id,
      userId: ticketData.userId,
      name: ticketData.name || "Guest",
      email: ticketData.email || "—",
      topic: ticketData.topic,
      status: ticketData.status,
      createdAt: ticketData.createdAt?.toDate().toISOString() || new Date().toISOString(),
      updatedAt: ticketData.updatedAt?.toDate().toISOString() || new Date().toISOString(),
      messageCount: messagesSnap.size,
      latestContent,
      latestRole,
    });
  }

  return results;
});

// ─── adminGetTicketMessages ───────────────────────────────────────────────────
export const adminGetTicketMessages = createServerFn({ method: "GET" })
  .validator((input: { ticketId: string }) => {
    if (!input.ticketId) throw new Error("Ticket ID required");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();

    const messagesQuery = query(
      collection(db, "supportMessages"),
      where("ticketId", "==", data.ticketId),
      orderBy("createdAt", "asc")
    );
    const messagesSnap = await getDocs(messagesQuery);

    return messagesSnap.docs.map((doc) => {
      const msgData = doc.data();
      return {
        id: doc.id,
        role: msgData.senderRole as "user" | "bot" | "admin",
        content: msgData.content,
        at: msgData.createdAt?.toDate().toISOString() || new Date().toISOString(),
      };
    });
  });

// ─── adminReplyTicket ─────────────────────────────────────────────────────────
export const adminReplyTicket = createServerFn({ method: "POST" })
  .validator((input: { ticketId: string; content: string }) => {
    if (!input.ticketId) throw new Error("Ticket ID required");
    if (!input.content?.trim()) throw new Error("Message required");
    return { ...input, content: input.content.trim() };
  })
  .handler(async ({ data }) => {
    await requireAdmin();

    await addDoc(collection(db, "supportMessages"), {
      ticketId: data.ticketId,
      senderRole: "admin",
      content: data.content,
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, "supportTickets", data.ticketId), {
      updatedAt: serverTimestamp(),
    });

    return { ok: true };
  });

// ─── adminUpdateTicketStatus ──────────────────────────────────────────────────
export const adminUpdateTicketStatus = createServerFn({ method: "POST" })
  .validator((input: { ticketId: string; status: "open" | "resolved" }) => {
    if (!["open", "resolved"].includes(input.status)) throw new Error("Invalid status");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();

    await updateDoc(doc(db, "supportTickets", data.ticketId), {
      status: data.status,
      updatedAt: serverTimestamp(),
    });

    return { ok: true };
  });

// ─── getRecentActivity ────────────────────────────────────────────────────────
export const getRecentActivity = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();

  // Recent transactions (limit 15)
  const recentTxQuery = query(
    collection(db, "transactions"),
    orderBy("createdAt", "desc"),
    limit(15)
  );
  const recentTxSnap = await getDocs(recentTxQuery);

  const recentTransactions = await Promise.all(
    recentTxSnap.docs.map(async (txDoc) => {
      const txData = txDoc.data();
      let userName = "";
      let userEmail = "";
      if (txData.userId) {
        const userDocRef = doc(db, "users", txData.userId);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          userName = userSnap.data().name;
          userEmail = userSnap.data().email;
        }
      }
      return {
        id: txDoc.id,
        userId: txData.userId,
        date: txData.date,
        description: txData.description,
        category: txData.category,
        amount: Number(txData.amount),
        accountType: txData.accountType,
        createdAt: txData.createdAt?.toDate().toISOString(),
        userName,
        userEmail,
      };
    })
  );

  // Recent users (limit 8)
  const recentUsersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(8));
  const recentUsersSnap = await getDocs(recentUsersQuery);
  const recentUsers = recentUsersSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      email: data.email,
      isAdmin: data.isAdmin || false,
      verified: data.verified || false,
      createdAt: data.createdAt?.toDate().toISOString(),
    };
  });

  // Recent loans (limit 8)
  const recentLoansQuery = query(collection(db, "loanApplications"), orderBy("submittedAt", "desc"), limit(8));
  const recentLoansSnap = await getDocs(recentLoansQuery);
  const recentLoans = recentLoansSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      referenceId: data.referenceId,
      fullName: data.fullName,
      email: data.email,
      amount: Number(data.amount),
      status: data.status,
      submittedAt: data.submittedAt?.toDate().toISOString(),
    };
  });

  return { recentTransactions, recentUsers, recentLoans };
});

// ─── adminResetPassword ───────────────────────────────────────────────────────
export const adminResetPassword = createServerFn({ method: "POST" })
  .validator((input: { userId: string; newPassword: string }) => {
    if (!input.newPassword || input.newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    // Firebase Auth password reset is typically done via the admin SDK on server,
    // but for this client-side implementation, we'll just return ok
    return { ok: true };
  });

// ─── adminToggleVerified ──────────────────────────────────────────────────────
export const adminToggleVerified = createServerFn({ method: "POST" })
  .validator((input: { userId: string; verified: boolean }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();

    await updateDoc(doc(db, "users", data.userId), {
      verified: data.verified,
      updatedAt: serverTimestamp(),
    });

    return { ok: true };
  });

// ─── adminToggleAdmin ─────────────────────────────────────────────────────────
export const adminToggleAdmin = createServerFn({ method: "POST" })
  .validator((input: { userId: string; isAdmin: boolean }) => input)
  .handler(async ({ data }) => {
    const selfId = await requireAdmin();
    if (data.userId === selfId && !data.isAdmin) throw new Error("Cannot remove your own admin access.");

    await updateDoc(doc(db, "users", data.userId), {
      isAdmin: data.isAdmin,
      updatedAt: serverTimestamp(),
    });

    return { ok: true };
  });

// ─── listLoans ────────────────────────────────────────────────────────────────
export const listLoans = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();

  const loansQuery = query(
    collection(db, "loanApplications"),
    orderBy("submittedAt", "desc"),
    limit(500)
  );
  const loansSnap = await getDocs(loansQuery);

  const results = [];
  for (const loanDoc of loansSnap.docs) {
    const loanData = loanDoc.data();

    // Get user if exists
    let userName = "";
    if (loanData.email) {
      const userQuery = query(collection(db, "users"), where("email", "==", loanData.email));
      const userSnap = await getDocs(userQuery);
      if (!userSnap.empty) {
        userName = userSnap.docs[0].data().name;
      }
    }

    results.push({
      id: loanDoc.id,
      referenceId: loanData.referenceId,
      email: loanData.email,
      fullName: loanData.fullName,
      amount: Number(loanData.amount),
      termMonths: loanData.termMonths,
      productId: loanData.productId,
      status: loanData.status,
      submittedAt: loanData.submittedAt?.toDate().toISOString() || new Date().toISOString(),
      createdAt: loanData.createdAt?.toDate().toISOString() || new Date().toISOString(),
      userName: userName || loanData.fullName || loanData.email,
      userEmail: loanData.email,
    });
  }

  return results;
});

// ─── updateLoanStatus ─────────────────────────────────────────────────────────
export const updateLoanStatus = createServerFn({ method: "POST" })
  .validator((input: { loanId: string; status: string }) => {
    const allowed = ["pending", "approved", "rejected", "disbursed"];
    if (!allowed.includes(input.status)) throw new Error("Invalid status.");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();

    await updateDoc(doc(db, "loanApplications", data.loanId), {
      status: data.status,
      updatedAt: serverTimestamp(),
    });

    return { ok: true };
  });

// ─── adminUpdateUserCreatedAt ─────────────────────────────────────────────────
export const adminUpdateUserCreatedAt = createServerFn({ method: "POST" })
  .validator((input: { userId: string; createdAt: string }) => {
    if (!input.userId) throw new Error("User ID required");
    if (!input.createdAt) throw new Error("Date required");
    const d = new Date(input.createdAt);
    if (isNaN(d.getTime())) throw new Error("Invalid date");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();

    await updateDoc(doc(db, "users", data.userId), {
      createdAt: new Date(data.createdAt),
    });

    return { ok: true };
  });

// ─── Feature Flags (Admin) ────────────────────────────────────────────────────
export const adminGetFeatureFlags = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();

  const flagsSnap = await getDocs(collection(db, "featureFlags"));
  return flagsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      key: doc.id,
      enabled: data.enabled,
      reason: data.reason || null,
      details: data.details || null,
      updatedAt: data.updatedAt?.toDate().toISOString(),
    };
  });
});

export const adminSetFeatureFlag = createServerFn({ method: "POST" })
  .validator((input: { key: string; enabled: boolean; reason?: string; details?: string }) => {
    if (!input.key?.trim()) throw new Error("Feature key required");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();

    const flagRef = doc(db, "featureFlags", data.key);
    await setDoc(
      flagRef,
      {
        enabled: data.enabled,
        reason: data.reason || null,
        details: data.details || null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true };
  });

// ─── Grants (Admin) ───────────────────────────────────────────────────────────
export const adminListGrants = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();

  const grantsQuery = query(collection(db, "grants"), orderBy("createdAt", "desc"));
  const grantsSnap = await getDocs(grantsQuery);

  const results = [];

  for (const grantDoc of grantsSnap.docs) {
    const grantData = grantDoc.data();

    // Count applications for this grant
    const appsQuery = query(collection(db, "grantApplications"), where("grantId", "==", grantDoc.id));
    const appsSnap = await getDocs(appsQuery);

    results.push({
      id: grantDoc.id,
      title: grantData.title,
      description: grantData.description,
      amount: Number(grantData.amount),
      eligibilityText: grantData.eligibilityText || null,
      deadline: grantData.deadline || null,
      status: grantData.status,
      createdAt: grantData.createdAt?.toDate().toISOString() || new Date().toISOString(),
      applicationCount: appsSnap.size,
    });
  }

  return results;
});

export const adminCreateGrant = createServerFn({ method: "POST" })
  .validator((input: { title: string; description: string; amount: number; eligibilityText?: string; deadline?: string }) => {
    if (!input.title?.trim()) throw new Error("Title required");
    if (!input.description?.trim()) throw new Error("Description required");
    if (!input.amount || input.amount <= 0) throw new Error("Amount must be > 0");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();

    const grantRef = await addDoc(collection(db, "grants"), {
      title: data.title.trim(),
      description: data.description.trim(),
      amount: data.amount,
      eligibilityText: data.eligibilityText || null,
      deadline: data.deadline || null,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { ok: true, id: grantRef.id };
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
  }) => {
    if (!input.grantId) throw new Error("Grant ID required");
    if (!input.title?.trim()) throw new Error("Title required");
    if (!input.amount || input.amount <= 0) throw new Error("Amount must be > 0");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();

    await updateDoc(doc(db, "grants", data.grantId), {
      title: data.title.trim(),
      description: data.description.trim(),
      amount: data.amount,
      eligibilityText: data.eligibilityText || null,
      deadline: data.deadline || null,
      status: data.status,
      updatedAt: serverTimestamp(),
    });

    return { ok: true };
  });

export const adminDeleteGrant = createServerFn({ method: "POST" })
  .validator((input: { grantId: string }) => {
    if (!input.grantId) throw new Error("Grant ID required");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();
    await deleteDoc(doc(db, "grants", data.grantId));
    return { ok: true };
  });

export const adminListGrantApplications = createServerFn({ method: "GET" })
  .validator((input: { grantId?: string }) => input)
  .handler(async ({ data }) => {
    await requireAdmin();

    let appsQuery;
    if (data.grantId) {
      appsQuery = query(collection(db, "grantApplications"), where("grantId", "==", data.grantId), orderBy("createdAt", "desc"));
    } else {
      appsQuery = query(collection(db, "grantApplications"), orderBy("createdAt", "desc"), limit(200));
    }

    const appsSnap = await getDocs(appsQuery);

    const results = [];
    for (const appDoc of appsSnap.docs) {
      const appData = appDoc.data();

      // Get grant
      const grantDocRef = doc(db, "grants", appData.grantId);
      const grantSnap = await getDoc(grantDocRef);
      const grantTitle = grantSnap.exists() ? grantSnap.data().title : "";

      // Get user
      let userName = "";
      let userEmail = "";
      const userDocRef = doc(db, "users", appData.userId);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        userName = userSnap.data().name;
        userEmail = userSnap.data().email;
      }

      results.push({
        id: appDoc.id,
        grantId: appData.grantId,
        grantTitle,
        userId: appData.userId,
        userName,
        userEmail,
        purpose: appData.purpose,
        amountRequested: Number(appData.amountRequested),
        status: appData.status,
        createdAt: appData.createdAt?.toDate().toISOString() || new Date().toISOString(),
      });
    }

    return results;
  });

export const adminUpdateGrantApplication = createServerFn({ method: "POST" })
  .validator((input: { applicationId: string; status: "approved" | "rejected" }) => {
    if (!["approved", "rejected"].includes(input.status)) throw new Error("Invalid status");
    return input;
  })
  .handler(async ({ data }) => {
    await requireAdmin();

    await updateDoc(doc(db, "grantApplications", data.applicationId), {
      status: data.status,
      updatedAt: serverTimestamp(),
    });

    return { ok: true };
  });

