export type Transaction = {
  id: string;
  date: string; // ISO
  description: string;
  category: string;
  amount: number; // negative = debit
};

export const TRANSACTIONS: Transaction[] = [
  { id: "1", date: "2026-06-05", description: "Starbucks Coffee #4821", category: "Food & Dining", amount: -24.5 },
  { id: "2", date: "2026-05-28", description: "Amazon.com Marketplace", category: "Shopping", amount: -112.5 },
  { id: "3", date: "2026-05-25", description: "Payroll Deposit - Acme Inc", category: "Income", amount: 3420.0 },
  { id: "4", date: "2026-05-22", description: "Shell Gas Station", category: "Transport", amount: -48.2 },
  { id: "5", date: "2026-05-20", description: "Netflix Subscription", category: "Entertainment", amount: -15.99 },
  { id: "6", date: "2026-05-18", description: "Whole Foods Market", category: "Groceries", amount: -134.78 },
  { id: "7", date: "2026-05-15", description: "Transfer to Savings", category: "Transfer", amount: -500.0 },
  { id: "8", date: "2026-05-12", description: "Uber Trip", category: "Transport", amount: -22.4 },
  { id: "9", date: "2026-05-10", description: "Apple Store", category: "Shopping", amount: -299.0 },
  { id: "10", date: "2026-05-08", description: "Zelle from Sarah Chen", category: "Transfer", amount: 150.0 },
  { id: "11", date: "2026-05-05", description: "Verizon Wireless", category: "Bills", amount: -89.99 },
  { id: "12", date: "2026-05-01", description: "Rent Payment - Brookfield", category: "Housing", amount: -1850.0 },
];

export const CATEGORIES = Array.from(new Set(TRANSACTIONS.map((t) => t.category))).sort();
