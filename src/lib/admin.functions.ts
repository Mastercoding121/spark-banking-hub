
import { createServerFn } from "@tanstack/react-start";

const inMemoryStorage = {
  users: new Map(),
  transactions: new Map(),
  loans: new Map(),
  tickets: new Map(),
  flags: new Map(),
  grants: new Map(),
  grantApplications: new Map(),
};

export const getAdminStats = createServerFn({ method: "GET" }).handler(async () => {
  return {
    totalUsers: inMemoryStorage.users.size,
    totalAccounts: 0,
    totalTransactions: inMemoryStorage.transactions.size,
    pendingLoans: Array.from(inMemoryStorage.loans.values()).filter(l => l.status === "submitted").length,
    totalChecking: 0,
    totalSavings: 0,
    verifiedUsers: Array.from(inMemoryStorage.users.values()).filter(u => u.verified).length,
    adminUsers: Array.from(inMemoryStorage.users.values()).filter(u => u.isAdmin).length,
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

export const listUsers = createServerFn({ method: "GET" }).handler(async (): Promise<AdminUserSummary[]> => {
  return Array.from(inMemoryStorage.users.values());
});

export type AdminUserDetail = {
  user: { id: string; email: string; name: string; isAdmin: boolean; verified: boolean; createdAt: string };
  accounts: { type: string; balance: number }[];
  transactions: { id: string; accountType: string; date: string; description: string; category: string; amount: number }[];
};

export const getAdminUser = createServerFn({ method: "GET" })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<AdminUserDetail> => {
    const user = inMemoryStorage.users.get(data.userId);
    return {
      user: user || { id: data.userId, email: "user@example.com", name: "Demo User", isAdmin: false, verified: false, createdAt: new Date().toISOString() },
      accounts: [],
      transactions: [],
    };
  });

export const updateUser = createServerFn({ method: "POST" })
  .validator((input: { userId: string; name?: string; email?: string; isAdmin?: boolean; verified?: boolean; newPassword?: string }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .validator((input: { userId: string }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const adminAdjustBalance = createServerFn({ method: "POST" })
  .validator((input: { userId: string; accountType: "checking" | "savings"; amount: number; note: string }) => {
    return { ...input, amount: Math.round(input.amount * 100) / 100 };
  })
  .handler(async () => {
    return { ok: true };
  });

export const adminAddTransaction = createServerFn({ method: "POST" })
  .validator((input: { userId: string; accountType: "checking" | "savings"; description: string; category: string; amount: number }) => {
    return { ...input, amount: Math.round(input.amount * 100) / 100 };
  })
  .handler(async () => {
    return { ok: true, id: crypto.randomUUID() };
  });

export const adminDeleteTransaction = createServerFn({ method: "POST" })
  .validator((input: { transactionId: string; userId: string }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const listAllTransactions = createServerFn({ method: "GET" }).handler(async () => {
  return Array.from(inMemoryStorage.transactions.values());
});

export const runSchemaMigration = createServerFn({ method: "POST" }).handler(async () => {
  return { ok: true, results: [], at: new Date().toISOString() };
});

export const adminListTickets = createServerFn({ method: "GET" }).handler(async () => {
  return Array.from(inMemoryStorage.tickets.values());
});

export const adminGetTicketMessages = createServerFn({ method: "GET" })
  .validator((input: { ticketId: string }) => input)
  .handler(async () => {
    return [];
  });

export const adminReplyTicket = createServerFn({ method: "POST" })
  .validator((input: { ticketId: string; content: string }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const adminUpdateTicketStatus = createServerFn({ method: "POST" })
  .validator((input: { ticketId: string; status: "open" | "resolved" }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const getRecentActivity = createServerFn({ method: "GET" }).handler(async () => {
  return {
    recentTransactions: [],
    recentUsers: [],
    recentLoans: [],
  };
});

export const adminResetPassword = createServerFn({ method: "POST" })
  .validator((input: { userId: string; newPassword: string }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const adminToggleVerified = createServerFn({ method: "POST" })
  .validator((input: { userId: string; verified: boolean }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const adminToggleAdmin = createServerFn({ method: "POST" })
  .validator((input: { userId: string; isAdmin: boolean }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const listLoans = createServerFn({ method: "GET" }).handler(async () => {
  return Array.from(inMemoryStorage.loans.values());
});

export const updateLoanStatus = createServerFn({ method: "POST" })
  .validator((input: { loanId: string; status: string }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const adminUpdateUserCreatedAt = createServerFn({ method: "POST" })
  .validator((input: { userId: string; createdAt: string }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const adminGetFeatureFlags = createServerFn({ method: "GET" }).handler(async () => {
  return [];
});

export const adminSetFeatureFlag = createServerFn({ method: "POST" })
  .validator((input: { key: string; enabled: boolean; reason?: string; details?: string }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const adminListGrants = createServerFn({ method: "GET" }).handler(async () => {
  return [];
});

export const adminCreateGrant = createServerFn({ method: "POST" })
  .validator((input: { title: string; description: string; amount: number; eligibilityText?: string; deadline?: string }) => input)
  .handler(async () => {
    return { ok: true, id: crypto.randomUUID() };
  });

export const adminUpdateGrant = createServerFn({ method: "POST" })
  .validator((input: { grantId: string; title: string; description: string; amount: number; eligibilityText?: string; deadline?: string; status: string }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const adminDeleteGrant = createServerFn({ method: "POST" })
  .validator((input: { grantId: string }) => input)
  .handler(async () => {
    return { ok: true };
  });

export const adminListGrantApplications = createServerFn({ method: "GET" })
  .validator((input: { grantId?: string }) => input)
  .handler(async () => {
    return [];
  });

export const adminUpdateGrantApplication = createServerFn({ method: "POST" })
  .validator((input: { applicationId: string; status: "approved" | "rejected" }) => input)
  .handler(async () => {
    return { ok: true };
  });
