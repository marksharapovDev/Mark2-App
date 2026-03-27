import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';

export function FinanceWidget() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [savings, setSavings] = useState(0);

  const reload = useCallback(async () => {
    try {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

      const [summary, savingsGoals] = await Promise.all([
        window.db.finance.summary(monthStart, monthEnd),
        window.db.finance.savings.list(),
      ]);

      setBalance(summary.netBalance);
      setIncome(summary.totalIncome);
      setExpense(summary.totalExpense);

      const totalSavings = savingsGoals
        .filter((s: { status: string }) => s.status === 'active')
        .reduce((sum: number, s: { currentAmount: number }) => sum + s.currentAmount, 0);
      setSavings(totalSavings);
    } catch {
      // keep empty state
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.some((e) => ['transactions', 'savings'].includes(e))) {
        reload();
      }
    });
  }, [reload]);

  if (loading) {
    return (
      <div className="bg-neutral-900/50 border border-yellow-500/10 rounded-xl p-5 flex items-center justify-center min-h-[140px]">
        <div className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="bg-neutral-900/50 border border-yellow-500/10 rounded-xl p-5 cursor-pointer hover:border-yellow-500/25 transition-colors"
      onClick={() => navigate('/finance')}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-yellow-400"><Wallet size={18} strokeWidth={1.5} /></span>
        <h3 className="text-sm font-semibold text-neutral-200">Финансы</h3>
      </div>

      <div className="space-y-3">
        {/* Balance */}
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-neutral-500">Баланс</span>
          <span className={`text-lg font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {balance >= 0 ? '+' : ''}{formatMoney(balance)}
          </span>
        </div>

        {/* Income / Expense */}
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-neutral-500">Доход / Расход</span>
          <span className="text-xs">
            <span className="text-emerald-400/80">{formatMoney(income)}</span>
            {' / '}
            <span className="text-red-400/80">{formatMoney(expense)}</span>
          </span>
        </div>

        {/* Savings */}
        {savings > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-neutral-500">Накопления</span>
            <span className="text-xs text-yellow-400">{formatMoney(savings)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMoney(amount: number): string {
  return Math.abs(amount).toLocaleString('ru-RU') + ' \u20BD';
}
