export type TransactionType = 'income' | 'expense' | 'savings' | 'tax';

export type IncomeCategory = 'tutoring' | 'webdev' | 'freelance' | 'gift' | 'other';
export type ExpenseCategory = 'food' | 'transport' | 'subscriptions' | 'housing' | 'education' | 'health' | 'entertainment' | 'other';
export type SavingsCategory = 'savings_deposit' | 'savings_withdrawal';
export type TaxCategory = 'tax_payment' | 'tax_reserve';

export type TransactionCategory = IncomeCategory | ExpenseCategory | SavingsCategory | TaxCategory;

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string | null;
  studentId: string | null;
  projectName: string | null;
  isRecurring: boolean;
  recurringPeriod: string | null;
  createdAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number | null;
  currentAmount: number;
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
}

export interface StudentRate {
  id: string;
  studentId: string;
  ratePerLesson: number;
  currency: string;
  notes: string | null;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  totalSavings: number;
  taxReserve: number;
  netBalance: number;
  period: string;
}
