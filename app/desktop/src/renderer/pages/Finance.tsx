import { useState, useRef, useCallback, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import type { Transaction, SavingsGoal, FinanceSummary, TaskStatus, Student, StudentRate } from '@mark2/shared';
import {
  ArrowDownCircle, ArrowUpCircle, PiggyBank, Receipt, TrendingUp,
  Utensils, Bus, Clapperboard, Smartphone, Home, Package, BookOpen,
  Code, Banknote, Gift, Heart, GraduationCap, Plus, Loader2, Target, Users,
} from 'lucide-react';

// --- Types ---

type SectionId = 'overview' | 'income' | 'expenses' | 'savings' | 'taxes';
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

const PRIORITY_COLORS: Record<Priority, { border: string; badge: string }> = {
  high: { border: 'border-l-red-500', badge: 'bg-red-500/20 text-red-400' },
  medium: { border: 'border-l-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400' },
  low: { border: 'border-l-neutral-600', badge: 'bg-neutral-700/50 text-neutral-400' },
};

const PRIORITY_FROM_INT: Record<number, Priority> = { 0: 'low', 1: 'medium', 2: 'high' };

// --- Helpers ---

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const month = parts[1] ?? '0';
  const day = parts[2] ?? '0';
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10)]}`;
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('ru-RU') + ' \u20BD';
}

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function getMonthLabel(): string {
  const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const now = new Date();
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

function getQuarterDates(): { from: string; to: string; label: string } {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const year = now.getFullYear();
  const from = `${year}-${String(q * 3 + 1).padStart(2, '0')}-01`;
  const toMonth = q * 3 + 3;
  const toDate = new Date(year, toMonth, 0);
  const to = toDate.toISOString().slice(0, 10);
  return { from, to, label: `Q${q + 1} ${year}` };
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
  if (type === 'income') {
    return INCOME_CAT_META[category as IncomeCat] ?? INCOME_CAT_META.other;
  }
  return EXPENSE_CAT_META[category as ExpenseCat] ?? EXPENSE_CAT_META.other;
}

// --- Component ---

export function Finance() {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mark2-finance-sidebar-width');
    if (saved) { const n = parseInt(saved, 10); if (n >= 200 && n <= 400) return n; }
    return Math.min(400, Math.max(200, Math.round(window.innerWidth * 0.2)));
  });
  const isDraggingSidebar = useRef(false);

  // DB state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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

  // Add transaction form
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState<'income' | 'expense'>('expense');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formSubmitting, setFormSubmitting] = useState(false);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 400;
  const month = getCurrentMonth();

  const reloadData = useCallback(async () => {
    try {
      const monthStart = `${month}-01`;
      const parts = month.split('-').map(Number);
      const y = parts[0] ?? 0;
      const m = parts[1] ?? 0;
      const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;

      const [dbTxns, dbSummary, dbGoals, dbTasks, dbStudents] = await Promise.all([
        window.db.transactions.list({ month }),
        window.db.finance.summary(monthStart, `${nextMonth}-01`),
        window.db.finance.savings.list(),
        window.db.tasks.list('finance'),
        window.db.students.list(),
      ]);
      setTransactions(dbTxns);
      setSummary(dbSummary);
      setSavingsGoals(dbGoals);
      setStudents(dbStudents);
      if (dbTasks.length > 0) {
        setFinanceTasks(dbTasks.map((t) => mapDbTaskToFinance(t as unknown as Record<string, unknown>)));
      }

      // Load rates and lesson counts for each student
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
  }, [month]);

  useEffect(() => {
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
      const newStatus = newChecked ? 'done' : 'todo';
      window.db.tasks.update(taskId, { status: newStatus }).catch(() => {});
      return { ...prev, [taskId]: newChecked };
    });
  }, []);

  const handleAddTransaction = useCallback(async () => {
    const amount = parseFloat(formAmount);
    if (!amount || amount <= 0) return;
    setFormSubmitting(true);
    try {
      await window.db.transactions.create({
        type: formType,
        amount,
        category: formCategory || 'other',
        description: formDescription || null,
        date: formDate,
      });
      setShowAddForm(false);
      setFormAmount('');
      setFormCategory('');
      setFormDescription('');
      setFormDate(new Date().toISOString().slice(0, 10));
      reloadData();
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Ошибка создания транзакции');
    } finally {
      setFormSubmitting(false);
    }
  }, [formType, formAmount, formCategory, formDescription, formDate, reloadData]);

  const handleDeleteTransaction = useCallback(async (id: string) => {
    try {
      await window.db.transactions.delete(id);
      reloadData();
    } catch { /* ignore */ }
  }, [reloadData]);

  // Derived data
  const filteredTransactions = studentFilter
    ? transactions.filter((t) => t.studentId === studentFilter)
    : transactions;
  const incomeTransactions = filteredTransactions.filter((t) => t.type === 'income');
  const expenseTransactions = filteredTransactions.filter((t) => t.type === 'expense');

  // Student balance helper
  const getStudentBalance = useCallback((studentId: string): { paid: number; conducted: number; balance: number } => {
    const tutoringTxns = transactions.filter((t) => t.type === 'income' && t.category === 'tutoring' && t.studentId === studentId);
    const totalPaid = tutoringTxns.reduce((s, t) => s + t.amount, 0);
    const rate = studentRates.get(studentId);
    const paidLessons = rate ? Math.floor(totalPaid / rate.ratePerLesson) : 0;
    const conducted = studentLessonCounts.get(studentId) ?? 0;
    return { paid: paidLessons, conducted, balance: paidLessons - conducted };
  }, [transactions, studentRates, studentLessonCounts]);

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
                onClick={() => setActiveSection(s.id)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors ${
                  activeSection === s.id
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </nav>

          {/* Summary cards in sidebar */}
          {summary && (
            <>
              <div className="mt-2"><div className="mx-3 border-t border-neutral-800" /></div>
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  {getMonthLabel()}
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Доход</span>
                    <span className="text-emerald-400 font-mono">{formatMoney(summary.totalIncome)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Расход</span>
                    <span className="text-red-400 font-mono">{formatMoney(summary.totalExpense)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Баланс</span>
                    <span className={`font-mono ${summary.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatMoney(summary.netBalance)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Tasks */}
          {financeTasks.length > 0 && (
            <>
              <div><div className="mx-3 border-t border-neutral-800" /></div>
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Задачи
                </div>
                <div className="space-y-1">
                  {financeTasks.map((task) => {
                    const isDone = taskChecked[task.id] || task.status === 'done';
                    const pColor = PRIORITY_COLORS[task.priority];
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
            </>
          )}

          {/* Students payment status */}
          {students.length > 0 && (
            <>
              <div><div className="mx-3 border-t border-neutral-800" /></div>
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  <Users size={12} /> Ученики
                </div>
                <div className="space-y-0.5">
                  {students.map((s) => {
                    const bal = getStudentBalance(s.id);
                    const rate = studentRates.get(s.id);
                    const isFiltered = studentFilter === s.id;
                    let dotColor = 'bg-neutral-600';
                    if (rate) {
                      if (bal.balance > 0) dotColor = 'bg-emerald-500';
                      else if (bal.balance < 0) dotColor = 'bg-red-500';
                    }
                    return (
                      <button
                        key={s.id}
                        onClick={() => setStudentFilter(isFiltered ? null : s.id)}
                        className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                          isFiltered ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                        <span className="truncate flex-1">{s.name}</span>
                        {rate && (
                          <span className={`text-[10px] font-mono shrink-0 ${
                            bal.balance > 0 ? 'text-emerald-400' : bal.balance < 0 ? 'text-red-400' : 'text-neutral-600'
                          }`}>
                            {bal.balance > 0 ? `+${bal.balance}` : bal.balance < 0 ? String(bal.balance) : '0'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {studentFilter && (
                  <button
                    onClick={() => setStudentFilter(null)}
                    className="mt-1 w-full text-[10px] text-neutral-600 hover:text-neutral-400 text-center py-0.5"
                  >
                    Сбросить фильтр
                  </button>
                )}
              </div>
            </>
          )}

          {/* Recent transactions in sidebar */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="mx-3 border-t border-neutral-800" />
            <div className="px-3 pt-3 pb-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Последние транзакции
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin px-2">
              <div className="space-y-0.5">
                {transactions.slice(0, 15).map((t) => {
                  const isIncome = t.type === 'income';
                  const meta = getCategoryMeta(t.type, t.category);
                  return (
                    <div key={t.id} className="text-xs py-1.5 px-2 rounded hover:bg-neutral-800/50 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-600 text-[10px] shrink-0">{formatDate(t.date)}</span>
                        <span className={`text-[10px] ml-auto font-mono ${isIncome ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                          {isIncome ? '+' : '-'}{formatMoney(t.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px]">{meta.icon}</span>
                        <span className="text-neutral-400 truncate">{t.description ?? meta.label}</span>
                      </div>
                    </div>
                  );
                })}
                {transactions.length === 0 && !loading && (
                  <div className="text-neutral-600 text-xs py-2 text-center">Нет транзакций</div>
                )}
              </div>
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
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="animate-spin text-neutral-500" />
            </div>
          )}
          {dbError && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {dbError}
            </div>
          )}

          {!loading && activeSection === 'overview' && (
            <OverviewMain
              summary={summary}
              transactions={transactions}
              savingsGoals={savingsGoals}
              showAddForm={showAddForm}
              onToggleAddForm={() => setShowAddForm((v) => !v)}
              formType={formType} setFormType={setFormType}
              formAmount={formAmount} setFormAmount={setFormAmount}
              formCategory={formCategory} setFormCategory={setFormCategory}
              formDescription={formDescription} setFormDescription={setFormDescription}
              formDate={formDate} setFormDate={setFormDate}
              formSubmitting={formSubmitting}
              onSubmit={handleAddTransaction}
              onDelete={handleDeleteTransaction}
            />
          )}
          {!loading && activeSection === 'income' && (
            <IncomeMain transactions={incomeTransactions} students={students} studentRates={studentRates} />
          )}
          {!loading && activeSection === 'expenses' && (
            <ExpensesMain transactions={expenseTransactions} onDelete={handleDeleteTransaction} />
          )}
          {!loading && activeSection === 'savings' && (
            <SavingsMain goals={savingsGoals} onReload={reloadData} />
          )}
          {!loading && activeSection === 'taxes' && (
            <TaxMain />
          )}
        </main>
      </div>
    </MainLayout>
  );
}

// --- Overview ---

function OverviewMain({
  summary, transactions, savingsGoals, showAddForm, onToggleAddForm,
  formType, setFormType, formAmount, setFormAmount, formCategory, setFormCategory,
  formDescription, setFormDescription, formDate, setFormDate, formSubmitting, onSubmit, onDelete,
}: {
  summary: FinanceSummary | null;
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  showAddForm: boolean;
  onToggleAddForm: () => void;
  formType: 'income' | 'expense';
  setFormType: (v: 'income' | 'expense') => void;
  formAmount: string; setFormAmount: (v: string) => void;
  formCategory: string; setFormCategory: (v: string) => void;
  formDescription: string; setFormDescription: (v: string) => void;
  formDate: string; setFormDate: (v: string) => void;
  formSubmitting: boolean;
  onSubmit: () => void;
  onDelete: (id: string) => void;
}) {
  const totalSavings = savingsGoals.reduce((s, g) => s + g.currentAmount, 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Обзор</h1>
      <p className="text-neutral-500 text-sm mb-6">{getMonthLabel()}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Доход" amount={summary?.totalIncome ?? 0} color="text-emerald-400" icon={<ArrowUpCircle size={18} />} />
        <SummaryCard label="Расход" amount={summary?.totalExpense ?? 0} color="text-red-400" icon={<ArrowDownCircle size={18} />} />
        <SummaryCard label="Баланс" amount={summary?.netBalance ?? 0} color={
          (summary?.netBalance ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
        } icon={<TrendingUp size={18} />} />
        <SummaryCard label="Накопления" amount={totalSavings} color="text-blue-400" icon={<PiggyBank size={18} />} />
      </div>

      {/* Add button + form */}
      <div className="mb-6">
        <button
          onClick={onToggleAddForm}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300 transition-colors"
        >
          <Plus size={14} /> Добавить транзакцию
        </button>

        {showAddForm && (
          <div className="mt-3 p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setFormType('expense')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  formType === 'expense' ? 'bg-red-500/20 text-red-400' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >Расход</button>
              <button
                onClick={() => setFormType('income')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  formType === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >Доход</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Сумма"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
              />
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">Категория</option>
                {formType === 'expense'
                  ? Object.entries(EXPENSE_CAT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)
                  : Object.entries(INCOME_CAT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)
                }
              </select>
              <input
                type="text"
                placeholder="Описание"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
              />
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={onSubmit}
                disabled={formSubmitting || !formAmount}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm text-white transition-colors"
              >
                {formSubmitting ? 'Сохраняю...' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">
          Последние транзакции
        </h2>
        <div className="space-y-1">
          {transactions.slice(0, 10).map((t) => (
            <TransactionRow key={t.id} transaction={t} onDelete={onDelete} />
          ))}
          {transactions.length === 0 && (
            <div className="text-neutral-600 text-sm py-4 text-center">Нет транзакций за этот месяц</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, amount, color, icon }: { label: string; amount: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center gap-2 text-neutral-500 text-xs mb-2">
        {icon} {label}
      </div>
      <div className={`text-xl font-bold font-mono ${color}`}>{formatMoney(amount)}</div>
    </div>
  );
}

function TransactionRow({ transaction: t, onDelete }: { transaction: Transaction; onDelete: (id: string) => void }) {
  const isIncome = t.type === 'income';
  const isSavings = t.type === 'savings';
  const isTax = t.type === 'tax';
  const meta = getCategoryMeta(t.type, t.category);

  let amountColor = 'text-red-400';
  let prefix = '-';
  if (isIncome) { amountColor = 'text-emerald-400'; prefix = '+'; }
  if (isSavings) { amountColor = 'text-blue-400'; prefix = ''; }
  if (isTax) { amountColor = 'text-yellow-400'; prefix = '-'; }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-neutral-800/30 transition-colors group">
      <span className="text-sm shrink-0">{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-neutral-300">{t.description ?? meta.label}</span>
        <div className="text-[11px] text-neutral-600 mt-0.5">
          {formatDate(t.date)}
          <span className={`ml-2 px-1 py-0.5 rounded text-[10px] ${meta.color}`}>
            {meta.label}
          </span>
        </div>
      </div>
      <span className={`text-sm font-mono shrink-0 ${amountColor}`}>
        {prefix}{formatMoney(t.amount)}
      </span>
      <button
        onClick={() => onDelete(t.id)}
        className="text-neutral-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
        title="Удалить"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// --- Income ---

function IncomeMain({ transactions, students, studentRates }: {
  transactions: Transaction[];
  students: Student[];
  studentRates: Map<string, StudentRate>;
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

  // Students with tutoring income
  const tutoringStudents = [...new Set(transactions.filter((t) => t.category === 'tutoring' && t.studentId).map((t) => t.studentId!))];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Доходы</h1>
      <p className="text-neutral-500 text-sm mb-6">{getMonthLabel()}</p>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6">
        <div className="text-3xl font-bold text-emerald-400 font-mono">{formatMoney(total)}</div>
        <div className="text-xs text-neutral-500 mt-1">{filtered.length} поступлений</div>
        <div className="flex flex-wrap gap-2 mt-4">
          {byCategory.map((g) => (
            <div key={g.category} className="flex items-center gap-1.5">
              <span className={`text-xs px-2 py-1 rounded font-medium ${INCOME_CAT_META[g.category].color}`}>
                {INCOME_CAT_META[g.category].icon} {INCOME_CAT_META[g.category].label}
              </span>
              <span className="text-xs text-neutral-400">{formatMoney(g.total)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1 mb-2">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Все</FilterButton>
        {(Object.entries(INCOME_CAT_META) as [IncomeCat, typeof INCOME_CAT_META[IncomeCat]][]).map(([k, v]) => (
          <FilterButton key={k} active={filter === k} onClick={() => setFilter(k)}>
            {v.icon} {v.label}
          </FilterButton>
        ))}
      </div>

      {/* Student filter for tutoring */}
      {(filter === 'all' || filter === 'tutoring') && tutoringStudents.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          <span className="text-[10px] text-neutral-600 self-center mr-1">Ученик:</span>
          <FilterButton active={!studentFilter} onClick={() => setStudentFilter(null)}>Все</FilterButton>
          {tutoringStudents.map((sid) => (
            <FilterButton key={sid} active={studentFilter === sid} onClick={() => setStudentFilter(sid)}>
              {studentMap.get(sid) ?? sid}
            </FilterButton>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {filtered.map((t) => {
          const meta = INCOME_CAT_META[t.category as IncomeCat] ?? INCOME_CAT_META.other;
          const isTutoring = t.category === 'tutoring';
          const studentName = t.studentId ? studentMap.get(t.studentId) : null;
          const rate = t.studentId ? studentRates.get(t.studentId) : null;
          const lessonsCount = rate ? Math.round(t.amount / rate.ratePerLesson) : null;

          return (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-neutral-800/30 transition-colors">
              <span className="text-sm shrink-0">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-neutral-300">{t.description ?? meta.label}</span>
                <div className="text-[11px] text-neutral-600 mt-0.5">
                  {formatDate(t.date)}
                  <span className={`ml-2 px-1 py-0.5 rounded text-[10px] ${meta.color}`}>{meta.label}</span>
                  {isTutoring && studentName && (
                    <span className="ml-2 text-blue-400/70">{studentName}</span>
                  )}
                  {isTutoring && lessonsCount !== null && lessonsCount > 0 && (
                    <span className="ml-1 text-neutral-600">({lessonsCount} ур.)</span>
                  )}
                </div>
              </div>
              <span className="text-sm text-emerald-400 font-mono shrink-0">+{formatMoney(t.amount)}</span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-neutral-600 text-sm py-4 text-center">Нет доходов</div>
        )}
      </div>
    </div>
  );
}

// --- Expenses ---

function ExpensesMain({ transactions, onDelete }: { transactions: Transaction[]; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState<ExpenseCat | 'all'>('all');
  const filtered = filter === 'all' ? transactions : transactions.filter((t) => t.category === filter);
  const total = filtered.reduce((s, t) => s + t.amount, 0);
  const overallTotal = transactions.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Расходы</h1>
      <p className="text-neutral-500 text-sm mb-6">{getMonthLabel()}</p>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-red-400 font-mono">{formatMoney(total)}</span>
          {filter !== 'all' && (
            <span className="text-sm text-neutral-500">из {formatMoney(overallTotal)} общих</span>
          )}
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          {filtered.length} транзакций
          {filter !== 'all' && ` — ${EXPENSE_CAT_META[filter].label}`}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Все</FilterButton>
        {(Object.entries(EXPENSE_CAT_META) as [ExpenseCat, typeof EXPENSE_CAT_META[ExpenseCat]][]).map(([k, v]) => (
          <FilterButton key={k} active={filter === k} onClick={() => setFilter(k)}>
            {v.icon} {v.label}
          </FilterButton>
        ))}
      </div>

      <div className="space-y-1">
        {filtered.map((t) => (
          <TransactionRow key={t.id} transaction={t} onDelete={onDelete} />
        ))}
        {filtered.length === 0 && (
          <div className="text-neutral-600 text-sm py-4 text-center">Нет расходов</div>
        )}
      </div>
    </div>
  );
}

// --- Savings ---

function SavingsMain({ goals, onReload }: { goals: SavingsGoal[]; onReload: () => void }) {
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');

  const handleDeposit = async (goalId: string) => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;
    setSubmitting(true);
    try {
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return;
      await window.db.finance.savings.update(goalId, {
        currentAmount: goal.currentAmount + amount,
      });
      // Create savings transaction
      await window.db.transactions.create({
        type: 'savings',
        amount,
        category: 'savings_deposit',
        description: `Пополнение: ${goal.name}`,
        date: new Date().toISOString().slice(0, 10),
      });
      setDepositGoalId(null);
      setDepositAmount('');
      onReload();
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  const handleCreateGoal = async () => {
    if (!newGoalName) return;
    setSubmitting(true);
    try {
      await window.db.finance.savings.create({
        name: newGoalName,
        targetAmount: newGoalTarget ? parseFloat(newGoalTarget) : null,
      });
      setShowNewGoal(false);
      setNewGoalName('');
      setNewGoalTarget('');
      onReload();
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Накопления</h1>
      <p className="text-neutral-500 text-sm mb-6">Цели и прогресс</p>

      <div className="space-y-4">
        {goals.map((goal) => {
          const pct = goal.targetAmount ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : null;
          return (
            <div key={goal.id} className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-blue-400" />
                  <span className="text-sm font-medium text-neutral-200">{goal.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    goal.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                    goal.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-neutral-700/50 text-neutral-400'
                  }`}>{goal.status}</span>
                </div>
                <button
                  onClick={() => setDepositGoalId(depositGoalId === goal.id ? null : goal.id)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Пополнить
                </button>
              </div>

              {pct !== null && (
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              <div className="flex justify-between text-xs text-neutral-500">
                <span className="font-mono">{formatMoney(goal.currentAmount)}</span>
                {goal.targetAmount && (
                  <span>
                    из {formatMoney(goal.targetAmount)} ({pct}%)
                  </span>
                )}
              </div>

              {depositGoalId === goal.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    placeholder="Сумма"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleDeposit(goal.id)}
                    disabled={submitting}
                    className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm text-white transition-colors"
                  >
                    {submitting ? '...' : 'OK'}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {goals.length === 0 && (
          <div className="text-neutral-600 text-sm py-4 text-center">Нет целей накоплений</div>
        )}
      </div>

      {/* New goal */}
      <div className="mt-4">
        {!showNewGoal ? (
          <button
            onClick={() => setShowNewGoal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300 transition-colors"
          >
            <Plus size={14} /> Новая цель
          </button>
        ) : (
          <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Название цели"
                value={newGoalName}
                onChange={(e) => setNewGoalName(e.target.value)}
                className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
              />
              <input
                type="number"
                placeholder="Целевая сумма (опц.)"
                value={newGoalTarget}
                onChange={(e) => setNewGoalTarget(e.target.value)}
                className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowNewGoal(false)} className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200">
                Отмена
              </button>
              <button
                onClick={handleCreateGoal}
                disabled={submitting || !newGoalName}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm text-white transition-colors"
              >
                Создать
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Taxes ---

function TaxMain() {
  const [quarterSummary, setQuarterSummary] = useState<FinanceSummary | null>(null);
  const [yearSummary, setYearSummary] = useState<FinanceSummary | null>(null);
  const [taxTransactions, setTaxTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const q = getQuarterDates();
        const year = new Date().getFullYear();
        const [qSum, ySum, taxTxns] = await Promise.all([
          window.db.finance.summary(q.from, q.to),
          window.db.finance.summary(`${year}-01-01`, `${year}-12-31`),
          window.db.transactions.list({ type: 'tax' }),
        ]);
        setQuarterSummary(qSum);
        setYearSummary(ySum);
        setTaxTransactions(taxTxns);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <Loader2 size={24} className="animate-spin text-neutral-500" />;

  const q = getQuarterDates();
  const quarterIncome = quarterSummary?.totalIncome ?? 0;
  const yearIncome = yearSummary?.totalIncome ?? 0;

  // Self-employed tax rates
  const tax4pct = Math.round(quarterIncome * 0.04);
  const tax6pct = Math.round(quarterIncome * 0.06);
  const taxReserved = taxTransactions
    .filter((t) => t.category === 'tax_reserve')
    .reduce((s, t) => s + t.amount, 0);
  const taxPaid = taxTransactions
    .filter((t) => t.category === 'tax_payment')
    .reduce((s, t) => s + t.amount, 0);

  const needToPay = tax4pct - taxPaid;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Налоги</h1>
      <p className="text-neutral-500 text-sm mb-6">Самозанятый — {q.label}</p>

      {/* Tax summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <div className="text-xs text-neutral-500 mb-1">Доход за квартал ({q.label})</div>
          <div className="text-xl font-bold font-mono text-neutral-200">{formatMoney(quarterIncome)}</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <div className="text-xs text-neutral-500 mb-1">Доход за год</div>
          <div className="text-xl font-bold font-mono text-neutral-200">{formatMoney(yearIncome)}</div>
        </div>
      </div>

      {/* Tax calculation */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-semibold text-neutral-400 mb-4">Расчёт налога</h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Ставка 4% (физлица)</span>
            <span className="text-yellow-400 font-mono">{formatMoney(tax4pct)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Ставка 6% (юрлица)</span>
            <span className="text-yellow-400 font-mono">{formatMoney(tax6pct)}</span>
          </div>
          <div className="border-t border-neutral-800 pt-3 flex justify-between text-sm">
            <span className="text-neutral-400">Зарезервировано</span>
            <span className="text-blue-400 font-mono">{formatMoney(taxReserved)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400">Оплачено</span>
            <span className="text-emerald-400 font-mono">{formatMoney(taxPaid)}</span>
          </div>
        </div>

        {needToPay > 0 && (
          <div className="mt-4 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
            <Receipt size={16} className="text-yellow-400" />
            <span className="text-sm text-yellow-400">
              Нужно заплатить: <span className="font-mono font-bold">{formatMoney(needToPay)}</span>
            </span>
          </div>
        )}
        {needToPay <= 0 && (
          <div className="mt-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
            Налоги за квартал оплачены
          </div>
        )}
      </div>

      {/* Tax transactions */}
      {taxTransactions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">
            Налоговые операции
          </h2>
          <div className="space-y-1">
            {taxTransactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded hover:bg-neutral-800/30 transition-colors">
                <Receipt size={14} className="text-yellow-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-neutral-300">{t.description ?? (t.category === 'tax_payment' ? 'Оплата налога' : 'Резерв на налоги')}</span>
                  <div className="text-[11px] text-neutral-600 mt-0.5">{formatDate(t.date)}</div>
                </div>
                <span className="text-sm text-yellow-400 font-mono shrink-0">{formatMoney(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Shared UI ---

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-neutral-700 text-white'
          : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
      }`}
    >
      {children}
    </button>
  );
}
