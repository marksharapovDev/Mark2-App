import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useSidebar } from '../context/sidebar-context';
import type { Transaction, SavingsGoal, FinanceSummary, TaskStatus, Student, StudentRate } from '@mark2/shared';
import {
  ArrowDownCircle, ArrowUpCircle, PiggyBank, Receipt, TrendingUp,
  Utensils, Bus, Clapperboard, Smartphone, Home, Package, BookOpen,
  Code, Banknote, Gift, Heart, GraduationCap, Plus, Loader2, Target, Users,
  ChevronUp, ChevronDown, BarChart3, Calendar, Pencil, Trash2, X,
} from 'lucide-react';
import { useUndo } from '../context/undo-context';

// --- Types ---

type SectionId = 'overview' | 'income' | 'expenses' | 'savings' | 'taxes';
type PeriodId = 'this_month' | 'last_month' | 'quarter' | 'year' | 'all';
type IncomeCat = 'tutoring' | 'webdev' | 'freelance' | 'gift' | 'other';
type ExpenseCat = 'food' | 'transport' | 'subscriptions' | 'housing' | 'education' | 'health' | 'entertainment' | 'other';
type Priority = 'low' | 'medium' | 'high';

interface FinanceTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  context: string;
  deadline: string | null;
}

// --- Constants ---

const SECTIONS: Array<{ id: SectionId; icon: React.ReactNode; label: string }> = [
  { id: 'overview', icon: <TrendingUp size={16} strokeWidth={1.5} />, label: 'Обзор' },
  { id: 'income', icon: <ArrowUpCircle size={16} strokeWidth={1.5} />, label: 'Доходы' },
  { id: 'expenses', icon: <ArrowDownCircle size={16} strokeWidth={1.5} />, label: 'Расходы' },
  { id: 'savings', icon: <PiggyBank size={16} strokeWidth={1.5} />, label: 'Накопления' },
  { id: 'taxes', icon: <Receipt size={16} strokeWidth={1.5} />, label: 'Налоги' },
];

const PERIODS: Array<{ id: PeriodId; label: string }> = [
  { id: 'this_month', label: 'Этот месяц' },
  { id: 'last_month', label: 'Прошлый месяц' },
  { id: 'quarter', label: 'Квартал' },
  { id: 'year', label: 'Год' },
  { id: 'all', label: 'Всё время' },
];

const INCOME_CAT_META: Record<IncomeCat, { icon: React.ReactNode; label: string; color: string }> = {
  tutoring: { icon: <BookOpen size={14} strokeWidth={1.5} />, label: 'Репетиторство', color: 'bg-blue-900/40 text-blue-300' },
  webdev: { icon: <Code size={14} strokeWidth={1.5} />, label: 'Веб-разработка', color: 'bg-emerald-900/40 text-emerald-300' },
  freelance: { icon: <Banknote size={14} strokeWidth={1.5} />, label: 'Фриланс', color: 'bg-yellow-900/40 text-yellow-300' },
  gift: { icon: <Gift size={14} strokeWidth={1.5} />, label: 'Подарок', color: 'bg-pink-900/40 text-pink-300' },
  other: { icon: <Package size={14} strokeWidth={1.5} />, label: 'Прочее', color: 'bg-neutral-700/40 text-neutral-300' },
};

const EXPENSE_CAT_META: Record<ExpenseCat, { icon: React.ReactNode; label: string; color: string; barColor: string }> = {
  food: { icon: <Utensils size={14} strokeWidth={1.5} />, label: 'Еда', color: 'bg-orange-900/40 text-orange-300', barColor: 'bg-orange-500' },
  transport: { icon: <Bus size={14} strokeWidth={1.5} />, label: 'Транспорт', color: 'bg-blue-900/40 text-blue-300', barColor: 'bg-blue-500' },
  subscriptions: { icon: <Smartphone size={14} strokeWidth={1.5} />, label: 'Подписки', color: 'bg-pink-900/40 text-pink-300', barColor: 'bg-pink-500' },
  housing: { icon: <Home size={14} strokeWidth={1.5} />, label: 'Жильё', color: 'bg-emerald-900/40 text-emerald-300', barColor: 'bg-emerald-500' },
  education: { icon: <GraduationCap size={14} strokeWidth={1.5} />, label: 'Образование', color: 'bg-violet-900/40 text-violet-300', barColor: 'bg-violet-500' },
  health: { icon: <Heart size={14} strokeWidth={1.5} />, label: 'Здоровье', color: 'bg-red-900/40 text-red-300', barColor: 'bg-red-500' },
  entertainment: { icon: <Clapperboard size={14} strokeWidth={1.5} />, label: 'Развлечения', color: 'bg-purple-900/40 text-purple-300', barColor: 'bg-purple-500' },
  other: { icon: <Package size={14} strokeWidth={1.5} />, label: 'Прочее', color: 'bg-neutral-700/40 text-neutral-300', barColor: 'bg-neutral-500' },
};

const SAVINGS_CAT_META: Record<string, { label: string }> = {
  savings_deposit: { label: 'Пополнение' },
  savings_withdrawal: { label: 'Снятие' },
};

const TAX_CAT_META: Record<string, { label: string }> = {
  tax_payment: { label: 'Оплата налога' },
  tax_reserve: { label: 'Резерв' },
};

type TxType = 'income' | 'expense' | 'savings' | 'tax';

function getCategoriesForType(type: TxType): Array<{ value: string; label: string }> {
  switch (type) {
    case 'income': return Object.entries(INCOME_CAT_META).map(([k, v]) => ({ value: k, label: v.label }));
    case 'expense': return Object.entries(EXPENSE_CAT_META).map(([k, v]) => ({ value: k, label: v.label }));
    case 'savings': return Object.entries(SAVINGS_CAT_META).map(([k, v]) => ({ value: k, label: v.label }));
    case 'tax': return Object.entries(TAX_CAT_META).map(([k, v]) => ({ value: k, label: v.label }));
  }
}

const EXPENSE_BAR_COLORS = ['bg-orange-500', 'bg-blue-500', 'bg-pink-500', 'bg-emerald-500', 'bg-violet-500', 'bg-red-500', 'bg-purple-500', 'bg-neutral-500'];

const PRIORITY_COLORS: Record<Priority, { border: string; badge: string }> = {
  high: { border: 'border-l-red-500', badge: 'bg-red-500/20 text-red-400' },
  medium: { border: 'border-l-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400' },
  low: { border: 'border-l-neutral-600', badge: 'bg-neutral-700/50 text-neutral-400' },
};

const PRIORITY_FROM_INT: Record<number, Priority> = { 0: 'low', 1: 'medium', 2: 'high' };
const MONTH_NAMES_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

// --- Helpers ---

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const month = parts[1] ?? '0';
  const day = parts[2] ?? '0';
  return `${parseInt(day, 10)} ${MONTH_NAMES_SHORT[parseInt(month, 10) - 1] ?? ''}`;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('ru-RU') + ' \u20BD';
}

function formatMoneyShort(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M ₽`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}K ₽`;
  return `${amount} ₽`;
}

function getPeriodDates(period: PeriodId): { from: string; to: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case 'this_month': {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const to = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
      return { from, to, label: `${MONTH_NAMES[month]} ${year}` };
    }
    case 'last_month': {
      const pm = month === 0 ? 11 : month - 1;
      const py = month === 0 ? year - 1 : year;
      const from = `${py}-${String(pm + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(py, pm + 1, 0).getDate();
      const to = `${py}-${String(pm + 1).padStart(2, '0')}-${lastDay}`;
      return { from, to, label: `${MONTH_NAMES[pm]} ${py}` };
    }
    case 'quarter': {
      const q = Math.floor(month / 3);
      const from = `${year}-${String(q * 3 + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, q * 3 + 3, 0).getDate();
      const to = `${year}-${String(q * 3 + 3).padStart(2, '0')}-${lastDay}`;
      return { from, to, label: `Q${q + 1} ${year}` };
    }
    case 'year': {
      return { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) };
    }
    case 'all':
      return { from: '2000-01-01', to: '2099-12-31', label: 'Всё время' };
  }
}

function getLast6Months(): Array<{ key: string; label: string; from: string; to: string }> {
  const result: Array<{ key: string; label: string; from: string; to: string }> = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    result.push({
      key,
      label: MONTH_NAMES_SHORT[m] ?? '',
      from: `${key}-01`,
      to: `${key}-${lastDay}`,
    });
  }
  return result;
}

function mapDbTaskToFinance(t: Record<string, unknown>): FinanceTask {
  const dueDate = t.dueDate ? new Date(t.dueDate as string).toISOString().slice(0, 10) : null;
  return {
    id: String(t.id),
    title: String(t.title),
    status: (t.status as TaskStatus) ?? 'todo',
    priority: PRIORITY_FROM_INT[t.priority as number] ?? 'low',
    context: String(t.description ?? ''),
    deadline: dueDate,
  };
}

function getCategoryMeta(type: string, category: string): { icon: React.ReactNode; label: string; color: string } {
  if (type === 'income') return INCOME_CAT_META[category as IncomeCat] ?? INCOME_CAT_META.other;
  return EXPENSE_CAT_META[category as ExpenseCat] ?? EXPENSE_CAT_META.other;
}

// --- Component ---

export function Finance() {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [period, setPeriod] = useState<PeriodId>('this_month');
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mark2-finance-sidebar-width');
    if (saved) { const n = parseInt(saved, 10); if (n >= 200 && n <= 400) return n; }
    return Math.min(400, Math.max(200, Math.round(window.innerWidth * 0.2)));
  });
  const { leftCollapsed, setLeftKey } = useSidebar();
  const { pushUndo } = useUndo();
  useEffect(() => { setLeftKey('finance'); }, [setLeftKey]);
  const isDraggingSidebar = useRef(false);

  // DB state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]); // for charts
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [financeTasks, setFinanceTasks] = useState<FinanceTask[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentRates, setStudentRates] = useState<Map<string, StudentRate>>(new Map());
  const [studentLessonCounts, setStudentLessonCounts] = useState<Map<string, number>>(new Map());
  const [studentFilter, setStudentFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [taskChecked, setTaskChecked] = useState<Record<string, boolean>>({});

  // Transaction popup state
  const [popupTx, setPopupTx] = useState<{ tx: Transaction; rect: DOMRect } | null>(null);
  const [editTx, setEditTx] = useState<{ tx: Transaction | null; rect: DOMRect } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 400;

  const periodDates = useMemo(() => getPeriodDates(period), [period]);

  const reloadData = useCallback(async () => {
    try {
      const { from, to } = periodDates;
      // Get last 6 months for charts
      const months6 = getLast6Months();
      const chartFrom = months6[0]?.from ?? from;

      const [dbTxns, dbSummary, dbGoals, dbTasks, dbStudents, dbAllTxns] = await Promise.all([
        window.db.transactions.list({ dateFrom: from, dateTo: to }),
        window.db.finance.summary(from, to),
        window.db.finance.savings.list(),
        window.db.tasks.list('finance'),
        window.db.students.list(),
        window.db.transactions.list({ dateFrom: chartFrom }),
      ]);
      setTransactions(dbTxns);
      setAllTransactions(dbAllTxns);
      setSummary(dbSummary);
      setSavingsGoals(dbGoals);
      setStudents(dbStudents);
      if (dbTasks.length > 0) {
        setFinanceTasks(dbTasks.map((t) => mapDbTaskToFinance(t as unknown as Record<string, unknown>)));
      }

      const ratesMap = new Map<string, StudentRate>();
      const lessonCountsMap = new Map<string, number>();
      await Promise.all(dbStudents.map(async (s) => {
        const [rate, lessons] = await Promise.all([
          window.db.finance.rates.get(s.id).catch(() => null),
          window.db.lessons.list(s.id).catch(() => []),
        ]);
        if (rate) ratesMap.set(s.id, rate);
        lessonCountsMap.set(s.id, lessons.length);
      }));
      setStudentRates(ratesMap);
      setStudentLessonCounts(lessonCountsMap);
      setDbError(null);
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Ошибка подключения к БД');
    }
  }, [periodDates]);

  useEffect(() => {
    setLoading(true);
    reloadData().finally(() => setLoading(false));
  }, [reloadData]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.some((e) => ['transactions', 'savings', 'tasks', 'students', 'lessons'].includes(e))) {
        reloadData();
      }
    });
  }, [reloadData]);

  const handleSidebarDragStart = useCallback(() => {
    isDraggingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e: MouseEvent) => {
      if (!isDraggingSidebar.current) return;
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX));
      setSidebarWidth(w);
      localStorage.setItem('mark2-finance-sidebar-width', String(w));
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
    setTaskChecked((prev) => {
      const newChecked = !prev[taskId];
      window.db.tasks.update(taskId, { status: newChecked ? 'done' : 'todo' }).catch(() => {});
      return { ...prev, [taskId]: newChecked };
    });
  }, []);

  const handleSaveTransaction = useCallback(async (data: Record<string, unknown>, id?: string) => {
    try {
      if (id) {
        await window.db.transactions.update(id, data);
      } else {
        await window.db.transactions.create(data);
      }
      window.dataEvents.emitDataChanged(['transactions', 'finance']);
      setEditTx(null);
      reloadData();
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Ошибка');
    }
  }, [reloadData]);

  const handleDeleteTransaction = useCallback(async (id: string) => {
    try {
      const saved = allTransactions.find((t) => t.id === id) ?? transactions.find((t) => t.id === id);
      await window.db.transactions.delete(id);
      window.dataEvents.emitDataChanged(['transactions', 'finance']);
      setPopupTx(null);
      setConfirmDeleteId(null);
      reloadData();
      if (saved) pushUndo({ label: saved.description ?? 'транзакция', restoreFn: async () => { await window.db.transactions.create(saved); window.dataEvents.emitDataChanged(['transactions', 'finance']); reloadData(); } });
    } catch { /* ignore */ }
  }, [reloadData, allTransactions, transactions, pushUndo]);

  const handleTxClick = useCallback((tx: Transaction, e: React.MouseEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopupTx({ tx, rect });
    setConfirmDeleteId(null);
  }, []);

  const handleAddClick = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setEditTx({ tx: null, rect });
  }, []);

  // Derived
  const filteredTransactions = studentFilter ? transactions.filter((t) => t.studentId === studentFilter) : transactions;
  const incomeTransactions = filteredTransactions.filter((t) => t.type === 'income');
  const expenseTransactions = filteredTransactions.filter((t) => t.type === 'expense');

  const getStudentBalance = useCallback((studentId: string) => {
    // Use allTransactions for balance (not period-filtered)
    const tutoringTxns = allTransactions.filter((t) => t.type === 'income' && t.category === 'tutoring' && t.studentId === studentId);
    const totalPaid = tutoringTxns.reduce((s, t) => s + t.amount, 0);
    const rate = studentRates.get(studentId);
    const paidLessons = rate ? Math.floor(totalPaid / rate.ratePerLesson) : 0;
    const conducted = studentLessonCounts.get(studentId) ?? 0;
    return { paid: paidLessons, conducted, balance: paidLessons - conducted };
  }, [allTransactions, studentRates, studentLessonCounts]);

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
        <aside className="shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50 overflow-hidden transition-[width] duration-200 ease-in-out" style={{ width: leftCollapsed ? 0 : sidebarWidth }}>
          <div className="px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Разделы</div>
          <nav className="px-2 space-y-0.5">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${
                  activeSection === s.id ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}>{s.icon}{s.label}</button>
            ))}
          </nav>

          {/* Summary */}
          {summary && (
            <>
              <div className="mt-2"><div className="mx-3 border-t border-neutral-800" /></div>
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">{periodDates.label}</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-neutral-500">Доход</span><span className="text-emerald-400 font-mono">{formatMoney(summary.totalIncome)}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500">Расход</span><span className="text-red-400 font-mono">{formatMoney(summary.totalExpense)}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500">Баланс</span><span className={`font-mono ${summary.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatMoney(summary.netBalance)}</span></div>
                </div>
              </div>
            </>
          )}

          {/* Tasks */}
          {financeTasks.length > 0 && (
            <>
              <div><div className="mx-3 border-t border-neutral-800" /></div>
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Задачи</div>
                <div className="space-y-1">
                  {financeTasks.map((task) => {
                    const isDone = taskChecked[task.id] || task.status === 'done';
                    const pColor = PRIORITY_COLORS[task.priority];
                    return (
                      <div key={task.id} className={`flex items-center gap-1.5 text-xs py-1 px-2 rounded border-l-2 ${pColor.border} hover:bg-neutral-800/50 transition-colors`}>
                        <button onClick={() => toggleTaskChecked(task.id)} className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${isDone ? 'bg-emerald-600 border-emerald-600' : 'border-neutral-600 hover:border-neutral-400'}`}>
                          {isDone && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </button>
                        <span className={`truncate flex-1 ${isDone ? 'text-neutral-500 line-through' : 'text-neutral-400'}`}>{task.title}</span>
                        {task.deadline && <span className="text-[10px] text-neutral-600 shrink-0">{formatDate(task.deadline)}</span>}
                        <button onClick={() => sendTaskToChat(task)} className="text-neutral-600 hover:text-blue-400 transition-colors shrink-0" title="Отправить боту">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Students */}
          {students.length > 0 && (
            <>
              <div><div className="mx-3 border-t border-neutral-800" /></div>
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2"><Users size={12} /> Ученики</div>
                <div className="space-y-0.5">
                  {students.map((s) => {
                    const bal = getStudentBalance(s.id);
                    const rate = studentRates.get(s.id);
                    const isFiltered = studentFilter === s.id;
                    let dotColor = 'bg-neutral-600';
                    if (rate) { if (bal.balance > 0) dotColor = 'bg-emerald-500'; else if (bal.balance < 0) dotColor = 'bg-red-500'; }
                    return (
                      <button key={s.id} onClick={() => setStudentFilter(isFiltered ? null : s.id)}
                        className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${isFiltered ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'}`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                        <span className="truncate flex-1">{s.name}</span>
                        {rate && <span className={`text-[10px] font-mono shrink-0 ${bal.balance > 0 ? 'text-emerald-400' : bal.balance < 0 ? 'text-red-400' : 'text-neutral-600'}`}>{bal.balance > 0 ? `+${bal.balance}` : String(bal.balance)}</span>}
                      </button>
                    );
                  })}
                </div>
                {studentFilter && <button onClick={() => setStudentFilter(null)} className="mt-1 w-full text-[10px] text-neutral-600 hover:text-neutral-400 text-center py-0.5">Сбросить фильтр</button>}
              </div>
            </>
          )}

          {/* Recent transactions */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="mx-3 border-t border-neutral-800" />
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Последние</span>
              <button onClick={handleAddClick} className="w-5 h-5 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-500 hover:text-neutral-300 transition-colors" title="Добавить">
                <Plus size={12} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin px-2">
              <div className="space-y-0.5">
                {transactions.slice(0, 15).map((t) => {
                  const isIncome = t.type === 'income';
                  const meta = getCategoryMeta(t.type, t.category);
                  return (
                    <div key={t.id} onClick={(e) => handleTxClick(t, e)} className="text-xs py-1.5 px-2 rounded hover:bg-neutral-800/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-600 text-[10px] shrink-0">{formatDate(t.date)}</span>
                        <span className={`text-[10px] ml-auto font-mono ${isIncome ? 'text-emerald-400/80' : 'text-red-400/80'}`}>{isIncome ? '+' : '-'}{formatMoney(t.amount)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px]">{meta.icon}</span>
                        <span className="text-neutral-400 truncate">{t.description ?? meta.label}</span>
                      </div>
                    </div>
                  );
                })}
                {transactions.length === 0 && !loading && <div className="text-neutral-600 text-xs py-2 text-center">Нет транзакций</div>}
              </div>
            </div>
          </div>
        </aside>

        {!leftCollapsed && (
          <div onMouseDown={handleSidebarDragStart} className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/30 transition-colors" />
        )}

        {/* === MAIN === */}
        <main className="flex-1 overflow-auto p-6">
          {loading && <div className="flex items-center justify-center h-full"><Loader2 size={24} className="animate-spin text-neutral-500" /></div>}
          {dbError && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{dbError}</div>}

          {!loading && activeSection === 'overview' && (
            <OverviewMain
              summary={summary} transactions={filteredTransactions} allTransactions={allTransactions}
              savingsGoals={savingsGoals} period={period} periodDates={periodDates} onPeriodChange={setPeriod}
              onTxClick={handleTxClick} onAddClick={handleAddClick}
            />
          )}
          {!loading && activeSection === 'income' && <IncomeMain transactions={incomeTransactions} students={students} studentRates={studentRates} periodLabel={periodDates.label} />}
          {!loading && activeSection === 'expenses' && <ExpensesMain transactions={expenseTransactions} onTxClick={handleTxClick} periodLabel={periodDates.label} />}
          {!loading && activeSection === 'savings' && <SavingsMain goals={savingsGoals} allTransactions={allTransactions} onReload={reloadData} />}
          {!loading && activeSection === 'taxes' && <TaxMain />}
        </main>
      </div>
      {/* Context menu popup */}
      {popupTx && (
        <ContextMenuPopup
          rect={popupTx.rect}
          onEdit={() => { setEditTx({ tx: popupTx.tx, rect: popupTx.rect }); setPopupTx(null); }}
          onDelete={() => setConfirmDeleteId(popupTx.tx.id)}
          confirmDelete={confirmDeleteId === popupTx.tx.id}
          onConfirmDelete={() => handleDeleteTransaction(popupTx.tx.id)}
          onClose={() => { setPopupTx(null); setConfirmDeleteId(null); }}
        />
      )}

      {/* Edit/Create popup */}
      {editTx && (
        <TransactionFormPopup
          transaction={editTx.tx}
          rect={editTx.rect}
          students={students}
          onSave={handleSaveTransaction}
          onClose={() => setEditTx(null)}
        />
      )}
    </MainLayout>
  );
}

// =========================================================
// Overview
// =========================================================

function OverviewMain({
  summary, transactions, allTransactions, savingsGoals, period, periodDates, onPeriodChange,
  onTxClick, onAddClick,
}: {
  summary: FinanceSummary | null; transactions: Transaction[]; allTransactions: Transaction[];
  savingsGoals: SavingsGoal[]; period: PeriodId; periodDates: { from: string; to: string; label: string };
  onPeriodChange: (p: PeriodId) => void;
  onTxClick: (tx: Transaction, e: React.MouseEvent) => void;
  onAddClick: (e: React.MouseEvent) => void;
}) {
  const totalSavings = savingsGoals.reduce((s, g) => s + g.currentAmount, 0);

  // Previous period comparison
  const prevPeriod = useMemo(() => {
    const now = new Date();
    const pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const key = `${py}-${String(pm + 1).padStart(2, '0')}`;
    const prevIncome = allTransactions.filter((t) => t.type === 'income' && t.date.startsWith(key)).reduce((s, t) => s + t.amount, 0);
    const prevExpense = allTransactions.filter((t) => t.type === 'expense' && t.date.startsWith(key)).reduce((s, t) => s + t.amount, 0);
    return { income: prevIncome, expense: prevExpense };
  }, [allTransactions]);

  const incomeChange = summary && prevPeriod.income > 0 ? Math.round(((summary.totalIncome - prevPeriod.income) / prevPeriod.income) * 100) : null;
  const expenseChange = summary && prevPeriod.expense > 0 ? Math.round(((summary.totalExpense - prevPeriod.expense) / prevPeriod.expense) * 100) : null;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Обзор</h1>
          <p className="text-neutral-500 text-sm">{periodDates.label}</p>
        </div>
        <PeriodSwitcher period={period} onChange={onPeriodChange} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Доход" amount={summary?.totalIncome ?? 0} color="text-emerald-400" icon={<ArrowUpCircle size={18} />} change={incomeChange} />
        <SummaryCard label="Расход" amount={summary?.totalExpense ?? 0} color="text-red-400" icon={<ArrowDownCircle size={18} />} change={expenseChange} invertChange />
        <SummaryCard label="Баланс" amount={summary?.netBalance ?? 0} color={(summary?.netBalance ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'} icon={<TrendingUp size={18} />} />
        <SummaryCard label="Накопления" amount={totalSavings} color="text-blue-400" icon={<PiggyBank size={18} />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <MonthlyChart allTransactions={allTransactions} />
        <ExpenseCategoryChart transactions={transactions} />
      </div>

      {/* Statistics */}
      <StatisticsBlock allTransactions={allTransactions} transactions={transactions} />

      {/* Recent transactions */}
      <div className="flex items-center justify-between mb-3 mt-6">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Последние транзакции</h2>
        <button onClick={onAddClick} className="w-6 h-6 flex items-center justify-center rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors" title="Добавить транзакцию">
          <Plus size={14} />
        </button>
      </div>
      <div className="space-y-1">
        {transactions.slice(0, 10).map((t) => <TransactionRow key={t.id} transaction={t} onClick={onTxClick} />)}
        {transactions.length === 0 && <div className="text-neutral-600 text-sm py-4 text-center">Нет транзакций</div>}
      </div>
    </div>
  );
}

// =========================================================
// Charts
// =========================================================

function MonthlyChart({ allTransactions }: { allTransactions: Transaction[] }) {
  const months = getLast6Months();
  const data = months.map((m) => {
    const monthTxns = allTransactions.filter((t) => t.date >= m.from && t.date <= m.to);
    return {
      label: m.label,
      income: monthTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: monthTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  });
  const maxVal = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1);

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={14} className="text-neutral-500" />
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Доходы / Расходы</span>
      </div>
      <div className="flex items-end gap-2 h-32">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: '100px' }}>
              <div className="w-2.5 bg-emerald-500/80 rounded-t transition-all" style={{ height: `${(d.income / maxVal) * 100}px` }} title={`Доход: ${formatMoney(d.income)}`} />
              <div className="w-2.5 bg-red-500/80 rounded-t transition-all" style={{ height: `${(d.expense / maxVal) * 100}px` }} title={`Расход: ${formatMoney(d.expense)}`} />
            </div>
            <span className="text-[10px] text-neutral-600">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-4 mt-3">
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500"><span className="w-2 h-2 rounded bg-emerald-500" />Доходы</div>
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500"><span className="w-2 h-2 rounded bg-red-500" />Расходы</div>
      </div>
    </div>
  );
}

function ExpenseCategoryChart({ transactions }: { transactions: Transaction[] }) {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const byCategory = Object.entries(EXPENSE_CAT_META).map(([key, meta]) => {
    const amount = expenses.filter((t) => t.category === key).reduce((s, t) => s + t.amount, 0);
    return { key, ...meta, amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 };
  }).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={14} className="text-neutral-500" />
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Расходы по категориям</span>
      </div>
      {byCategory.length === 0 ? (
        <div className="text-neutral-600 text-xs py-8 text-center">Нет расходов</div>
      ) : (
        <div className="space-y-2">
          {byCategory.map((c) => (
            <div key={c.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-neutral-400 flex items-center gap-1">{c.icon} {c.label}</span>
                <span className="text-neutral-500 font-mono">{formatMoney(c.amount)} ({c.pct}%)</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${c.barColor}`} style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =========================================================
// Statistics
// =========================================================

function StatisticsBlock({ allTransactions, transactions }: { allTransactions: Transaction[]; transactions: Transaction[] }) {
  const months = getLast6Months().slice(-3);
  const avg3m = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let count = 0;
    for (const m of months) {
      const mTxns = allTransactions.filter((t) => t.date >= m.from && t.date <= m.to);
      totalIncome += mTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      totalExpense += mTxns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      count++;
    }
    return { income: count > 0 ? Math.round(totalIncome / count) : 0, expense: count > 0 ? Math.round(totalExpense / count) : 0 };
  }, [allTransactions, months]);

  // Top 3 expense categories
  const expenses = transactions.filter((t) => t.type === 'expense');
  const top3 = Object.entries(EXPENSE_CAT_META)
    .map(([key, meta]) => ({ key, label: meta.label, icon: meta.icon, amount: expenses.filter((t) => t.category === key).reduce((s, t) => s + t.amount, 0) }))
    .filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 3);

  // Income sources comparison
  const tutoringIncome = transactions.filter((t) => t.type === 'income' && t.category === 'tutoring').reduce((s, t) => s + t.amount, 0);
  const webdevIncome = transactions.filter((t) => t.type === 'income' && (t.category === 'webdev' || t.category === 'freelance')).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={14} className="text-neutral-500" />
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Статистика</span>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs">
        <div>
          <span className="text-neutral-500">Ср. доход (3 мес)</span>
          <div className="text-sm font-mono text-emerald-400 mt-0.5">{formatMoney(avg3m.income)}</div>
        </div>
        <div>
          <span className="text-neutral-500">Ср. расход (3 мес)</span>
          <div className="text-sm font-mono text-red-400 mt-0.5">{formatMoney(avg3m.expense)}</div>
        </div>
        <div>
          <span className="text-neutral-500">Топ расходы</span>
          <div className="mt-1 space-y-0.5">
            {top3.map((c, i) => (
              <div key={c.key} className="flex items-center gap-1.5">
                <span className="text-neutral-600">{i + 1}.</span>
                <span className="text-[10px]">{c.icon}</span>
                <span className="text-neutral-400">{c.label}</span>
                <span className="text-neutral-500 font-mono ml-auto">{formatMoney(c.amount)}</span>
              </div>
            ))}
            {top3.length === 0 && <span className="text-neutral-600">—</span>}
          </div>
        </div>
        <div>
          <span className="text-neutral-500">Источники дохода</span>
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <BookOpen size={10} className="text-blue-400" />
              <span className="text-neutral-400">Репетиторство</span>
              <span className="text-neutral-500 font-mono ml-auto">{formatMoney(tutoringIncome)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Code size={10} className="text-emerald-400" />
              <span className="text-neutral-400">Разработка</span>
              <span className="text-neutral-500 font-mono ml-auto">{formatMoney(webdevIncome)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// Shared UI
// =========================================================

function PeriodSwitcher({ period, onChange }: { period: PeriodId; onChange: (p: PeriodId) => void }) {
  return (
    <div className="flex items-center gap-0.5 bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
      {PERIODS.map((p) => (
        <button key={p.id} onClick={() => onChange(p.id)}
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${period === p.id ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>{p.label}</button>
      ))}
    </div>
  );
}

function SummaryCard({ label, amount, color, icon, change, invertChange }: {
  label: string; amount: number; color: string; icon: React.ReactNode; change?: number | null; invertChange?: boolean;
}) {
  const isPositiveChange = invertChange ? (change ?? 0) < 0 : (change ?? 0) > 0;
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2">{icon} {label}</div>
      <div className={`text-xl font-bold font-mono ${color}`}>{formatMoney(amount)}</div>
      {change !== null && change !== undefined && (
        <div className={`flex items-center gap-0.5 text-[10px] mt-1 ${isPositiveChange ? 'text-emerald-400' : 'text-red-400'}`}>
          {change > 0 ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {Math.abs(change)}% от пред. месяца
        </div>
      )}
    </div>
  );
}

function TransactionRow({ transaction: t, onClick }: { transaction: Transaction; onClick: (tx: Transaction, e: React.MouseEvent) => void }) {
  const meta = getCategoryMeta(t.type, t.category);
  const cfg: Record<string, { color: string; prefix: string }> = {
    income: { color: 'text-emerald-400', prefix: '+' },
    expense: { color: 'text-red-400', prefix: '-' },
    savings: { color: 'text-blue-400', prefix: '' },
    tax: { color: 'text-yellow-400', prefix: '-' },
  };
  const { color, prefix } = cfg[t.type] ?? cfg.expense!;

  return (
    <div onClick={(e) => onClick(t, e)} className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-neutral-800/30 transition-colors cursor-pointer">
      <span className="text-sm shrink-0">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-neutral-300">{t.description ?? meta.label}</span>
        <div className="text-[11px] text-neutral-600 mt-0.5">{formatDate(t.date)}<span className={`ml-2 px-1 py-0.5 rounded text-[10px] ${meta.color}`}>{meta.label}</span></div>
      </div>
      <span className={`text-sm font-mono shrink-0 ${color}`}>{prefix}{formatMoney(t.amount)}</span>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${active ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'}`}>{children}</button>
  );
}

// =========================================================
// Context Menu Popup
// =========================================================

function ContextMenuPopup({ rect, onEdit, onDelete, confirmDelete, onConfirmDelete, onClose }: {
  rect: DOMRect;
  onEdit: () => void;
  onDelete: () => void;
  confirmDelete: boolean;
  onConfirmDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEsc); };
  }, [onClose]);

  const top = rect.bottom + 4;
  const left = Math.min(rect.left, window.innerWidth - 160);

  return (
    <div ref={ref} className="fixed z-50 animate-in fade-in duration-150" style={{ top, left }}>
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]">
        <button onClick={onEdit} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 transition-colors">
          <Pencil size={14} /> Редактировать
        </button>
        {!confirmDelete ? (
          <button onClick={onDelete} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-neutral-700 transition-colors">
            <Trash2 size={14} /> Удалить
          </button>
        ) : (
          <button onClick={onConfirmDelete} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors">
            <Trash2 size={14} /> Точно удалить?
          </button>
        )}
      </div>
    </div>
  );
}

// =========================================================
// Transaction Form Popup (Edit / Create)
// =========================================================

function TransactionFormPopup({ transaction, rect, students, onSave, onClose }: {
  transaction: Transaction | null;
  rect: DOMRect;
  students: Student[];
  onSave: (data: Record<string, unknown>, id?: string) => void;
  onClose: () => void;
}) {
  const isEdit = !!transaction;
  const ref = useRef<HTMLDivElement>(null);

  const [type, setType] = useState<TxType>(transaction?.type as TxType ?? 'expense');
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
  const [category, setCategory] = useState(transaction?.category ?? '');
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [date, setDate] = useState(transaction?.date ?? new Date().toISOString().slice(0, 10));
  const [studentId, setStudentId] = useState(transaction?.studentId ?? '');
  const [isRecurring, setIsRecurring] = useState(transaction?.isRecurring ?? false);
  const [recurringPeriod, setRecurringPeriod] = useState(transaction?.recurringPeriod ?? 'monthly');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEsc); };
  }, [onClose]);

  // Reset category when type changes (only for new transactions)
  useEffect(() => {
    if (!isEdit) setCategory('');
  }, [type, isEdit]);

  const categories = getCategoriesForType(type);
  const showStudentSelect = type === 'income' && category === 'tutoring';

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setSubmitting(true);
    const data: Record<string, unknown> = {
      type, amount: amt,
      category: category || 'other',
      description: description || null,
      date,
      studentId: showStudentSelect && studentId ? studentId : null,
      isRecurring,
      recurringPeriod: isRecurring ? recurringPeriod : null,
    };
    await onSave(data, transaction?.id);
    setSubmitting(false);
  };

  // Position: try below the element, clamp to viewport
  const popupHeight = 380;
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const top = spaceBelow >= popupHeight ? rect.bottom + 4 : Math.max(8, rect.top - popupHeight - 4);
  const left = Math.min(rect.left, window.innerWidth - 360);

  const inputCls = 'w-full px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-blue-500';

  return (
    <div ref={ref} className="fixed z-50 animate-in fade-in duration-150" style={{ top, left, width: 340 }}>
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-neutral-200">{isEdit ? 'Редактировать' : 'Новая транзакция'}</span>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 transition-colors"><X size={16} /></button>
        </div>

        {/* Type selector */}
        <div className="flex gap-1 mb-3">
          {([['expense', 'Расход', 'bg-red-500/20 text-red-400'], ['income', 'Доход', 'bg-emerald-500/20 text-emerald-400'], ['savings', 'Накопл.', 'bg-blue-500/20 text-blue-400'], ['tax', 'Налог', 'bg-yellow-500/20 text-yellow-400']] as const).map(([t, label, activeColor]) => (
            <button key={t} onClick={() => setType(t)} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${type === t ? activeColor : 'text-neutral-500 hover:text-neutral-300'}`}>{label}</button>
          ))}
        </div>

        <div className="space-y-2.5">
          <input type="text" placeholder="Описание" value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />

          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Сумма" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              <option value="">Категория</option>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />

          {showStudentSelect && (
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputCls}>
              <option value="">Ученик</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer">
              <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0" />
              Регулярный
            </label>
            {isRecurring && (
              <select value={recurringPeriod} onChange={(e) => setRecurringPeriod(e.target.value)} className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-blue-500">
                <option value="weekly">Еженедельно</option>
                <option value="monthly">Ежемесячно</option>
                <option value="yearly">Ежегодно</option>
              </select>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors">Отмена</button>
          <button onClick={handleSubmit} disabled={submitting || !amount} className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm text-white transition-colors">
            {submitting ? '...' : isEdit ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// Income
// =========================================================

function IncomeMain({ transactions, students, studentRates, periodLabel }: {
  transactions: Transaction[]; students: Student[]; studentRates: Map<string, StudentRate>; periodLabel: string;
}) {
  const [filter, setFilter] = useState<IncomeCat | 'all'>('all');
  const [studentFilter, setStudentFilter] = useState<string | null>(null);

  let filtered = filter === 'all' ? transactions : transactions.filter((t) => t.category === filter);
  if (studentFilter) filtered = filtered.filter((t) => t.studentId === studentFilter);
  const total = filtered.reduce((s, t) => s + t.amount, 0);
  const studentMap = new Map(students.map((s) => [s.id, s.name]));

  const byCategory = (Object.keys(INCOME_CAT_META) as IncomeCat[]).map((cat) => {
    const items = transactions.filter((t) => t.category === cat);
    return { category: cat, total: items.reduce((s, t) => s + t.amount, 0), count: items.length };
  }).filter((g) => g.count > 0);

  const tutoringStudents = [...new Set(transactions.filter((t) => t.category === 'tutoring' && t.studentId).map((t) => t.studentId!))];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Доходы</h1>
      <p className="text-neutral-500 text-sm mb-6">{periodLabel}</p>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6">
        <div className="text-3xl font-bold text-emerald-400 font-mono">{formatMoney(total)}</div>
        <div className="text-xs text-neutral-500 mt-1">{filtered.length} поступлений</div>
        <div className="flex flex-wrap gap-2 mt-4">
          {byCategory.map((g) => (
            <div key={g.category} className="flex items-center gap-1.5">
              <span className={`text-xs px-2 py-1 rounded font-medium ${INCOME_CAT_META[g.category].color}`}>{INCOME_CAT_META[g.category].icon} {INCOME_CAT_META[g.category].label}</span>
              <span className="text-xs text-neutral-400">{formatMoney(g.total)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Все</FilterButton>
        {(Object.entries(INCOME_CAT_META) as [IncomeCat, typeof INCOME_CAT_META[IncomeCat]][]).map(([k, v]) => (
          <FilterButton key={k} active={filter === k} onClick={() => setFilter(k)}>{v.icon} {v.label}</FilterButton>
        ))}
      </div>
      {(filter === 'all' || filter === 'tutoring') && tutoringStudents.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          <span className="text-[10px] text-neutral-600 self-center mr-1">Ученик:</span>
          <FilterButton active={!studentFilter} onClick={() => setStudentFilter(null)}>Все</FilterButton>
          {tutoringStudents.map((sid) => <FilterButton key={sid} active={studentFilter === sid} onClick={() => setStudentFilter(sid)}>{studentMap.get(sid) ?? sid}</FilterButton>)}
        </div>
      )}

      <div className="space-y-1">
        {filtered.map((t) => {
          const meta = INCOME_CAT_META[t.category as IncomeCat] ?? INCOME_CAT_META.other;
          const studentName = t.studentId ? studentMap.get(t.studentId) : null;
          const rate = t.studentId ? studentRates.get(t.studentId) : null;
          const lessonsCount = rate ? Math.round(t.amount / rate.ratePerLesson) : null;
          return (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-neutral-800/30 transition-colors">
              <span className="text-sm shrink-0">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-neutral-300">{t.description ?? meta.label}</span>
                <div className="text-[11px] text-neutral-600 mt-0.5">
                  {formatDate(t.date)}<span className={`ml-2 px-1 py-0.5 rounded text-[10px] ${meta.color}`}>{meta.label}</span>
                  {t.category === 'tutoring' && studentName && <span className="ml-2 text-blue-400/70">{studentName}</span>}
                  {t.category === 'tutoring' && lessonsCount !== null && lessonsCount > 0 && <span className="ml-1 text-neutral-600">({lessonsCount} ур.)</span>}
                </div>
              </div>
              <span className="text-sm text-emerald-400 font-mono shrink-0">+{formatMoney(t.amount)}</span>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-neutral-600 text-sm py-4 text-center">Нет доходов</div>}
      </div>
    </div>
  );
}

// =========================================================
// Expenses
// =========================================================

function ExpensesMain({ transactions, onTxClick, periodLabel }: { transactions: Transaction[]; onTxClick: (tx: Transaction, e: React.MouseEvent) => void; periodLabel: string }) {
  const [filter, setFilter] = useState<ExpenseCat | 'all'>('all');
  const filtered = filter === 'all' ? transactions : transactions.filter((t) => t.category === filter);
  const total = filtered.reduce((s, t) => s + t.amount, 0);
  const overallTotal = transactions.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Расходы</h1>
      <p className="text-neutral-500 text-sm mb-6">{periodLabel}</p>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-red-400 font-mono">{formatMoney(total)}</span>
          {filter !== 'all' && <span className="text-sm text-neutral-500">из {formatMoney(overallTotal)}</span>}
        </div>
        <div className="text-xs text-neutral-500 mt-1">{filtered.length} транзакций{filter !== 'all' && ` — ${EXPENSE_CAT_META[filter].label}`}</div>
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Все</FilterButton>
        {(Object.entries(EXPENSE_CAT_META) as [ExpenseCat, typeof EXPENSE_CAT_META[ExpenseCat]][]).map(([k, v]) => (
          <FilterButton key={k} active={filter === k} onClick={() => setFilter(k)}>{v.icon} {v.label}</FilterButton>
        ))}
      </div>

      <div className="space-y-1">
        {filtered.map((t) => <TransactionRow key={t.id} transaction={t} onClick={onTxClick} />)}
        {filtered.length === 0 && <div className="text-neutral-600 text-sm py-4 text-center">Нет расходов</div>}
      </div>
    </div>
  );
}

// =========================================================
// Savings
// =========================================================

function SavingsMain({ goals, allTransactions, onReload }: { goals: SavingsGoal[]; allTransactions: Transaction[]; onReload: () => void }) {
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');

  const totalSavings = goals.reduce((s, g) => s + g.currentAmount, 0);
  const savingsTxns = allTransactions.filter((t) => t.type === 'savings');

  const handleDeposit = async (goalId: string) => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;
    setSubmitting(true);
    try {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return;
      await window.db.finance.savings.update(goalId, { currentAmount: goal.currentAmount + amount });
      await window.db.transactions.create({ type: 'savings', amount, category: 'savings_deposit', description: `Пополнение: ${goal.name}`, date: new Date().toISOString().slice(0, 10) });
      setDepositGoalId(null); setDepositAmount(''); onReload();
    } catch { /* ignore */ } finally { setSubmitting(false); }
  };

  const handleCreateGoal = async () => {
    if (!newGoalName) return;
    setSubmitting(true);
    try {
      await window.db.finance.savings.create({ name: newGoalName, targetAmount: newGoalTarget ? parseFloat(newGoalTarget) : null });
      setShowNewGoal(false); setNewGoalName(''); setNewGoalTarget(''); onReload();
    } catch { /* ignore */ } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Накопления</h1>
      <p className="text-neutral-500 text-sm mb-6">Цели и прогресс</p>

      {/* Total */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6">
        <div className="text-xs text-neutral-500 mb-1">Общая сумма накоплений</div>
        <div className="text-3xl font-bold text-blue-400 font-mono">{formatMoney(totalSavings)}</div>
        <div className="text-xs text-neutral-500 mt-1">{goals.length} целей</div>
      </div>

      {/* Goals */}
      <div className="space-y-4">
        {goals.map((goal) => {
          const pct = goal.targetAmount ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : null;
          const goalTxns = savingsTxns.filter((t) => t.description?.includes(goal.name)).sort((a, b) => b.date.localeCompare(a.date));
          return (
            <div key={goal.id} className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-blue-400" />
                  <span className="text-sm font-medium text-neutral-200">{goal.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${goal.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : goal.status === 'completed' ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-700/50 text-neutral-400'}`}>{goal.status}</span>
                </div>
                <button onClick={() => setDepositGoalId(depositGoalId === goal.id ? null : goal.id)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Пополнить</button>
              </div>

              {pct !== null && (
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}
              <div className="flex justify-between text-xs text-neutral-500">
                <span className="font-mono">{formatMoney(goal.currentAmount)}</span>
                {goal.targetAmount && <span>из {formatMoney(goal.targetAmount)} ({pct}%)</span>}
              </div>

              {depositGoalId === goal.id && (
                <div className="mt-3 flex gap-2">
                  <input type="number" placeholder="Сумма" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="flex-1 px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-blue-500" />
                  <button onClick={() => handleDeposit(goal.id)} disabled={submitting} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm text-white transition-colors">{submitting ? '...' : 'OK'}</button>
                </div>
              )}

              {/* Deposit history */}
              {goalTxns.length > 0 && (
                <div className="mt-3 pt-3 border-t border-neutral-800">
                  <div className="text-[10px] text-neutral-600 uppercase tracking-wider mb-1.5">История пополнений</div>
                  <div className="space-y-0.5">
                    {goalTxns.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between text-xs">
                        <span className="text-neutral-600">{formatDate(t.date)}</span>
                        <span className="text-blue-400 font-mono">+{formatMoney(t.amount)}</span>
                      </div>
                    ))}
                    {goalTxns.length > 5 && <div className="text-[10px] text-neutral-600 text-center">ещё {goalTxns.length - 5}...</div>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {goals.length === 0 && <div className="text-neutral-600 text-sm py-4 text-center">Нет целей</div>}
      </div>

      {/* New goal */}
      <div className="mt-4">
        {!showNewGoal ? (
          <button onClick={() => setShowNewGoal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300 transition-colors"><Plus size={14} /> Новая цель</button>
        ) : (
          <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Название цели" value={newGoalName} onChange={(e) => setNewGoalName(e.target.value)} className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-blue-500" />
              <input type="number" placeholder="Целевая сумма (опц.)" value={newGoalTarget} onChange={(e) => setNewGoalTarget(e.target.value)} className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowNewGoal(false)} className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200">Отмена</button>
              <button onClick={handleCreateGoal} disabled={submitting || !newGoalName} className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm text-white transition-colors">Создать</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================
// Taxes
// =========================================================

function TaxMain() {
  const [taxRate, setTaxRate] = useState<4 | 6>(4);
  const [yearTxns, setYearTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const year = new Date().getFullYear();

  useEffect(() => {
    window.db.transactions.list({ dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` })
      .then(setYearTxns)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year]);

  const quarters = useMemo(() => {
    const result: Array<{
      label: string; from: string; to: string;
      income: number; taxDue: number; taxPaid: number; taxReserved: number; remaining: number;
    }> = [];
    for (let q = 0; q < 4; q++) {
      const from = `${year}-${String(q * 3 + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, q * 3 + 3, 0).getDate();
      const to = `${year}-${String(q * 3 + 3).padStart(2, '0')}-${lastDay}`;
      const qTxns = yearTxns.filter((t) => t.date >= from && t.date <= to);
      const income = qTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const taxDue = Math.round(income * taxRate / 100);
      const taxPaid = qTxns.filter((t) => t.type === 'tax' && t.category === 'tax_payment').reduce((s, t) => s + t.amount, 0);
      const taxReserved = qTxns.filter((t) => t.type === 'tax' && t.category === 'tax_reserve').reduce((s, t) => s + t.amount, 0);
      result.push({ label: `Q${q + 1}`, from, to, income, taxDue, taxPaid, taxReserved, remaining: Math.max(0, taxDue - taxPaid) });
    }
    return result;
  }, [yearTxns, taxRate, year]);

  const yearIncome = yearTxns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const yearTaxDue = Math.round(yearIncome * taxRate / 100);
  const yearTaxPaid = yearTxns.filter((t) => t.type === 'tax' && t.category === 'tax_payment').reduce((s, t) => s + t.amount, 0);
  const yearTaxReserved = yearTxns.filter((t) => t.type === 'tax' && t.category === 'tax_reserve').reduce((s, t) => s + t.amount, 0);
  const yearRemaining = Math.max(0, yearTaxDue - yearTaxPaid);

  if (loading) return <Loader2 size={24} className="animate-spin text-neutral-500" />;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Налоги</h1>
          <p className="text-neutral-500 text-sm">Самозанятый — {year}</p>
        </div>
        {/* Rate toggle */}
        <div className="flex items-center gap-0.5 bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
          <button onClick={() => setTaxRate(4)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${taxRate === 4 ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>4% физлица</button>
          <button onClick={() => setTaxRate(6)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${taxRate === 6 ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>6% юрлица</button>
        </div>
      </div>

      {/* Year summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <div className="text-xs text-neutral-500 mb-1">Доход за год</div>
          <div className="text-lg font-bold font-mono text-neutral-200">{formatMoney(yearIncome)}</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <div className="text-xs text-neutral-500 mb-1">Налог ({taxRate}%)</div>
          <div className="text-lg font-bold font-mono text-yellow-400">{formatMoney(yearTaxDue)}</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <div className="text-xs text-neutral-500 mb-1">Оплачено</div>
          <div className="text-lg font-bold font-mono text-emerald-400">{formatMoney(yearTaxPaid)}</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <div className="text-xs text-neutral-500 mb-1">К уплате</div>
          <div className={`text-lg font-bold font-mono ${yearRemaining > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatMoney(yearRemaining)}</div>
        </div>
      </div>

      {/* Quarterly breakdown */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden mb-6">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-500">
              <th className="text-left px-4 py-2.5 font-medium">Квартал</th>
              <th className="text-right px-4 py-2.5 font-medium">Доход</th>
              <th className="text-right px-4 py-2.5 font-medium">Налог</th>
              <th className="text-right px-4 py-2.5 font-medium">Оплачено</th>
              <th className="text-right px-4 py-2.5 font-medium">Резерв</th>
              <th className="text-right px-4 py-2.5 font-medium">Остаток</th>
            </tr>
          </thead>
          <tbody>
            {quarters.map((q) => (
              <tr key={q.label} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                <td className="px-4 py-2.5 text-neutral-300 font-medium">{q.label}</td>
                <td className="px-4 py-2.5 text-right text-neutral-300 font-mono">{formatMoney(q.income)}</td>
                <td className="px-4 py-2.5 text-right text-yellow-400 font-mono">{formatMoney(q.taxDue)}</td>
                <td className="px-4 py-2.5 text-right text-emerald-400 font-mono">{formatMoney(q.taxPaid)}</td>
                <td className="px-4 py-2.5 text-right text-blue-400 font-mono">{formatMoney(q.taxReserved)}</td>
                <td className={`px-4 py-2.5 text-right font-mono ${q.remaining > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatMoney(q.remaining)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-700 font-medium">
              <td className="px-4 py-2.5 text-neutral-200">Итого</td>
              <td className="px-4 py-2.5 text-right text-neutral-200 font-mono">{formatMoney(yearIncome)}</td>
              <td className="px-4 py-2.5 text-right text-yellow-400 font-mono">{formatMoney(yearTaxDue)}</td>
              <td className="px-4 py-2.5 text-right text-emerald-400 font-mono">{formatMoney(yearTaxPaid)}</td>
              <td className="px-4 py-2.5 text-right text-blue-400 font-mono">{formatMoney(yearTaxReserved)}</td>
              <td className={`px-4 py-2.5 text-right font-mono ${yearRemaining > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatMoney(yearRemaining)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Badge */}
      {yearRemaining > 0 ? (
        <div className="px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
          <Receipt size={16} className="text-yellow-400" />
          <span className="text-sm text-yellow-400">Нужно заплатить: <span className="font-mono font-bold">{formatMoney(yearRemaining)}</span></span>
        </div>
      ) : (
        <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">Все налоги за год оплачены</div>
      )}
    </div>
  );
}
