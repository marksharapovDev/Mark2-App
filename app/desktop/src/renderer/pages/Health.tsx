import { useState, useRef, useCallback, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import type { TaskStatus } from '@mark2/shared';
import { Dumbbell, UtensilsCrossed, BarChart3, Moon, PersonStanding, Waves, CheckCircle2, Clock, Star, Loader2 } from 'lucide-react';

// --- Types ---

type WorkoutType = 'gym' | 'run' | 'swim';
type WorkoutStatus = 'done' | 'planned';
type SectionId = 'workouts' | 'nutrition' | 'stats' | 'sleep';
type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';
type Feeling = 1 | 2 | 3 | 4 | 5;
type Priority = 'low' | 'medium' | 'high';

interface Exercise {
  name: string;
  sets: number;
  reps: number;
  weight?: number;
}

interface Workout {
  id: string;
  date: string;
  type: WorkoutType;
  label: string;
  duration: number; // minutes
  status: WorkoutStatus;
  exercises?: Exercise[];
  notes?: string;
  feeling?: Feeling;
  distance?: number; // km
  pace?: string; // min/km
}

interface Meal {
  id: string;
  slot: MealSlot;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface DayNutrition {
  date: string;
  meals: Meal[];
  targetCalories: number;
  targetProtein: number;
  targetFat: number;
  targetCarbs: number;
}

interface HealthTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  context: string;
  deadline: string | null;
}

// --- Constants ---

const SECTIONS: Array<{ id: SectionId; icon: React.ReactNode; label: string }> = [
  { id: 'workouts', icon: <Dumbbell size={16} strokeWidth={1.5} />, label: 'Тренировки' },
  { id: 'nutrition', icon: <UtensilsCrossed size={16} strokeWidth={1.5} />, label: 'Питание' },
  { id: 'stats', icon: <BarChart3 size={16} strokeWidth={1.5} />, label: 'Статистика' },
  { id: 'sleep', icon: <Moon size={16} strokeWidth={1.5} />, label: 'Сон/восстановление' },
];

const WORKOUT_TYPE_META: Record<WorkoutType, { icon: React.ReactNode; label: string; color: string }> = {
  gym: { icon: <Dumbbell size={14} strokeWidth={1.5} />, label: 'Зал', color: 'bg-blue-900/40 text-blue-300' },
  run: { icon: <PersonStanding size={14} strokeWidth={1.5} />, label: 'Бег', color: 'bg-green-900/40 text-green-300' },
  swim: { icon: <Waves size={14} strokeWidth={1.5} />, label: 'Плавание', color: 'bg-cyan-900/40 text-cyan-300' },
};

const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  snack: 'Перекус',
  dinner: 'Ужин',
};

const FEELING_LABELS = ['', 'Ужасно', 'Плохо', 'Нормально', 'Хорошо', 'Отлично'];

const PRIORITY_COLORS: Record<Priority, { border: string; badge: string; label: string }> = {
  high: { border: 'border-l-red-500', badge: 'bg-red-500/20 text-red-400', label: 'High' },
  medium: { border: 'border-l-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400', label: 'Medium' },
  low: { border: 'border-l-neutral-600', badge: 'bg-neutral-700/50 text-neutral-400', label: 'Low' },
};

// --- Mock Data ---

const MOCK_WORKOUTS: Workout[] = [
  {
    id: 'w1',
    date: '2026-03-20',
    type: 'gym',
    label: 'Грудь + трицепс',
    duration: 65,
    status: 'done',
    exercises: [
      { name: 'Жим лёжа', sets: 4, reps: 10, weight: 60 },
      { name: 'Разводка гантелей', sets: 3, reps: 12, weight: 14 },
      { name: 'Французский жим', sets: 3, reps: 12, weight: 20 },
      { name: 'Отжимания на брусьях', sets: 3, reps: 15 },
    ],
    notes: 'Хорошая тренировка, жим пошёл легко. Увеличить вес на следующей.',
    feeling: 4,
  },
  {
    id: 'w2',
    date: '2026-03-18',
    type: 'run',
    label: 'Лёгкий бег',
    duration: 28,
    status: 'done',
    distance: 5,
    pace: '5:36',
    notes: 'Бегал в парке, погода отличная.',
    feeling: 5,
  },
  {
    id: 'w3',
    date: '2026-03-16',
    type: 'gym',
    label: 'Спина + бицепс',
    duration: 70,
    status: 'done',
    exercises: [
      { name: 'Подтягивания', sets: 4, reps: 8 },
      { name: 'Тяга штанги в наклоне', sets: 4, reps: 10, weight: 50 },
      { name: 'Тяга верхнего блока', sets: 3, reps: 12, weight: 45 },
      { name: 'Сгибания на бицепс', sets: 3, reps: 12, weight: 12 },
    ],
    feeling: 4,
  },
  {
    id: 'w4',
    date: '2026-03-14',
    type: 'gym',
    label: 'Ноги',
    duration: 60,
    status: 'done',
    exercises: [
      { name: 'Приседания со штангой', sets: 4, reps: 10, weight: 70 },
      { name: 'Жим ногами', sets: 3, reps: 12, weight: 120 },
      { name: 'Выпады с гантелями', sets: 3, reps: 10, weight: 16 },
      { name: 'Подъёмы на носки', sets: 4, reps: 15, weight: 40 },
    ],
    feeling: 3,
    notes: 'Тяжело далось, ноги гудят.',
  },
  {
    id: 'w5',
    date: '2026-03-12',
    type: 'run',
    label: 'Интервалы',
    duration: 35,
    status: 'done',
    distance: 6,
    pace: '5:50',
    feeling: 4,
  },
  {
    id: 'w6',
    date: '2026-03-10',
    type: 'gym',
    label: 'Грудь + плечи',
    duration: 55,
    status: 'done',
    exercises: [
      { name: 'Жим лёжа', sets: 4, reps: 10, weight: 55 },
      { name: 'Жим гантелей сидя', sets: 3, reps: 10, weight: 16 },
      { name: 'Разведения в стороны', sets: 3, reps: 12, weight: 10 },
    ],
    feeling: 4,
  },
  {
    id: 'w7',
    date: '2026-03-08',
    type: 'swim',
    label: 'Свободное плавание',
    duration: 45,
    status: 'done',
    distance: 1.5,
    notes: 'Бассейн 25м, кроль + брасс.',
    feeling: 5,
  },
  {
    id: 'w8',
    date: '2026-03-07',
    type: 'gym',
    label: 'Спина + бицепс',
    duration: 65,
    status: 'done',
    exercises: [
      { name: 'Подтягивания', sets: 4, reps: 8 },
      { name: 'Тяга гантели в наклоне', sets: 3, reps: 10, weight: 22 },
      { name: 'Молотковые сгибания', sets: 3, reps: 12, weight: 14 },
    ],
    feeling: 4,
  },
  // Planned
  {
    id: 'w9',
    date: '2026-03-22',
    type: 'gym',
    label: 'Плечи + пресс',
    duration: 60,
    status: 'planned',
    exercises: [
      { name: 'Армейский жим', sets: 4, reps: 10, weight: 35 },
      { name: 'Разведения в стороны', sets: 3, reps: 12, weight: 10 },
      { name: 'Скручивания', sets: 4, reps: 20 },
      { name: 'Планка', sets: 3, reps: 60 },
    ],
  },
  {
    id: 'w10',
    date: '2026-03-24',
    type: 'run',
    label: 'Длинный бег',
    duration: 42,
    status: 'planned',
    distance: 7,
  },
];

const TODAY_NUTRITION: DayNutrition = {
  date: '2026-03-21',
  targetCalories: 2500,
  targetProtein: 180,
  targetFat: 80,
  targetCarbs: 280,
  meals: [
    { id: 'meal1', slot: 'breakfast', name: 'Овсянка + банан + протеин', calories: 450, protein: 35, fat: 12, carbs: 58 },
    { id: 'meal2', slot: 'lunch', name: 'Курица + рис + овощи', calories: 650, protein: 45, fat: 18, carbs: 72 },
    { id: 'meal3', slot: 'snack', name: 'Творог + орехи', calories: 300, protein: 28, fat: 15, carbs: 12 },
  ],
};

const WEEKLY_CALORIES = [2100, 2400, 1900, 2600, 2300, 2200, 1850];
const WEEKLY_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const PAST_DAYS_NUTRITION: Array<{ date: string; calories: number; status: string }> = [
  { date: '2026-03-20', calories: 2200, status: 'Норма' },
  { date: '2026-03-19', calories: 2300, status: 'Норма' },
  { date: '2026-03-18', calories: 2600, status: 'Перебор' },
  { date: '2026-03-17', calories: 1900, status: 'Дефицит' },
  { date: '2026-03-16', calories: 2400, status: 'Норма' },
  { date: '2026-03-15', calories: 2100, status: 'Дефицит' },
];

const MOCK_HEALTH_TASKS: HealthTask[] = [
  {
    id: 'ht1',
    title: 'Сходить в зал — грудь+трицепс',
    status: 'todo',
    priority: 'high',
    context: 'Тренировка на грудь и трицепс, увеличить вес в жиме',
    deadline: '2026-03-22',
  },
  {
    id: 'ht2',
    title: 'Пробежать 7км',
    status: 'todo',
    priority: 'medium',
    context: 'Длинный бег в парке, целевой темп 5:30',
    deadline: '2026-03-24',
  },
  {
    id: 'ht3',
    title: 'Купить протеин',
    status: 'todo',
    priority: 'low',
    context: 'Заказать сывороточный протеин, шоколадный вкус',
    deadline: null,
  },
];

const WEEKLY_WORKOUTS = [3, 4, 3, 2]; // workouts per week
const WEEKLY_WORKOUT_LABELS = ['1-7 мар', '8-14 мар', '15-21 мар', '22-28 мар'];
const WEIGHT_PROGRESS = [
  { week: '24 фев', weight: 78.0 },
  { week: '3 мар', weight: 77.5 },
  { week: '10 мар', weight: 77.2 },
  { week: '17 мар', weight: 76.8 },
  { week: '21 мар', weight: 76.5 },
];

// --- DB Mappers ---

const PRIORITY_FROM_INT: Record<number, Priority> = { 0: 'low', 1: 'medium', 2: 'high' };

function mapDbWorkoutToLocal(w: Record<string, unknown>): Workout {
  return {
    id: String(w.id),
    date: w.date ? String(w.date) : new Date().toISOString().slice(0, 10),
    type: (w.type as WorkoutType) ?? 'gym',
    label: String((w.notes as string) ?? (w.type as string) ?? 'Тренировка'),
    duration: (w.duration as number) ?? 0,
    status: 'done',
    exercises: Array.isArray(w.exercises) ? (w.exercises as Exercise[]) : undefined,
    notes: w.notes ? String(w.notes) : undefined,
  };
}

function mapDbTaskToHealth(t: Record<string, unknown>): HealthTask {
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

// --- Helpers ---

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const month = parts[1] ?? '0';
  const day = parts[2] ?? '0';
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10)]}`;
}

function totalCalories(meals: Meal[]): number {
  return meals.reduce((s, m) => s + m.calories, 0);
}

function totalMacro(meals: Meal[], key: 'protein' | 'fat' | 'carbs'): number {
  return meals.reduce((s, m) => s + m[key], 0);
}

// --- Views ---

type MainView =
  | { kind: 'workouts-overview' }
  | { kind: 'workout-detail'; workoutId: string }
  | { kind: 'nutrition-overview' }
  | { kind: 'stats-dashboard' }
  | { kind: 'sleep-overview' };

// --- Component ---

export function Health() {
  const [activeSection, setActiveSection] = useState<SectionId>('workouts');
  const [mainView, setMainView] = useState<MainView>({ kind: 'workouts-overview' });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mark2-sidebar-width');
    if (saved) { const n = parseInt(saved, 10); if (n >= 200 && n <= 400) return n; }
    return Math.min(400, Math.max(200, Math.round(window.innerWidth * 0.2)));
  });
  const isDraggingSidebar = useRef(false);
  const [taskChecked, setTaskChecked] = useState<Record<string, boolean>>({});

  // DB state
  const [workouts, setWorkouts] = useState<Workout[]>(MOCK_WORKOUTS);
  const [healthTasks, setHealthTasks] = useState<HealthTask[]>(MOCK_HEALTH_TASKS);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 400;

  // Load data from DB
  const reloadData = useCallback(async () => {
    try {
      const [dbWorkouts, dbTasks] = await Promise.all([
        window.db.workouts.list(),
        window.db.tasks.list('health'),
      ]);
      if (dbWorkouts.length > 0 || dbTasks.length > 0) {
        if (dbWorkouts.length > 0) {
          setWorkouts(dbWorkouts.map((w) => mapDbWorkoutToLocal(w as unknown as Record<string, unknown>)));
        }
        if (dbTasks.length > 0) {
          setHealthTasks(dbTasks.map((t) => mapDbTaskToHealth(t as unknown as Record<string, unknown>)));
        }
        setIsDemo(false);
      } else {
        setIsDemo(true);
      }
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Ошибка подключения к БД');
      setIsDemo(true);
    }
  }, []);

  // Initial load
  useEffect(() => {
    reloadData().finally(() => setLoading(false));
  }, [reloadData]);

  // Reload on data-changed from AI
  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('tasks') || entities.includes('workouts')) {
        reloadData();
      }
    });
  }, [reloadData]);

  const selectSection = useCallback((id: SectionId) => {
    setActiveSection(id);
    switch (id) {
      case 'workouts': setMainView({ kind: 'workouts-overview' }); break;
      case 'nutrition': setMainView({ kind: 'nutrition-overview' }); break;
      case 'stats': setMainView({ kind: 'stats-dashboard' }); break;
      case 'sleep': setMainView({ kind: 'sleep-overview' }); break;
    }
  }, []);

  const toggleTaskChecked = useCallback((taskId: string) => {
    setTaskChecked((prev) => {
      const newChecked = !prev[taskId];
      if (!isDemo) {
        const newStatus = newChecked ? 'done' : 'todo';
        window.db.tasks.update(taskId, { status: newStatus }).catch(() => {});
      }
      return { ...prev, [taskId]: newChecked };
    });
  }, [isDemo]);

  const getEffectiveStatus = useCallback((task: HealthTask): TaskStatus => {
    if (taskChecked[task.id]) return 'done';
    return task.status;
  }, [taskChecked]);

  const sendTaskToChat = useCallback((task: HealthTask) => {
    const text = `Выполни задачу: ${task.title}\n${task.context}`;
    const inputEl = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Message..."]');
    if (inputEl) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(inputEl, text);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.focus();
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

  const doneWorkouts = workouts.filter((w) => w.status === 'done');
  const plannedWorkouts = workouts.filter((w) => w.status === 'planned');

  return (
    <MainLayout agent="health" noPadding defaultChatWidthPct={30}>
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

          <div className="mx-3 border-t border-neutral-800 mt-2" />

          {/* Tasks */}
          <div className="px-3 pt-3 pb-2">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
              Задачи
            </div>
            <div className="space-y-1">
              {healthTasks.map((task) => {
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
              {activeSection === 'workouts' && (
                <WorkoutsSidebar
                  doneWorkouts={doneWorkouts}
                  plannedWorkouts={plannedWorkouts}
                  onWorkoutClick={(id) => setMainView({ kind: 'workout-detail', workoutId: id })}
                />
              )}
              {activeSection === 'nutrition' && <NutritionSidebar />}
              {activeSection === 'stats' && (
                <div className="px-3 pt-3 pb-2 text-xs text-neutral-500">
                  Выберите период в основной области
                </div>
              )}
              {activeSection === 'sleep' && (
                <div className="px-3 pt-3 pb-2 text-xs text-neutral-500">
                  Данные сна/восстановления
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
          {isDemo && !loading && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
              Demo data — БД недоступна или пуста
            </div>
          )}
          {!loading && mainView.kind === 'workouts-overview' && (
            <WorkoutsOverview
              doneWorkouts={doneWorkouts}
              plannedWorkouts={plannedWorkouts}
              onWorkoutClick={(id) => setMainView({ kind: 'workout-detail', workoutId: id })}
            />
          )}
          {!loading && mainView.kind === 'workout-detail' && (
            <WorkoutDetailView
              workout={workouts.find((w) => w.id === mainView.workoutId)}
              onBack={() => setMainView({ kind: 'workouts-overview' })}
            />
          )}
          {!loading && mainView.kind === 'nutrition-overview' && <NutritionOverview />}
          {!loading && mainView.kind === 'stats-dashboard' && <StatsDashboard />}
          {!loading && mainView.kind === 'sleep-overview' && <SleepOverview />}
        </main>
      </div>
    </MainLayout>
  );
}

// --- Sidebar sub-components ---

function WorkoutsSidebar({
  doneWorkouts,
  plannedWorkouts,
  onWorkoutClick,
}: {
  doneWorkouts: Workout[];
  plannedWorkouts: Workout[];
  onWorkoutClick: (id: string) => void;
}) {
  return (
    <>
      {/* Planned */}
      {plannedWorkouts.length > 0 && (
        <div className="px-3 pt-3 pb-2">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Запланировано
          </div>
          <div className="space-y-1">
            {plannedWorkouts.map((w) => (
              <button
                key={w.id}
                onClick={() => onWorkoutClick(w.id)}
                className="w-full text-left text-xs py-1.5 px-2 rounded hover:bg-neutral-800/50 transition-colors group"
              >
                <div className="flex items-center gap-1.5">
                  <Clock size={12} strokeWidth={1.5} className="shrink-0 text-neutral-500" />
                  <span className="text-neutral-600 text-[10px] shrink-0">{formatDate(w.date)}</span>
                  <span className={`text-[10px] px-1 py-0.5 rounded ${WORKOUT_TYPE_META[w.type].color}`}>
                    {WORKOUT_TYPE_META[w.type].label}
                  </span>
                </div>
                <div className="text-neutral-400 group-hover:text-neutral-200 transition-colors mt-0.5 truncate">
                  {w.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mx-3 border-t border-neutral-800" />

      {/* Done */}
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Последние тренировки
        </div>
        <div className="space-y-0.5">
          {doneWorkouts.map((w) => (
            <button
              key={w.id}
              onClick={() => onWorkoutClick(w.id)}
              className="w-full text-left text-xs py-1.5 px-2 rounded hover:bg-neutral-800/50 transition-colors group"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} strokeWidth={1.5} className="shrink-0 text-emerald-400" />
                <span className="text-neutral-600 text-[10px] shrink-0">{formatDate(w.date)}</span>
                <span className={`text-[10px] px-1 py-0.5 rounded ${WORKOUT_TYPE_META[w.type].color}`}>
                  {WORKOUT_TYPE_META[w.type].label}
                </span>
                <span className="text-neutral-600 text-[10px] ml-auto">{w.duration} мин</span>
              </div>
              <div className="text-neutral-400 group-hover:text-neutral-200 transition-colors mt-0.5 truncate">
                {w.label}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function NutritionSidebar() {
  const cals = totalCalories(TODAY_NUTRITION.meals);
  const maxCal = Math.max(...WEEKLY_CALORIES);

  return (
    <>
      {/* Today summary */}
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Сегодня
        </div>
        <div className="space-y-2">
          {/* Calories */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-neutral-400">Калории</span>
              <span className="text-neutral-300">{cals} / {TODAY_NUTRITION.targetCalories}</span>
            </div>
            <ProgressBar value={cals} max={TODAY_NUTRITION.targetCalories} color="bg-orange-500" />
          </div>
          {/* Protein */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-neutral-400">Белки</span>
              <span className="text-neutral-300">{totalMacro(TODAY_NUTRITION.meals, 'protein')}г / {TODAY_NUTRITION.targetProtein}г</span>
            </div>
            <ProgressBar value={totalMacro(TODAY_NUTRITION.meals, 'protein')} max={TODAY_NUTRITION.targetProtein} color="bg-red-500" />
          </div>
          {/* Fat */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-neutral-400">Жиры</span>
              <span className="text-neutral-300">{totalMacro(TODAY_NUTRITION.meals, 'fat')}г / {TODAY_NUTRITION.targetFat}г</span>
            </div>
            <ProgressBar value={totalMacro(TODAY_NUTRITION.meals, 'fat')} max={TODAY_NUTRITION.targetFat} color="bg-yellow-500" />
          </div>
          {/* Carbs */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-neutral-400">Углеводы</span>
              <span className="text-neutral-300">{totalMacro(TODAY_NUTRITION.meals, 'carbs')}г / {TODAY_NUTRITION.targetCarbs}г</span>
            </div>
            <ProgressBar value={totalMacro(TODAY_NUTRITION.meals, 'carbs')} max={TODAY_NUTRITION.targetCarbs} color="bg-blue-500" />
          </div>
        </div>
      </div>

      <div className="mx-3 border-t border-neutral-800" />

      {/* Past days */}
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Последние дни
        </div>
        <div className="space-y-1">
          {PAST_DAYS_NUTRITION.map((d) => (
            <div key={d.date} className="flex items-center gap-2 text-xs py-0.5">
              <span className="text-neutral-600 text-[10px] shrink-0">{formatDate(d.date)}</span>
              <span className="text-neutral-400">{d.calories} ккал</span>
              <span className={`text-[10px] ml-auto ${
                d.status === 'Норма' ? 'text-emerald-400' :
                d.status === 'Перебор' ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {d.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-3 border-t border-neutral-800" />

      {/* Mini calories chart */}
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Калории за неделю
        </div>
        <div className="flex items-end gap-1 h-16">
          {WEEKLY_CALORIES.map((cal, i) => {
            const height = (cal / maxCal) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={`w-full rounded-t transition-all ${
                    cal > TODAY_NUTRITION.targetCalories
                      ? 'bg-red-500/60'
                      : cal < 2000
                        ? 'bg-yellow-500/60'
                        : 'bg-emerald-500/60'
                  }`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[9px] text-neutral-600">{WEEKLY_DAYS[i]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// --- Progress Bar ---

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// --- Main content sub-components ---

function WorkoutsOverview({
  doneWorkouts,
  plannedWorkouts,
  onWorkoutClick,
}: {
  doneWorkouts: Workout[];
  plannedWorkouts: Workout[];
  onWorkoutClick: (id: string) => void;
}) {
  // This week stats (last 7 days)
  const weekWorkouts = doneWorkouts.filter((w) => {
    const d = new Date(w.date);
    const now = new Date('2026-03-21');
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });
  const weekTotalTime = weekWorkouts.reduce((s, w) => s + w.duration, 0);
  const lastWorkout = doneWorkouts[0];
  const nextPlanned = plannedWorkouts[0];

  return (
    <div className="max-w-2xl">
      {/* Week summary card */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Текущая неделя
        </h2>
        <div className="flex gap-4">
          <div>
            <div className="text-3xl font-bold text-neutral-200">{weekWorkouts.length}</div>
            <div className="text-[11px] text-neutral-500 uppercase">тренировок</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-neutral-200">{weekTotalTime}</div>
            <div className="text-[11px] text-neutral-500 uppercase">минут</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-neutral-200">
              {weekWorkouts.filter((w) => w.type === 'gym').length}
            </div>
            <div className="text-[11px] text-neutral-500 uppercase">зал</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-neutral-200">
              {weekWorkouts.filter((w) => w.type === 'run').length}
            </div>
            <div className="text-[11px] text-neutral-500 uppercase">бег</div>
          </div>
        </div>
      </div>

      {/* Next planned */}
      {nextPlanned && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-3">Ближайшая тренировка</h2>
          <button
            onClick={() => onWorkoutClick(nextPlanned.id)}
            className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-3 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
          >
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${WORKOUT_TYPE_META[nextPlanned.type].color}`}>
                {WORKOUT_TYPE_META[nextPlanned.type].icon} {WORKOUT_TYPE_META[nextPlanned.type].label}
              </span>
              <span className="text-sm text-neutral-300">{nextPlanned.label}</span>
              <span className="text-neutral-600 text-xs ml-auto">{formatDate(nextPlanned.date)}</span>
            </div>
            {nextPlanned.exercises && (
              <div className="mt-2 text-xs text-neutral-500">
                {nextPlanned.exercises.map((e) => e.name).join(', ')}
              </div>
            )}
          </button>
        </div>
      )}

      {/* Last workout with details */}
      {lastWorkout && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-neutral-300 mb-3">Последняя тренировка</h2>
          <button
            onClick={() => onWorkoutClick(lastWorkout.id)}
            className="w-full text-left bg-neutral-900/30 border border-neutral-800 rounded-lg px-4 py-4 hover:bg-neutral-800/50 transition-colors shadow-sm shadow-black/10"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${WORKOUT_TYPE_META[lastWorkout.type].color}`}>
                {WORKOUT_TYPE_META[lastWorkout.type].icon} {WORKOUT_TYPE_META[lastWorkout.type].label}
              </span>
              <span className="text-sm text-neutral-300 font-medium">{lastWorkout.label}</span>
              <span className="text-neutral-600 text-xs ml-auto">{formatDate(lastWorkout.date)} &middot; {lastWorkout.duration} мин</span>
            </div>
            {lastWorkout.exercises && (
              <div className="space-y-1">
                {lastWorkout.exercises.map((ex, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-neutral-500 w-4 text-right">{i + 1}.</span>
                    <span className="text-neutral-300">{ex.name}</span>
                    <span className="text-neutral-600 ml-auto">
                      {ex.sets}&times;{ex.reps}{ex.weight ? ` &times; ${ex.weight}кг` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {lastWorkout.feeling && (
              <div className="mt-2 text-xs text-neutral-500">
                Самочувствие: {Array.from({ length: lastWorkout.feeling }, (_, i) => <Star key={i} size={12} strokeWidth={1.5} className="inline text-yellow-400 fill-yellow-400" />)} {FEELING_LABELS[lastWorkout.feeling]}
              </div>
            )}
          </button>
        </div>
      )}

      {/* CTA */}
      <button className="px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg text-sm text-blue-300 hover:bg-blue-600/30 transition-colors">
        Запланировать через чат
      </button>
    </div>
  );
}

function WorkoutDetailView({
  workout,
  onBack,
}: {
  workout: Workout | undefined;
  onBack: () => void;
}) {
  if (!workout) {
    return (
      <div className="text-neutral-500">
        <button onClick={onBack} className="text-sm hover:text-neutral-300 transition-colors mb-4">
          &larr; Назад
        </button>
        <p>Тренировка не найдена</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={onBack}
        className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        &larr; Назад к обзору
      </button>

      <div className="flex items-center gap-3 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${WORKOUT_TYPE_META[workout.type].color}`}>
          {WORKOUT_TYPE_META[workout.type].icon} {WORKOUT_TYPE_META[workout.type].label}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
          workout.status === 'done' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-yellow-900/40 text-yellow-300'
        }`}>
          {workout.status === 'done' ? 'Выполнена' : 'Запланирована'}
        </span>
      </div>

      <h1 className="text-xl font-bold mb-1">{workout.label}</h1>
      <div className="text-neutral-500 text-sm mb-6">
        {formatDate(workout.date)} &middot; {workout.duration} мин
        {workout.distance && <> &middot; {workout.distance} км</>}
        {workout.pace && <> &middot; темп {workout.pace}</>}
      </div>

      {/* Exercises */}
      {workout.exercises && workout.exercises.length > 0 && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-4 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
            Упражнения
          </h2>
          <div className="space-y-2">
            {workout.exercises.map((ex, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <span className="text-neutral-600 text-xs w-5 text-right">{i + 1}.</span>
                <span className="text-neutral-300 text-sm flex-1">{ex.name}</span>
                <span className="text-neutral-400 text-sm font-mono">
                  {ex.sets} &times; {ex.reps}
                  {ex.weight ? <span className="text-neutral-500"> &times; {ex.weight}кг</span> : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {workout.notes && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-4 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Заметки
          </h2>
          <p className="text-neutral-300 text-sm leading-relaxed">{workout.notes}</p>
        </div>
      )}

      {/* Feeling */}
      {workout.feeling && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 shadow-sm shadow-black/10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Самочувствие
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={18}
                  strokeWidth={1.5}
                  className={`inline ${n <= workout.feeling! ? 'text-yellow-400 fill-yellow-400' : 'text-neutral-700'}`}
                />
              ))}
            </div>
            <span className="text-neutral-400 text-sm">{FEELING_LABELS[workout.feeling]}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function NutritionOverview() {
  const cals = totalCalories(TODAY_NUTRITION.meals);
  const protein = totalMacro(TODAY_NUTRITION.meals, 'protein');
  const fat = totalMacro(TODAY_NUTRITION.meals, 'fat');
  const carbs = totalMacro(TODAY_NUTRITION.meals, 'carbs');
  const maxWeeklyCal = Math.max(...WEEKLY_CALORIES, TODAY_NUTRITION.targetCalories);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Питание</h1>

      {/* Today's meals */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Сегодня — {formatDate(TODAY_NUTRITION.date)}
        </h2>
        <div className="space-y-3">
          {(['breakfast', 'lunch', 'snack', 'dinner'] as MealSlot[]).map((slot) => {
            const meal = TODAY_NUTRITION.meals.find((m) => m.slot === slot);
            return (
              <div key={slot} className="flex items-start gap-3">
                <span className="text-neutral-500 text-xs w-16 shrink-0 pt-0.5">{MEAL_SLOT_LABEL[slot]}</span>
                {meal ? (
                  <div className="flex-1">
                    <div className="text-sm text-neutral-300">{meal.name}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {meal.calories} ккал &middot; Б{meal.protein} Ж{meal.fat} У{meal.carbs}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-600 italic pt-0.5">не заполнено</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Daily totals */}
        <div className="mt-4 pt-4 border-t border-neutral-800">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <div className="text-lg font-bold text-orange-400">{cals}</div>
              <div className="text-[10px] text-neutral-500">/ {TODAY_NUTRITION.targetCalories} ккал</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-400">{protein}г</div>
              <div className="text-[10px] text-neutral-500">/ {TODAY_NUTRITION.targetProtein}г белков</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-400">{fat}г</div>
              <div className="text-[10px] text-neutral-500">/ {TODAY_NUTRITION.targetFat}г жиров</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-400">{carbs}г</div>
              <div className="text-[10px] text-neutral-500">/ {TODAY_NUTRITION.targetCarbs}г углеводов</div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <ProgressBar value={cals} max={TODAY_NUTRITION.targetCalories} color="bg-orange-500" />
            <ProgressBar value={protein} max={TODAY_NUTRITION.targetProtein} color="bg-red-500" />
            <ProgressBar value={fat} max={TODAY_NUTRITION.targetFat} color="bg-yellow-500" />
            <ProgressBar value={carbs} max={TODAY_NUTRITION.targetCarbs} color="bg-blue-500" />
          </div>
        </div>
      </div>

      {/* Weekly calories bar chart */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Калории за неделю
        </h2>
        <div className="flex items-end gap-2 h-32">
          {WEEKLY_CALORIES.map((cal, i) => {
            const height = (cal / maxWeeklyCal) * 100;
            const isTarget = Math.abs(cal - TODAY_NUTRITION.targetCalories) < 200;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-neutral-500">{cal}</span>
                <div
                  className={`w-full rounded-t transition-all ${
                    cal > TODAY_NUTRITION.targetCalories
                      ? 'bg-red-500/60'
                      : isTarget
                        ? 'bg-emerald-500/60'
                        : 'bg-orange-500/60'
                  }`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] text-neutral-600">{WEEKLY_DAYS[i]}</span>
              </div>
            );
          })}
        </div>
        {/* Target line label */}
        <div className="flex items-center gap-2 mt-2 text-[10px] text-neutral-600">
          <div className="w-3 h-0.5 bg-neutral-600" />
          <span>Цель: {TODAY_NUTRITION.targetCalories} ккал</span>
        </div>
      </div>
    </div>
  );
}

function StatsDashboard() {
  const doneWorkouts = MOCK_WORKOUTS.filter((w) => w.status === 'done');
  const monthWorkouts = doneWorkouts.filter((w) => w.date >= '2026-03-01');
  const avgCalories = Math.round(WEEKLY_CALORIES.reduce((s, c) => s + c, 0) / WEEKLY_CALORIES.length);
  const gymCount = monthWorkouts.filter((w) => w.type === 'gym').length;
  const runCount = monthWorkouts.filter((w) => w.type === 'run').length;
  const totalTime = monthWorkouts.reduce((s, w) => s + w.duration, 0);
  const maxWeeklyWorkout = Math.max(...WEEKLY_WORKOUTS);
  const maxWeeklyCal = Math.max(...WEEKLY_CALORIES);
  const weightMin = Math.min(...WEIGHT_PROGRESS.map((p) => p.weight));
  const weightMax = Math.max(...WEIGHT_PROGRESS.map((p) => p.weight));
  const weightRange = weightMax - weightMin || 1;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Статистика</h1>

      {/* Top stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 shadow-sm shadow-black/10">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Тренировок за месяц</div>
          <div className="text-3xl font-bold text-neutral-200">{monthWorkouts.length}</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 shadow-sm shadow-black/10">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Средний калораж</div>
          <div className="text-3xl font-bold text-neutral-200">{avgCalories}</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 shadow-sm shadow-black/10">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Дней без пропуска</div>
          <div className="text-3xl font-bold text-emerald-400">5</div>
        </div>
      </div>

      {/* Monthly detail cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 shadow-sm shadow-black/10">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Общее время</div>
          <div className="text-3xl font-bold text-neutral-200">{totalTime}</div>
          <div className="text-[11px] text-neutral-500 mt-1">минут</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 shadow-sm shadow-black/10">
          <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Зал / Бег</div>
          <div className="text-3xl font-bold text-neutral-200">
            {gymCount} / {runCount}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">тренировок</div>
        </div>
      </div>

      {/* Workouts by week bar chart */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Тренировки по неделям
        </h2>
        <div className="flex items-end gap-3 h-32">
          {WEEKLY_WORKOUTS.map((count, i) => {
            const height = (count / maxWeeklyWorkout) * 100;
            const isLast = i === WEEKLY_WORKOUTS.length - 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-neutral-300">{count}</span>
                <div
                  className={`w-full rounded-t transition-all ${
                    isLast ? 'bg-blue-500/40 border border-dashed border-blue-500/60' : 'bg-blue-500/60'
                  }`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] text-neutral-600 text-center">{WEEKLY_WORKOUT_LABELS[i]}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-neutral-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 bg-blue-500/60 rounded-sm" />
            <span>Выполнено</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 bg-blue-500/40 border border-dashed border-blue-500/60 rounded-sm" />
            <span>Запланировано</span>
          </div>
        </div>
      </div>

      {/* Calories by day bar chart */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Калории за неделю (по дням)
        </h2>
        <div className="flex items-end gap-2 h-32">
          {WEEKLY_CALORIES.map((cal, i) => {
            const height = (cal / maxWeeklyCal) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-neutral-500">{cal}</span>
                <div
                  className={`w-full rounded-t transition-all ${
                    cal > TODAY_NUTRITION.targetCalories
                      ? 'bg-red-500/60'
                      : cal < 2000
                        ? 'bg-yellow-500/60'
                        : 'bg-emerald-500/60'
                  }`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] text-neutral-600">{WEEKLY_DAYS[i]}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-neutral-600">
          <div className="w-3 h-0.5 bg-neutral-600" />
          <span>Цель: {TODAY_NUTRITION.targetCalories} ккал</span>
        </div>
      </div>

      {/* Weight progress chart */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Прогресс по весу
        </h2>
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-2xl font-bold text-neutral-200">{(WEIGHT_PROGRESS[WEIGHT_PROGRESS.length - 1]?.weight ?? 0)} кг</span>
          <span className="text-xs text-emerald-400">
            -{((WEIGHT_PROGRESS[0]?.weight ?? 0) - (WEIGHT_PROGRESS[WEIGHT_PROGRESS.length - 1]?.weight ?? 0)).toFixed(1)} кг за период
          </span>
        </div>
        <div className="relative h-24 flex items-end overflow-hidden">
          {/* Connecting lines + dots */}
          <div className="absolute inset-0 flex items-stretch overflow-hidden">
            {WEIGHT_PROGRESS.map((point, i) => {
              const yPct = ((weightMax - point.weight) / weightRange) * 70 + 10; // 10-80% range
              const nextPoint = WEIGHT_PROGRESS[i + 1];
              const nextYPct = nextPoint ? ((weightMax - nextPoint.weight) / weightRange) * 70 + 10 : 0;
              const leftPct = (i / (WEIGHT_PROGRESS.length - 1)) * 100;

              return (
                <div key={i} className="absolute" style={{ left: `${leftPct}%`, top: `${yPct}%`, transform: 'translate(-50%, -50%)' }}>
                  {/* Dot */}
                  <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-neutral-900 relative z-10" />
                  {/* Weight label */}
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-neutral-400 whitespace-nowrap">
                    {point.weight}
                  </div>
                  {/* Connecting line to next point */}
                  {nextPoint && (
                    <div
                      className="absolute top-1/2 left-1/2 h-0.5 bg-emerald-500/40 origin-left z-0"
                      style={{
                        width: `${100 / (WEIGHT_PROGRESS.length - 1)}cqi`,
                        transform: `rotate(${Math.atan2(
                          (nextYPct - yPct) * 0.96,
                          100 / (WEIGHT_PROGRESS.length - 1)
                        ) * (180 / Math.PI)}deg)`,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* Week labels */}
        <div className="flex justify-between mt-2">
          {WEIGHT_PROGRESS.map((point, i) => (
            <span key={i} className="text-[10px] text-neutral-600">{point.week}</span>
          ))}
        </div>
      </div>

      {/* Workout type breakdown */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 mb-6 shadow-lg shadow-black/20">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Типы тренировок (март)
        </h2>
        <div className="space-y-2">
          {(['gym', 'run', 'swim'] as WorkoutType[]).map((type) => {
            const count = monthWorkouts.filter((w) => w.type === type).length;
            const pct = monthWorkouts.length > 0 ? (count / monthWorkouts.length) * 100 : 0;
            return (
              <div key={type} className="flex items-center gap-3">
                <span className="text-sm w-20">
                  {WORKOUT_TYPE_META[type].icon} {WORKOUT_TYPE_META[type].label}
                </span>
                <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      type === 'gym' ? 'bg-blue-500' : type === 'run' ? 'bg-green-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-neutral-400 w-6 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <button className="px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg text-sm text-blue-300 hover:bg-blue-600/30 transition-colors">
        Подробная аналитика через чат
      </button>
    </div>
  );
}

function SleepOverview() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Сон / Восстановление</h1>
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5 shadow-lg shadow-black/20">
        <p className="text-neutral-400 text-sm">
          Отслеживание сна и восстановления будет доступно после интеграции с Apple Health.
        </p>
        <button className="mt-4 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg text-sm text-blue-300 hover:bg-blue-600/30 transition-colors">
          Настроить через чат
        </button>
      </div>
    </div>
  );
}
