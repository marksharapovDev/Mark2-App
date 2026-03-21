import { useNavigate } from 'react-router-dom';

const MONTH_INCOME = 48000;
const MONTH_EXPENSES = 31989;
const TODAY_EXPENSES = 850;

export function FinanceWidget() {
  const navigate = useNavigate();
  const balance = MONTH_INCOME - MONTH_EXPENSES;

  return (
    <div className="bg-neutral-900/50 border border-yellow-500/10 rounded-xl p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-yellow-400 text-lg">{'\uD83D\uDCB0'}</span>
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
            <span className="text-red-400/80">{formatMoney(MONTH_EXPENSES)}</span>
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-xs text-neutral-500">Сегодня потрачено</span>
          <span className="text-xs text-red-400">{formatMoney(TODAY_EXPENSES)}</span>
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
