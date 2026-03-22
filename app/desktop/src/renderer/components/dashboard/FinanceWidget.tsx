import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';

const MONTH_INCOME = 48000;
const MOCK_MONTH_EXPENSES = 31989;
const MOCK_TODAY_EXPENSES = 850;

export function FinanceWidget() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [monthExpenses, setMonthExpenses] = useState(MOCK_MONTH_EXPENSES);
  const [todayExpenses, setTodayExpenses] = useState(MOCK_TODAY_EXPENSES);

  const reload = useCallback(async () => {
    try {
      const result = await window.db.transactions.list('2026-03');
      if (result.length > 0) {
        const expenses = result.filter((t: { type: string }) => t.type === 'expense');
        const total = expenses.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);
        setMonthExpenses(total);
        const today = new Date().toISOString().slice(0, 10);
        const todayTotal = expenses
          .filter((t: { date: string }) => t.date === today)
          .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);
        setTodayExpenses(todayTotal);
      }
    } catch {
      // keep mock data
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('transactions') || entities.includes('tasks')) {
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

  const balance = MONTH_INCOME - monthExpenses;

  return (
    <div className="bg-neutral-900/50 border border-yellow-500/10 rounded-xl p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-yellow-400"><Wallet size={16} strokeWidth={1.5} /></span>
        <h3 className="text-sm font-semibold text-neutral-200">Финансы</h3>
      </div>

      <div className="space-y-2 flex-1">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-neutral-500">Баланс за март</span>
          <span className={`text-sm font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {balance >= 0 ? '+' : ''}{formatMoney(balance)}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-xs text-neutral-500">Доходы / Расходы</span>
          <span className="text-[11px] text-neutral-400">
            <span className="text-emerald-400/80">{formatMoney(MONTH_INCOME)}</span>
            {' / '}
            <span className="text-red-400/80">{formatMoney(monthExpenses)}</span>
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-xs text-neutral-500">Сегодня потрачено</span>
          <span className="text-xs text-red-400">{formatMoney(todayExpenses)}</span>
        </div>
      </div>

      <button
        onClick={() => navigate('/finance')}
        className="mt-4 text-xs text-yellow-400/70 hover:text-yellow-300 transition-colors text-left"
      >
        Перейти в Finance &rarr;
      </button>
    </div>
  );
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('ru-RU') + ' \u20BD';
}
