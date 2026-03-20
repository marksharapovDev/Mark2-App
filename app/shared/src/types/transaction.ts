export type TransactionType = 'income' | 'expense';

export type TransactionSource = 'manual' | 'screenshot' | 'voice';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string | null;
  description: string | null;
  date: string;
  source: TransactionSource;
  createdAt: Date;
}
