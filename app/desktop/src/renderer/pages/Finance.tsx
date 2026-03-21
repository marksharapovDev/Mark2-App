import { useState, useRef, useCallback } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import type { TaskStatus } from '@mark2/shared';

// --- Types ---

type SectionId = 'expenses' | 'income' | 'budget' | 'analytics';
type ExpenseCategory = 'food' | 'transport' | 'entertainment' | 'subscriptions' | 'housing' | 'other';
type IncomeSource = 'tutoring' | 'freelance' | 'salary' | 'other';
type Priority = 'low' | 'medium' | 'high';

interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: ExpenseCategory;
}

interface Income {
  id: string;
  date: string;
  amount: number;
  description: string;
  source: IncomeSource;
}

interface BudgetCategory {
  category: ExpenseCategory;
  limit: number;
}

interface FinanceGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  icon: string;
}

interface FinanceTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  context: string;
  deadline: string | null;
}

// --- Constants ---

const SECTIONS: Array<{ id: SectionId; icon: string; label: string }> = [
  { id: 'expenses', icon: '\uD83D\uDCB8', label: 'Расходы' },
  { id: 'income', icon: '\uD83D\uDCB0', label: 'Доходы' },
  { id: 'budget', icon: '\uD83D\uDCCA', label: 'Бюджет' },
  { id: 'analytics', icon: '\uD83D\uDCC8', label: 'Аналитика' },
];

const EXPENSE_CATEGORY_META: Record<ExpenseCategory, { icon: string; label: string; color: string; barColor: string }> = {
  food: { icon: '\uD83C\uDF54', label: 'Еда', color: 'bg-orange-900/40 text-orange-300', barColor: 'bg-orange-500' },
  transport: { icon: '\uD83D\uDE8C', label: 'Транспорт', color: 'bg-blue-900/40 text-blue-300', barColor: 'bg-blue-500' },
  entertainment: { icon: '\uD83C\uDFAC', label: 'Развлечения', color: 'bg-purple-900/40 text-purple-300', barColor: 'bg-purple-500' },
  subscriptions: { icon: '\uD83D\uDCF1', label: 'Подписки', color: 'bg-pink-900/40 text-pink-300', barColor: 'bg-pink-500' },
  housing: { icon: '\uD83C\uDFE0', label: 'Жильё', color: 'bg-emerald-900/40 text-emerald-300', barColor: 'bg-emerald-500' },
  other: { icon: '\uD83D\uDCE6', label: 'Прочее', color: 'bg-neutral-700/40 text-neutral-300', barColor: 'bg-neutral-500' },
};

const INCOME_SOURCE_META: Record<IncomeSource, { icon: string; label: string; color: string }> = {
  tutoring: { icon: '\uD83D\uDCDA', label: 'Репетиторство', color: 'bg-blue-900/40 text-blue-300' },
  freelance: { icon: '\uD83D\uDCBB', label: 'Фриланс', color: 'bg-emerald-900/40 text-emerald-300' },
  salary: { icon: '\uD83C\uDFE2', label: 'Зарплата', color: 'bg-yellow-900/40 text-yellow-300' },
  other: { icon: '\uD83D\uDCB5', label: 'Прочее', color: 'bg-neutral-700/40 text-neutral-300' },
};

const PRIORITY_COLORS: Record<Priority, { border: string; badge: string; label: string }> = {
  high: { border: 'border-l-red-500', badge: 'bg-red-500/20 text-red-400', label: 'High' },
  medium: { border: 'border-l-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400', label: 'Medium' },
  low: { border: 'border-l-neutral-600', badge: 'bg-neutral-700/50 text-neutral-400', label: 'Low' },
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  done: 'text-emerald-400',
  in_progress: 'text-blue-400',
  todo: 'text-yellow-400',
  cancelled: 'text-red-400',
};

// --- Mock Data ---

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'e1', date: '2026-03-21', amount: 850, description: 'Продукты в Пятёрочке', category: 'food' },
  { id: 'e2', date: '2026-03-20', amount: 350, description: 'Яндекс.Еда — пицца', category: 'food' },
  { id: 'e3', date: '2026-03-20', amount: 200, description: 'Метро + автобус', category: 'transport' },
  { id: 'e4', date: '2026-03-19', amount: 1200, description: 'Кино + попкорн', category: 'entertainment' },
  { id: 'e5', date: '2026-03-19', amount: 450, description: 'Обед в кафе', category: 'food' },
  { id: 'e6', date: '2026-03-18', amount: 199, description: 'Spotify Premium', category: 'subscriptions' },
  { id: 'e7', date: '2026-03-18', amount: 650, description: 'Продукты на неделю', category: 'food' },
  { id: 'e8', date: '2026-03-17', amount: 300, description: 'Такси', category: 'transport' },
  { id: 'e9', date: '2026-03-16', amount: 2500, description: 'Абонемент в зал', category: 'entertainment' },
  { id: 'e10', date: '2026-03-15', amount: 15000, description: 'Аренда комнаты', category: 'housing' },
  { id: 'e11', date: '2026-03-14', amount: 550, description: 'Продукты', category: 'food' },
  { id: 'e12', date: '2026-03-13', amount: 890, description: 'Claude Max подписка', category: 'subscriptions' },
  { id: 'e13', date: '2026-03-12', amount: 180, description: 'Автобус', category: 'transport' },
  { id: 'e14', date: '2026-03-11', amount: 1500, description: 'Настольные игры + бар', category: 'entertainment' },
  { id: 'e15', date: '2026-03-10', amount: 420, description: 'Продукты', category: 'food' },
  { id: 'e16', date: '2026-03-08', amount: 250, description: 'Такси ночью', category: 'transport' },
  { id: 'e17', date: '2026-03-06', amount: 399, description: 'iCloud+ 200GB', category: 'subscriptions' },
  { id: 'e18', date: '2026-03-05', amount: 700, description: 'Продукты', category: 'food' },
  { id: 'e19', date: '2026-03-03', amount: 350, description: 'Канцелярия для учёбы', category: 'other' },
  { id: 'e20', date: '2026-03-01', amount: 5000, description: 'Коммунальные услуги', category: 'housing' },
];

const MOCK_INCOMES: Income[] = [
  { id: 'i1', date: '2026-03-20', amount: 2000, description: 'Урок с Мишей (ЕГЭ)', source: 'tutoring' },
  { id: 'i2', date: '2026-03-18', amount: 2000, description: 'Урок с Аней (Python)', source: 'tutoring' },
  { id: 'i3', date: '2026-03-15', amount: 25000, description: 'LI Group — лендинг (этап 2)', source: 'freelance' },
  { id: 'i4', date: '2026-03-10', amount: 2000, description: 'Урок с Мишей (ЕГЭ)', source: 'tutoring' },
  { id: 'i5', date: '2026-03-05', amount: 15000, description: 'Personal Site — доработки', source: 'freelance' },
  { id: 'i6', date: '2026-03-03', amount: 2000, description: 'Урок с Аней (Python)', source: 'tutoring' },
];

const MOCK_BUDGET: BudgetCategory[] = [
  { category: 'food', limit: 12000 },
  { category: 'transport', limit: 3000 },
  { category: 'entertainment', limit: 8000 },
  { category: 'subscriptions', limit: 3000 },
  { category: 'housing', limit: 20000 },
];

const MOCK_GOALS: FinanceGoal[] = [
  { id: 'g1', title: 'Накопить на MacBook Pro', target: 200000, current: 85000, icon: '\uD83D\uDCBB' },
  { id: 'g2', title: 'Повысить доход до 150000\u20BD/мес', target: 150000, current: 95000, icon: '\uD83D\uDCC8' },
  { id: 'g3', title: 'Подушка безопасности (3 мес)', target: 285000, current: 120000, icon: '\uD83D\uDEE1\uFE0F' },
];

const MOCK_FINANCE_TASKS: FinanceTask[] = [
  { id: 'ft1', title: 'Оплатить коммуналку', status: 'todo', priority: 'high', context: 'Коммунальные платежи за март', deadline: '2026-03-25' },
  { id: 'ft2', title: 'Пересмотреть подписки', status: 'todo', priority: 'medium', context: 'Проверить все подписки, отменить неиспользуемые', deadline: '2026-03-28' },
  { id: 'ft3', title: 'Перевести на накопительный счёт', status: 'todo', priority: 'low', context: 'Перевести остаток на накопительный счёт', deadline: null },
];

const MONTHLY_INCOME_EXPENSE = [
  { month: 'Окт', income: 78000, expense: 65000 },
  { month: 'Ноя', income: 82000, expense: 70000 },
  { month: 'Дек', income: 90000, expense: 85000 },
  { month: 'Янв', income: 88000, expense: 68000 },
  { month: 'Фев', income: 92000, expense: 72000 },
  { month: 'Мар', income: 95000, expense: 62000 },
];

const SAVINGS_TREND = [
  { month: 'Окт', amount: 45000 },
  { month: 'Ноя', amount: 52000 },
  { month: 'Дек', amount: 57000 },
  { month: 'Янв', amount: 67000 },
  { month: 'Фев', amount: 77000 },
  { month: 'Мар', amount: 85000 },
];

// --- Helpers ---

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10)]}`;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('ru-RU') + ' \u20BD';
}

function spentByCategory(category: ExpenseCategory): number {
  return MOCK_TRANSACTIONS
    .filter((t) => t.category === category)
    .reduce((s, t) => s + t.amount, 0);
}

function totalExpenses(): number {
  return MOCK_TRANSACTIONS.reduce((s, t) => s + t.amount, 0);
}

function totalIncome(): number {
  return MOCK_INCOMES.reduce((s, i) => s + i.amount, 0);
}

// --- Views ---

type MainView =
  | { kind: 'expenses'; filter: ExpenseCategory | 'all' }
  | { kind: 'income' }
  | { kind: 'budget' }
  | { kind: 'analytics' };

// --- Component ---

export function Finance() {
  const [activeSection, setActiveSection] = useState<SectionId>('expenses');
  const [mainView, setMainView] = useState<MainView>({ kind: 'expenses', filter: 'all' });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mark2-sidebar-width');
    if (saved) { const n = parseInt(saved, 10); if (n >= 200 && n <= 400) return n; }
    return Math.min(400, Math.max(200, Math.round(window.innerWidth * 0.2)));
  });
  const [taskChecked, setTaskChecked] = useState<Record<string, boolean>>({});
  const isDraggingSidebar = useRef(false);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 400;

  const selectSection = useCallback((id: SectionId) => {
    setActiveSection(id);
    switch (id) {
      case 'expenses': setMainView({ kind: 'expenses', filter: 'all' }); break;
      case 'income': setMainView({ kind: 'income' }); break;
      case 'budget': setMainView({ kind: 'budget' }); break;
      case 'analytics': setMainView({ kind: 'analytics' }); break;
    }
  }, []);

  const handleSidebarDragStart = useCallback(() => {
    isDraggingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
      setSidebarWidth(w);
      localStorage.setItem('mark2-sidebar-width', String(w));
    };
    const onUp = () => {
      isDraggingSidebar.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const toggleTaskChecked = useCallback((taskId: string) => {
    setTaskChecked((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  }, []);

  const getEffectiveStatus = useCallback((task: FinanceTask): TaskStatus => {
    if (taskChecked[task.id]) return 'done';
    return task.status;
  }, [taskChecked]);

  const sendTaskToChat = useCallback((task: FinanceTask) => {
    const text = `Выполни задачу: ${task.title}\n${task.context}`;
    const inputEl = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Message..."]');
    if (inputEl) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(inputEl, text);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.focus();
    }
  }, []);

  return (
    <MainLayout agent="finance" noPadding defaultChatWidthPct={30}>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* === SIDEBAR === */}
        <aside
          className="shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          {/* Sections nav */}
          <div className="px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Разделы
          </div>
          <nav className="px-2 space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => selectSection(s.id)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                  activeSection === s.id
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                <span className="mr-2">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>

          {/* Goals */}
          <div className="mt-2">
            <div className="mx-3 border-t border-neutral-800" />
          </div>
          <div className="px-3 pt-3 pb-2">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
              Цели
            </div>
            <div className="space-y-2.5">
              {MOCK_GOALS.map((goal) => {
                const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
                return (
                  <div key={goal.id}>
                    <div className="flex items-center gap-1.5 text-xs mb-1">
                      <span className="shrink-0">{goal.icon}</span>
                      <span className="text-neutral-400 truncate">{goal.title}</span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-neutral-600 mt-0.5">
                      {formatMoney(goal.current)} / {formatMoney(goal.target)} ({pct}%)
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="mt-2 w-full text-[11px] text-neutral-500 hover:text-blue-400 transition-colors text-center py-1 rounded hover:bg-neutral-800/50">
              Отправить боту на анализ
            </button>
          </div>

          {/* Tasks */}
          <div>
            <div className="mx-3 border-t border-neutral-800" />
          </div>
          <div className="px-3 pt-3 pb-2">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
              Задачи
            </div>
            <div className="space-y-1">
              {MOCK_FINANCE_TASKS.map((task) => {
                const effectiveStatus = getEffectiveStatus(task);
                const pColor = PRIORITY_COLORS[task.priority];
                const isDone = effectiveStatus === 'done';
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-1.5 text-xs py-1 px-2 rounded border-l-2 ${pColor.border} hover:bg-neutral-800/50 transition-colors`}
                  >
                    <button
                      onClick={() => toggleTaskChecked(task.id)}
                      className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                        isDone ? 'bg-emerald-600 border-emerald-600' : 'border-neutral-600 hover:border-neutral-400'
                      }`}
                    >
                      {isDone && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`truncate flex-1 ${isDone ? 'text-neutral-500 line-through' : 'text-neutral-400'}`}>
                      {task.title}
                    </span>
                    {task.deadline && (
                      <span className="text-[10px] text-neutral-600 shrink-0">{formatDate(task.deadline)}</span>
                    )}
                    <button
                      onClick={() => sendTaskToChat(task)}
                      className="text-neutral-600 hover:text-blue-400 transition-colors shrink-0"
                      title="Отправить боту"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section-specific sidebar content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="mx-3 border-t border-neutral-800" />

            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
              {activeSection === 'expenses' && (
                <ExpensesSidebar
                  onTransactionClick={(cat) => setMainView({ kind: 'expenses', filter: cat })}
                />
              )}
              {activeSection === 'income' && <IncomeSidebar />}
              {activeSection === 'budget' && <BudgetSidebar />}
              {activeSection === 'analytics' && (
                <div className="px-3 pt-3 pb-2 text-xs text-neutral-500">
                  Аналитика отображается в основной области
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Drag handle */}
        <div
          onMouseDown={handleSidebarDragStart}
          className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/30 transition-colors"
        />

        {/* === MAIN CONTENT === */}
        <main className="flex-1 overflow-auto p-6">
          {mainView.kind === 'expenses' && (
            <ExpensesMain
              filter={mainView.filter}
              onFilterChange={(f) => setMainView({ kind: 'expenses', filter: f })}
            />
          )}
          {mainView.kind === 'income' && <IncomeMain />}
          {mainView.kind === 'budget' && <BudgetMain />}
          {mainView.kind === 'analytics' && <AnalyticsMain />}
        </main>
      </div>
    </MainLayout>
  );
}

// --- Progress Bar ---

function ProgressBar({ value, max, color, warn }: { value: number; max: number; color: string; warn?: boolean }) {
  const pct = Math.min(100, (value / max) * 100);
  const barColor = warn && pct > 90 ? 'bg-red-500' : color;
  return (
    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// --- Sidebar sub-components ---

function ExpensesSidebar({ onTransactionClick }: { onTransactionClick: (cat: ExpenseCategory | 'all') => void }) {
  return (
    <>
      {/* Summary */}
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Март — итого
        </div>
        <div className="text-lg font-bold text-red-400">{formatMoney(totalExpenses())}</div>
      </div>

      <div className="mx-3 border-t border-neutral-800" />

      {/* Recent transactions */}
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Последние траты
        </div>
        <div className="space-y-0.5">
          {MOCK_TRANSACTIONS.slice(0, 10).map((t) => (
            <button
              key={t.id}
              onClick={() => onTransactionClick(t.category)}
              className="w-full text-left text-xs py-1.5 px-2 rounded hover:bg-neutral-800/50 transition-colors group"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-600 text-[10px] shrink-0">{formatDate(t.date)}</span>
                <span className="text-red-400/80 text-[10px] ml-auto">{formatMoney(t.amount)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px]">{EXPENSE_CATEGORY_META[t.category].icon}</span>
                <span className="text-neutral-400 group-hover:text-neutral-200 transition-colors truncate">
                  {t.description}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function IncomeSidebar() {
  return (
    <>
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Март — итого
        </div>
        <div className="text-lg font-bold text-emerald-400">{formatMoney(totalIncome())}</div>
      </div>

      <div className="mx-3 border-t border-neutral-800" />

      <div className="px-3 pt-3 pb-2">
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Поступления
        </div>
        <div className="space-y-0.5">
          {MOCK_INCOMES.map((inc) => (
            <div
              key={inc.id}
              className="text-xs py-1.5 px-2 rounded"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-600 text-[10px] shrink-0">{formatDate(inc.date)}</span>
                <span className="text-emerald-400/80 text-[10px] ml-auto">{formatMoney(inc.amount)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px]">{INCOME_SOURCE_META[inc.source].icon}</span>
                <span className="text-neutral-400 truncate">{inc.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function BudgetSidebar() {
  return (
    <div className="px-3 pt-3 pb-2">
      <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
        Лимиты по категориям
      </div>
      <div className="space-y-3">
        {MOCK_BUDGET.map((b) => {
          const spent = spentByCategory(b.category);
          const meta = EXPENSE_CATEGORY_META[b.category];
          return (
            <div key={b.category}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-400">
                  {meta.icon} {meta.label}
                </span>
                <span className={`text-[10px] ${spent > b.limit ? 'text-red-400' : 'text-neutral-500'}`}>
                  {formatMoney(spent)} / {formatMoney(b.limit)}
                </span>
              </div>
              <ProgressBar value={spent} max={b.limit} color={meta.barColor} warn />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Main content sub-components ---

function ExpensesMain({
  filter,
  onFilterChange,
}: {
  filter: ExpenseCategory | 'all';
  onFilterChange: (f: ExpenseCategory | 'all') => void;
}) {
  const filtered = filter === 'all'
    ? MOCK_TRANSACTIONS
    : MOCK_TRANSACTIONS.filter((t) => t.category === filter);
  const filteredTotal = filtered.reduce((s, t) => s + t.amount, 0);

  const filters: Array<{ value: ExpenseCategory | 'all'; label: string }> = [
    { value: 'all', label: 'Все' },
    ...Object.entries(EXPENSE_CATEGORY_META).map(([key, meta]) => ({
      value: key as ExpenseCategory,
      label: `${meta.icon} ${meta.label}`,
    })),
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Расходы</h1>
      <p className="text-neutral-500 text-sm mb-6">Март 2026</p>

      {/* Summary */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-red-400">{formatMoney(filteredTotal)}</span>
          {filter !== 'all' && (
            <span className="text-sm text-neutral-500">
              из {formatMoney(totalExpenses())} общих
            </span>
          )}
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          {filtered.length} транзакций
          {filter !== 'all' && ` \u2014 ${EXPENSE_CATEGORY_META[filter].label}`}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1 mb-6">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === f.value
                ? 'bg-neutral-700 text-white'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      <div className="space-y-1">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-neutral-800/30 transition-colors"
          >
            <span className="text-sm shrink-0">{EXPENSE_CATEGORY_META[t.category].icon}</span>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-neutral-300">{t.description}</span>
              <div className="text-[11px] text-neutral-600 mt-0.5">
                {formatDate(t.date)}
                <span className={`ml-2 px-1 py-0.5 rounded text-[10px] ${EXPENSE_CATEGORY_META[t.category].color}`}>
                  {EXPENSE_CATEGORY_META[t.category].label}
                </span>
              </div>
            </div>
            <span className="text-sm text-red-400 font-mono shrink-0">&minus;{formatMoney(t.amount)}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-neutral-600 text-sm py-4 text-center">Нет транзакций</div>
        )}
      </div>
    </div>
  );
}

function IncomeMain() {
  const total = totalIncome();
  const bySource = (Object.keys(INCOME_SOURCE_META) as IncomeSource[]).map((src) => {
    const items = MOCK_INCOMES.filter((i) => i.source === src);
    return { source: src, total: items.reduce((s, i) => s + i.amount, 0), count: items.length };
  }).filter((g) => g.count > 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Доходы</h1>
      <p className="text-neutral-500 text-sm mb-6">Март 2026</p>

      {/* Summary */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <div className="text-3xl font-bold text-emerald-400">{formatMoney(total)}</div>
        <div className="text-xs text-neutral-500 mt-1">{MOCK_INCOMES.length} поступлений</div>

        {/* By source */}
        <div className="flex gap-3 mt-4">
          {bySource.map((g) => (
            <div key={g.source} className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded font-medium ${INCOME_SOURCE_META[g.source].color}`}>
                {INCOME_SOURCE_META[g.source].icon} {INCOME_SOURCE_META[g.source].label}
              </span>
              <span className="text-xs text-neutral-400">{formatMoney(g.total)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Income list */}
      <div className="space-y-1">
        {MOCK_INCOMES.map((inc) => (
          <div
            key={inc.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-neutral-800/30 transition-colors"
          >
            <span className="text-sm shrink-0">{INCOME_SOURCE_META[inc.source].icon}</span>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-neutral-300">{inc.description}</span>
              <div className="text-[11px] text-neutral-600 mt-0.5">
                {formatDate(inc.date)}
                <span className={`ml-2 px-1 py-0.5 rounded text-[10px] ${INCOME_SOURCE_META[inc.source].color}`}>
                  {INCOME_SOURCE_META[inc.source].label}
                </span>
              </div>
            </div>
            <span className="text-sm text-emerald-400 font-mono shrink-0">+{formatMoney(inc.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BudgetMain() {
  const totalBudget = MOCK_BUDGET.reduce((s, b) => s + b.limit, 0);
  const totalSpent = MOCK_BUDGET.reduce((s, b) => s + spentByCategory(b.category), 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Бюджет</h1>
      <p className="text-neutral-500 text-sm mb-6">Март 2026</p>

      {/* Total budget card */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-3xl font-bold text-neutral-200">{formatMoney(totalSpent)}</span>
          <span className="text-neutral-500 text-sm">из {formatMoney(totalBudget)}</span>
        </div>
        <ProgressBar
          value={totalSpent}
          max={totalBudget}
          color="bg-blue-500"
          warn
        />
        <div className="text-xs text-neutral-500 mt-2">
          Осталось: {formatMoney(totalBudget - totalSpent)}
        </div>
      </div>

      {/* Category budgets */}
      <div className="space-y-3">
        {MOCK_BUDGET.map((b) => {
          const spent = spentByCategory(b.category);
          const meta = EXPENSE_CATEGORY_META[b.category];
          const pct = Math.round((spent / b.limit) * 100);
          const over = spent > b.limit;

          return (
            <div
              key={b.category}
              className="bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 shadow-sm shadow-black/10"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg">{meta.icon}</span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-neutral-300 font-medium">{meta.label}</span>
                    <span className={`text-xs font-mono ${over ? 'text-red-400' : 'text-neutral-400'}`}>
                      {formatMoney(spent)} / {formatMoney(b.limit)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar value={spent} max={b.limit} color={meta.barColor} warn />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[10px] ${over ? 'text-red-400' : 'text-neutral-600'}`}>
                      {pct}%
                    </span>
                    <span className={`text-[10px] ${over ? 'text-red-400' : 'text-neutral-600'}`}>
                      {over
                        ? `Перерасход: ${formatMoney(spent - b.limit)}`
                        : `Осталось: ${formatMoney(b.limit - spent)}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalyticsMain() {
  const expenses = totalExpenses();
  const income = totalIncome();
  const balance = income - expenses;
  const saved = 85000;

  // Spending by category
  const categoryData = (Object.keys(EXPENSE_CATEGORY_META) as ExpenseCategory[]).map((cat) => ({
    category: cat,
    amount: spentByCategory(cat),
  })).filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount);

  const maxCategoryAmount = Math.max(...categoryData.map((d) => d.amount));

  // Monthly chart max
  const maxMonthlyValue = Math.max(...MONTHLY_INCOME_EXPENSE.map((m) => Math.max(m.income, m.expense)));

  // Savings chart max
  const maxSavings = Math.max(...SAVINGS_TREND.map((s) => s.amount));

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Аналитика</h1>
      <p className="text-neutral-500 text-sm mb-6">Март 2026</p>

      {/* Top cards — 4 cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 shadow-sm shadow-black/10">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Доход</div>
          <div className="text-2xl font-bold text-emerald-400">{formatMoney(income)}</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 shadow-sm shadow-black/10">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Расход</div>
          <div className="text-2xl font-bold text-red-400">{formatMoney(expenses)}</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 shadow-sm shadow-black/10">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Баланс</div>
          <div className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {balance >= 0 ? '+' : ''}{formatMoney(balance)}
          </div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 shadow-sm shadow-black/10">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Накоплено</div>
          <div className="text-2xl font-bold text-blue-400">{formatMoney(saved)}</div>
        </div>
      </div>

      {/* Income vs Expense bar */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Доход vs Расход
        </h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-emerald-400">Доходы</span>
              <span className="text-neutral-400">{formatMoney(income)}</span>
            </div>
            <div className="w-full h-4 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500/70 transition-all"
                style={{ width: `${(income / Math.max(income, expenses)) * 100}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-red-400">Расходы</span>
              <span className="text-neutral-400">{formatMoney(expenses)}</span>
            </div>
            <div className="w-full h-4 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-red-500/70 transition-all"
                style={{ width: `${(expenses / Math.max(income, expenses)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Spending by category bar chart */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Расходы по категориям
        </h2>
        <div className="space-y-3">
          {categoryData.map((d) => {
            const meta = EXPENSE_CATEGORY_META[d.category];
            const pct = (d.amount / maxCategoryAmount) * 100;
            return (
              <div key={d.category}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-neutral-300">
                    {meta.icon} {meta.label}
                  </span>
                  <span className="text-neutral-400 font-mono">{formatMoney(d.amount)}</span>
                </div>
                <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${meta.barColor} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grouped bar chart: Income vs Expense for 6 months */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Доход vs Расход (6 мес)
        </h2>
        <div className="flex items-end gap-3 h-40">
          {MONTHLY_INCOME_EXPENSE.map((m) => {
            const incPct = (m.income / maxMonthlyValue) * 100;
            const expPct = (m.expense / maxMonthlyValue) * 100;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-end gap-0.5 flex-1 w-full justify-center">
                  <div className="flex flex-col items-center justify-end h-full" style={{ width: '40%' }}>
                    <div
                      className="w-full bg-emerald-500/70 rounded-t transition-all"
                      style={{ height: `${incPct}%` }}
                      title={`Доход: ${formatMoney(m.income)}`}
                    />
                  </div>
                  <div className="flex flex-col items-center justify-end h-full" style={{ width: '40%' }}>
                    <div
                      className="w-full bg-red-500/70 rounded-t transition-all"
                      style={{ height: `${expPct}%` }}
                      title={`Расход: ${formatMoney(m.expense)}`}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-neutral-500">{m.month}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 justify-center">
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70" />
            Доход
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-500/70" />
            Расход
          </div>
        </div>
      </div>

      {/* Savings trend bar chart */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Динамика накоплений
        </h2>
        <div className="flex items-end gap-3 h-32">
          {SAVINGS_TREND.map((s) => {
            const pct = (s.amount / maxSavings) * 100;
            return (
              <div key={s.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] text-emerald-400/80 font-mono">
                  {Math.round(s.amount / 1000)}k
                </div>
                <div className="flex items-end w-full justify-center flex-1">
                  <div
                    className="w-3/4 bg-emerald-500/60 rounded-t transition-all"
                    style={{ height: `${pct}%` }}
                    title={formatMoney(s.amount)}
                  />
                </div>
                <span className="text-[10px] text-neutral-500">{s.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Share breakdown */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 shadow-lg shadow-black/20">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Доля расходов
        </h2>
        <div className="flex gap-2 flex-wrap">
          {categoryData.map((d) => {
            const meta = EXPENSE_CATEGORY_META[d.category];
            const share = Math.round((d.amount / expenses) * 100);
            return (
              <div
                key={d.category}
                className={`text-xs px-3 py-1.5 rounded-lg border ${meta.color} border-current/20`}
              >
                {meta.icon} {meta.label}: {share}%
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
