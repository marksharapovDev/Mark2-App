import { useState, useRef, useCallback, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useSidebar } from '../context/sidebar-context';
import type {
  WorkoutV2, WorkoutExercise, HealthLog, HealthGoal, WorkoutTypeV2, WorkoutMood,
  TrainingProgram, TrainingProgramDay, TrainingProgramDayExercise,
  MealPlan, Meal, MealType,
} from '@mark2/shared';
import {
  Dumbbell, Activity, Droplets, Moon, Scale, Brain,
  ChevronLeft, Plus, Trash2, X, Bike, Waves, PersonStanding, StretchHorizontal,
  Loader2, UtensilsCrossed, ClipboardList, Target, Pencil, Check,
  BarChart3, TrendingUp, TrendingDown, CheckSquare, Square,
} from 'lucide-react';
import { ConfirmDelete } from '../components/confirm-delete';
import { useUndo } from '../context/undo-context';

// --- Types ---

type TabId = 'overview' | 'program' | 'nutrition' | 'stats' | 'goals';

type MainView =
  | { kind: 'overview' }
  | { kind: 'program' }
  | { kind: 'nutrition' }
  | { kind: 'stats' }
  | { kind: 'goals' }
  | { kind: 'workout-detail'; workoutId: string }
  | { kind: 'add-workout' };

// --- Constants ---

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Обзор', icon: <Activity size={14} /> },
  { id: 'program', label: 'Программа', icon: <ClipboardList size={14} /> },
  { id: 'nutrition', label: 'Питание', icon: <UtensilsCrossed size={14} /> },
  { id: 'stats', label: 'Статистика', icon: <BarChart3 size={14} /> },
  { id: 'goals', label: 'Цели', icon: <Target size={14} /> },
];

const WORKOUT_TYPE_META: Record<WorkoutTypeV2, { icon: React.ReactNode; label: string; color: string }> = {
  gym: { icon: <Dumbbell size={14} />, label: 'Зал', color: 'bg-blue-900/40 text-blue-300' },
  running: { icon: <PersonStanding size={14} />, label: 'Бег', color: 'bg-green-900/40 text-green-300' },
  cycling: { icon: <Bike size={14} />, label: 'Велосипед', color: 'bg-yellow-900/40 text-yellow-300' },
  swimming: { icon: <Waves size={14} />, label: 'Плавание', color: 'bg-cyan-900/40 text-cyan-300' },
  calisthenics: { icon: <PersonStanding size={14} />, label: 'Турники', color: 'bg-purple-900/40 text-purple-300' },
  stretching: { icon: <StretchHorizontal size={14} />, label: 'Растяжка', color: 'bg-pink-900/40 text-pink-300' },
  other: { icon: <Activity size={14} />, label: 'Другое', color: 'bg-neutral-800 text-neutral-300' },
};

const MOOD_OPTIONS: { value: WorkoutMood; emoji: string; label: string }[] = [
  { value: 'great', emoji: '\ud83d\ude0a', label: 'Отлично' },
  { value: 'good', emoji: '\ud83d\ude42', label: 'Хорошо' },
  { value: 'normal', emoji: '\ud83d\ude10', label: 'Нормально' },
  { value: 'tired', emoji: '\ud83d\ude14', label: 'Устал' },
  { value: 'bad', emoji: '\ud83d\ude1e', label: 'Плохо' },
];

const MOOD_EMOJI: Record<string, string> = {
  great: '\ud83d\ude0a', good: '\ud83d\ude42', normal: '\ud83d\ude10', tired: '\ud83d\ude14', bad: '\ud83d\ude1e',
};

const MEAL_TYPE_META: Record<MealType, { label: string; icon: string }> = {
  breakfast: { label: 'Завтрак', icon: '\u2600\ufe0f' },
  lunch: { label: 'Обед', icon: '\ud83c\udf5d' },
  dinner: { label: 'Ужин', icon: '\ud83c\udf19' },
  snack: { label: 'Перекус', icon: '\ud83c\udf4e' },
};

// --- Helpers ---

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const month = parts[1] ?? '0';
  const day = parts[2] ?? '0';
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10)]}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// --- Component ---

export function Health() {
  const [mainView, setMainView] = useState<MainView>({ kind: 'overview' });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('mark2-health-sidebar-w');
    if (saved) { const n = parseInt(saved, 10); if (n >= 200 && n <= 400) return n; }
    return Math.min(400, Math.max(200, Math.round(window.innerWidth * 0.2)));
  });
  const { leftCollapsed, setLeftKey } = useSidebar();
  useEffect(() => { setLeftKey('health'); }, [setLeftKey]);
  const isDraggingSidebar = useRef(false);

  // DB state
  const [workouts, setWorkouts] = useState<WorkoutV2[]>([]);
  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [todayLogs, setTodayLogs] = useState<HealthLog[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [allLogs, setAllLogs] = useState<HealthLog[]>([]);
  const [allMeals, setAllMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 400;

  const reloadData = useCallback(async () => {
    try {
      const today = todayStr();
      const [w, g, logs, progs, meals, plans, aLogs, aMeals] = await Promise.all([
        window.db.health.workouts.list(),
        window.db.health.goals.list(),
        window.db.health.logs.list(undefined, today, today),
        window.db.health.programs.list(),
        window.db.health.meals.list(today),
        window.db.health.mealPlans.list(),
        window.db.health.logs.list(),
        window.db.health.meals.list(),
      ]);
      setWorkouts(w);
      setGoals(g);
      setTodayLogs(logs);
      setPrograms(progs);
      setTodayMeals(meals);
      setMealPlans(plans);
      setAllLogs(aLogs);
      setAllMeals(aMeals);
    } catch (err) {
      console.error('Failed to load health data:', err);
    }
  }, []);

  useEffect(() => {
    reloadData().finally(() => setLoading(false));
  }, [reloadData]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('health') || entities.includes('workouts')) {
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
      localStorage.setItem('mark2-health-sidebar-w', String(w));
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

  // Today helpers
  const today = todayStr();
  const todayWorkout = workouts.find((w) => w.date === today);
  const todayWeight = todayLogs.find((l) => l.type === 'weight');
  const todaySleep = todayLogs.find((l) => l.type === 'sleep');
  const todayWater = todayLogs.find((l) => l.type === 'water');
  const todayMood = todayLogs.find((l) => l.type === 'mood');

  // Stats
  const thisMonth = workouts.filter((w) => w.date >= (today.slice(0, 7) + '-01'));
  const allWeightLogs = todayLogs.filter((l) => l.type === 'weight');
  const latestWeight = allWeightLogs.length > 0 ? allWeightLogs[0] : null;

  const activeGoals = goals.filter((g) => g.status === 'active');
  const activeProgram = programs.find((p) => p.status === 'active') ?? null;
  const activeMealPlan = mealPlans.find((p) => p.status === 'active') ?? null;
  const todayCalories = todayMeals.reduce((s, m) => s + (m.calories ?? 0), 0);

  const currentTab: TabId = mainView.kind === 'workout-detail' || mainView.kind === 'add-workout'
    ? 'overview' : mainView.kind as TabId;

  return (
    <MainLayout agent="health" noPadding defaultChatWidthPct={30}>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* === SIDEBAR === */}
        <aside
          className="shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50 overflow-hidden transition-[width] duration-200 ease-in-out"
          style={{ width: leftCollapsed ? 0 : sidebarWidth }}
        >
          <div className="flex-1 overflow-y-auto pb-4">
            {/* Today checklist */}
            <DailyChecklist
              todayWorkout={todayWorkout ?? null}
              todayWeight={todayWeight ?? null}
              todaySleep={todaySleep ?? null}
              todayWater={todayWater ?? null}
              todayMeals={todayMeals}
              todayCalories={todayCalories}
              onAddWorkout={() => setMainView({ kind: 'add-workout' })}
              onGoNutrition={() => setMainView({ kind: 'nutrition' })}
              onLogSaved={reloadData}
            />

            <div className="mx-3 border-t border-neutral-800 mt-1 mb-2" />

            {/* Program */}
            {activeProgram && (
              <>
                <div className="px-3 pb-2">
                  <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Программа
                  </div>
                  <button
                    onClick={() => setMainView({ kind: 'program' })}
                    className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-neutral-800/50 transition-colors"
                  >
                    <div className="text-neutral-300 truncate">{activeProgram.name}</div>
                  </button>
                </div>
                <div className="mx-3 border-t border-neutral-800 mt-1 mb-2" />
              </>
            )}

            {/* Goals */}
            <div className="px-3 pb-2">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Цели
              </div>
              {activeGoals.length === 0 ? (
                <div className="text-xs text-neutral-600 px-1">Нет активных целей</div>
              ) : (
                <div className="space-y-2">
                  {activeGoals.map((g) => (
                    <GoalProgress key={g.id} goal={g} />
                  ))}
                </div>
              )}
            </div>

            <div className="mx-3 border-t border-neutral-800 mt-1 mb-2" />

            {/* Recent workouts */}
            <div className="px-3 pb-2">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Последние тренировки
              </div>
              {workouts.length === 0 ? (
                <div className="text-xs text-neutral-600 px-1">Нет тренировок</div>
              ) : (
                <div className="space-y-0.5">
                  {workouts.slice(0, 5).map((w) => {
                    const meta = WORKOUT_TYPE_META[w.type] ?? WORKOUT_TYPE_META.other;
                    return (
                      <button
                        key={w.id}
                        onClick={() => setMainView({ kind: 'workout-detail', workoutId: w.id })}
                        className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-neutral-800/50 transition-colors flex items-center gap-2"
                      >
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${meta.color}`}>
                          {meta.icon}
                        </span>
                        <span className="text-neutral-300 truncate flex-1">
                          {w.title ?? meta.label}
                        </span>
                        <span className="text-neutral-600 text-[10px] shrink-0">
                          {formatDate(w.date)}
                        </span>
                        {w.durationMinutes && (
                          <span className="text-neutral-600 text-[10px] shrink-0">
                            {w.durationMinutes}м
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Drag handle */}
        {!leftCollapsed && (
          <div
            className="w-1 shrink-0 cursor-col-resize hover:bg-blue-500/30 transition-colors"
            onMouseDown={handleSidebarDragStart}
          />
        )}

        {/* === MAIN === */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-6 pt-3 pb-2 border-b border-neutral-800/50">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMainView({ kind: tab.id })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  currentTab === tab.id
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <main className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin text-neutral-500" />
              </div>
            ) : mainView.kind === 'overview' ? (
              <OverviewView
                workouts={workouts}
                todayLogs={todayLogs}
                allLogs={allLogs}
                thisMonthCount={thisMonth.length}
                latestWeight={latestWeight}
                onOpenWorkout={(id) => setMainView({ kind: 'workout-detail', workoutId: id })}
                onAddWorkout={() => setMainView({ kind: 'add-workout' })}
                onLogSaved={reloadData}
              />
            ) : mainView.kind === 'program' ? (
              <TrainingProgramView onChanged={reloadData} />
            ) : mainView.kind === 'nutrition' ? (
              <NutritionView
                todayMeals={todayMeals}
                activePlan={activeMealPlan}
                onChanged={reloadData}
              />
            ) : mainView.kind === 'stats' ? (
              <StatsView workouts={workouts} allLogs={allLogs} allMeals={allMeals} activePlan={activeMealPlan} />
            ) : mainView.kind === 'goals' ? (
              <GoalsView goals={goals} onChanged={reloadData} />
            ) : mainView.kind === 'workout-detail' ? (
              <WorkoutDetailView
                workoutId={mainView.workoutId}
                onBack={() => setMainView({ kind: 'overview' })}
                onDeleted={() => { reloadData(); setMainView({ kind: 'overview' }); }}
                onUpdated={reloadData}
              />
            ) : mainView.kind === 'add-workout' ? (
              <AddWorkoutView
                onSaved={() => { reloadData(); setMainView({ kind: 'overview' }); }}
                onCancel={() => setMainView({ kind: 'overview' })}
              />
            ) : null}
          </main>
        </div>
      </div>
    </MainLayout>
  );
}

// --- Sidebar components ---

function SidebarTodayItem({ icon, label, value, active, onClick }: {
  icon: React.ReactNode; label: string; value: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-neutral-800/50 transition-colors flex items-center gap-2"
    >
      <span className={active ? 'text-emerald-400' : 'text-neutral-600'}>{icon}</span>
      <span className="text-neutral-400 w-20">{label}</span>
      <span className={active ? 'text-neutral-200' : 'text-neutral-600'}>{value}</span>
    </button>
  );
}

function GoalProgress({ goal }: { goal: HealthGoal }) {
  const pct = goal.targetValue && goal.targetValue > 0
    ? Math.min(100, Math.round(((goal.currentValue ?? 0) / goal.targetValue) * 100))
    : 0;
  return (
    <div className="px-1">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-neutral-300 truncate">{goal.title}</span>
        <span className="text-neutral-500 text-[10px] shrink-0 ml-2">
          {goal.currentValue ?? 0}/{goal.targetValue ?? '?'} {goal.unit ?? ''}
        </span>
      </div>
      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// --- Daily Checklist ---

function DailyChecklist({ todayWorkout, todayWeight, todaySleep, todayWater, todayMeals, todayCalories, onAddWorkout, onGoNutrition, onLogSaved }: {
  todayWorkout: WorkoutV2 | null;
  todayWeight: HealthLog | null;
  todaySleep: HealthLog | null;
  todayWater: HealthLog | null;
  todayMeals: Meal[];
  todayCalories: number;
  onAddWorkout: () => void;
  onGoNutrition: () => void;
  onLogSaved: () => void;
}) {
  const [inlineInput, setInlineInput] = useState<'weight' | 'sleep' | 'water' | null>(null);
  const [inlineValue, setInlineValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Derive check states from actual data
  const hasWorkout = todayWorkout != null;
  const hasWeight = todayWeight != null;
  const hasSleep = todaySleep != null;
  const waterOk = todayWater != null && (todayWater.value ?? 0) >= 2;
  const hasBreakfast = todayMeals.some((m) => m.type === 'breakfast');
  const hasLunch = todayMeals.some((m) => m.type === 'lunch');
  const hasDinner = todayMeals.some((m) => m.type === 'dinner');
  const mainMealsCount = [hasBreakfast, hasLunch, hasDinner].filter(Boolean).length;
  const hasMeals = mainMealsCount === 3;

  // Get existing log ID for updates
  const existingLogId = useCallback((key: string): string | null => {
    switch (key) {
      case 'weight': return todayWeight?.id ?? null;
      case 'sleep': return todaySleep?.id ?? null;
      case 'water': return todayWater?.id ?? null;
      default: return null;
    }
  }, [todayWeight, todaySleep, todayWater]);

  // Get existing value for pre-filling
  const existingValue = useCallback((key: string): string => {
    switch (key) {
      case 'weight': return todayWeight?.value != null ? String(todayWeight.value) : '';
      case 'sleep': return todaySleep?.value != null ? String(todaySleep.value) : '';
      case 'water': return todayWater?.value != null ? String(todayWater.value) : '';
      default: return '';
    }
  }, [todayWeight, todaySleep, todayWater]);

  const handleSaveInline = useCallback(async () => {
    if (!inlineInput || !inlineValue.trim()) return;
    setSaving(true);
    try {
      const logId = existingLogId(inlineInput);
      if (logId) {
        // Update existing log
        await window.db.health.logs.update(logId, { value: parseFloat(inlineValue) });
      } else {
        // Create new log
        await window.db.health.logs.create({
          type: inlineInput,
          value: parseFloat(inlineValue),
          date: todayStr(),
        });
      }
      await window.db.health.checklist.refresh(todayStr());
      setInlineInput(null);
      setInlineValue('');
      onLogSaved();
    } catch (err) { console.error('Failed to log:', err); }
    finally { setSaving(false); }
  }, [inlineInput, inlineValue, existingLogId, onLogSaved]);

  // Open inline input with pre-filled value (for both new and edit)
  const openInlineInput = useCallback((key: 'weight' | 'sleep' | 'water') => {
    setInlineInput(key);
    setInlineValue(existingValue(key));
  }, [existingValue]);

  const handleClick = useCallback((key: string) => {
    switch (key) {
      case 'workout': onAddWorkout(); break;
      case 'weight':
      case 'sleep':
      case 'water':
        openInlineInput(key as 'weight' | 'sleep' | 'water');
        break;
      case 'meals': onGoNutrition(); break;
    }
  }, [onAddWorkout, onGoNutrition, openInlineInput]);

  // Display values for completed items
  const displayValue = useCallback((key: string): string | null => {
    switch (key) {
      case 'workout': return todayWorkout?.title ?? WORKOUT_TYPE_META[todayWorkout?.type ?? 'other']?.label ?? null;
      case 'weight': return todayWeight?.value != null ? `${todayWeight.value} кг` : null;
      case 'sleep': return todaySleep?.value != null ? `${todaySleep.value} ч` : null;
      case 'water': return todayWater?.value != null ? `${todayWater.value} л` : null;
      case 'meals': return mainMealsCount > 0
        ? (hasMeals ? `3/3 · ${todayCalories} ккал` : `${mainMealsCount}/3`)
        : null;
      default: return null;
    }
  }, [todayWorkout, todayWeight, todaySleep, todayWater, mainMealsCount, hasMeals, todayCalories]);

  const checks: { key: string; done: boolean; label: string; unit?: string }[] = [
    { key: 'workout', done: hasWorkout, label: 'Тренировка' },
    { key: 'weight', done: hasWeight, label: 'Вес', unit: 'кг' },
    { key: 'sleep', done: hasSleep, label: 'Сон', unit: 'ч' },
    { key: 'water', done: waterOk, label: 'Вода 2л+', unit: 'л' },
    { key: 'meals', done: hasMeals, label: 'Питание' },
  ];
  const doneCount = checks.filter((c) => c.done).length;

  return (
    <div className="px-3 pt-3 pb-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Сегодня</div>
        <span className="text-[10px] text-neutral-600">{doneCount} из {checks.length}</span>
      </div>
      <div className="space-y-0.5">
        {checks.map((c) => {
          const val = displayValue(c.key);
          return (
            <div key={c.key}>
              <div
                className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-neutral-800/50 transition-colors cursor-pointer"
                onClick={() => handleClick(c.key)}
              >
                {c.done
                  ? <CheckSquare size={13} className="text-emerald-400 shrink-0" />
                  : <Square size={13} className="text-neutral-600 shrink-0" />
                }
                <span className={c.done ? 'text-neutral-400' : 'text-neutral-300'}>{c.label}</span>
                {c.done && val && (
                  <span className="text-neutral-500 text-[10px] ml-auto shrink-0">{val}</span>
                )}
              </div>
              {/* Inline input for weight/sleep/water */}
              {inlineInput === c.key && (
                <div className="flex items-center gap-1.5 px-2 py-1 ml-5">
                  <input
                    type="number"
                    step="0.1"
                    value={inlineValue}
                    onChange={(e) => setInlineValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveInline();
                      if (e.key === 'Escape') { setInlineInput(null); setInlineValue(''); }
                    }}
                    autoFocus
                    disabled={saving}
                    className="w-16 bg-neutral-800 rounded px-2 py-0.5 text-xs text-white outline-none"
                    placeholder="0"
                  />
                  {c.unit && <span className="text-[10px] text-neutral-500">{c.unit}</span>}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSaveInline(); }}
                    disabled={saving || !inlineValue.trim()}
                    className="text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setInlineInput(null); setInlineValue(''); }}
                    className="text-neutral-500 hover:text-neutral-300"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 h-1 bg-neutral-800 rounded-full overflow-hidden mx-2">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(doneCount / checks.length) * 100}%` }} />
      </div>
    </div>
  );
}

// --- Overview View ---

function OverviewView({ workouts, todayLogs, allLogs, thisMonthCount, latestWeight, onOpenWorkout, onAddWorkout, onLogSaved }: {
  workouts: WorkoutV2[]; todayLogs: HealthLog[]; allLogs: HealthLog[]; thisMonthCount: number; latestWeight: HealthLog | null;
  onOpenWorkout: (id: string) => void; onAddWorkout: () => void; onLogSaved: () => void;
}) {
  const [quickInput, setQuickInput] = useState<string | null>(null);
  const [quickValue, setQuickValue] = useState('');
  const [saving, setSaving] = useState(false);

  const todaySleep = todayLogs.find((l) => l.type === 'sleep');
  const todayWater = todayLogs.find((l) => l.type === 'water');

  // Trends
  const today = todayStr();
  const monthStart = today.slice(0, 7) + '-01';
  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonthStart = prevMonthDate.toISOString().slice(0, 7) + '-01';
  const prevMonthEnd = today.slice(0, 7) + '-01';

  const prevMonthWorkouts = workouts.filter((w) => w.date >= prevMonthStart && w.date < prevMonthEnd).length;
  const workoutTrend = thisMonthCount - prevMonthWorkouts;

  // Sleep average this week
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);
  const weekSleepLogs = allLogs.filter((l) => l.type === 'sleep' && l.date >= weekAgoStr);
  const avgSleep = weekSleepLogs.length > 0 ? (weekSleepLogs.reduce((s, l) => s + (l.value ?? 0), 0) / weekSleepLogs.length) : null;
  const prevWeekStart = new Date(); prevWeekStart.setDate(prevWeekStart.getDate() - 14);
  const prevWeekSleepLogs = allLogs.filter((l) => l.type === 'sleep' && l.date >= prevWeekStart.toISOString().slice(0, 10) && l.date < weekAgoStr);
  const prevAvgSleep = prevWeekSleepLogs.length > 0 ? (prevWeekSleepLogs.reduce((s, l) => s + (l.value ?? 0), 0) / prevWeekSleepLogs.length) : null;
  const sleepTrend = avgSleep != null && prevAvgSleep != null ? avgSleep - prevAvgSleep : null;

  // Weight change this month
  const monthWeightLogs = allLogs.filter((l) => l.type === 'weight' && l.date >= monthStart).sort((a, b) => a.date.localeCompare(b.date));
  const weightChange = monthWeightLogs.length >= 2
    ? ((monthWeightLogs[monthWeightLogs.length - 1]?.value ?? 0) - (monthWeightLogs[0]?.value ?? 0))
    : null;

  // Water average this week
  const weekWaterLogs = allLogs.filter((l) => l.type === 'water' && l.date >= weekAgoStr);
  const avgWater = weekWaterLogs.length > 0 ? (weekWaterLogs.reduce((s, l) => s + (l.value ?? 0), 0) / weekWaterLogs.length) : null;

  const handleQuickLog = useCallback(async (type: string, value: string) => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await window.db.health.logs.create({ type, value: parseFloat(value), date: todayStr() });
      onLogSaved();
      setQuickInput(null);
      setQuickValue('');
    } catch (err) { console.error('Failed to log:', err); }
    finally { setSaving(false); }
  }, [onLogSaved]);

  const handleMoodLog = useCallback(async (moodValue: number) => {
    setSaving(true);
    try {
      await window.db.health.logs.create({ type: 'mood', value: moodValue, date: todayStr() });
      onLogSaved();
      setQuickInput(null);
    } catch (err) { console.error('Failed to log mood:', err); }
    finally { setSaving(false); }
  }, [onLogSaved]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Тренировок" value={String(thisMonthCount)} sub="этот месяц" icon={<Dumbbell size={16} />} color="text-blue-400"
          trend={workoutTrend !== 0 ? workoutTrend : undefined} />
        <StatCard label="Средний сон" value={avgSleep != null ? `${avgSleep.toFixed(1)}ч` : '—'} sub="за неделю" icon={<Moon size={16} />} color="text-purple-400"
          trend={sleepTrend != null ? Math.round(sleepTrend * 10) / 10 : undefined} trendUnit="ч" />
        <StatCard label="Текущий вес" value={latestWeight ? `${latestWeight.value}кг` : '—'} sub="последний замер" icon={<Scale size={16} />} color="text-emerald-400"
          trend={weightChange != null ? Math.round(weightChange * 10) / 10 : undefined} trendUnit="кг" />
        <StatCard label="Вода" value={avgWater != null ? `${avgWater.toFixed(1)}л` : '—'} sub="среднее за неделю" icon={<Droplets size={16} />} color="text-cyan-400" />
      </div>

      <div>
        <h3 className="text-sm font-medium text-neutral-300 mb-3">Быстрый ввод</h3>
        <div className="flex gap-2 flex-wrap">
          {[
            { type: 'weight', label: 'Вес', icon: <Scale size={14} />, unit: 'кг' },
            { type: 'sleep', label: 'Сон', icon: <Moon size={14} />, unit: 'ч' },
            { type: 'water', label: 'Вода', icon: <Droplets size={14} />, unit: 'л' },
            { type: 'mood', label: 'Настроение', icon: <Brain size={14} />, unit: '' },
          ].map((item) => (
            <div key={item.type}>
              {quickInput === item.type ? (
                <div className="flex items-center gap-1.5 bg-neutral-800 rounded-lg px-3 py-1.5">
                  <span className="text-neutral-400">{item.icon}</span>
                  {item.type === 'mood' ? (
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button key={v} onClick={() => handleMoodLog(v)} disabled={saving}
                          className="w-7 h-7 rounded hover:bg-neutral-700 text-sm transition-colors">{v}</button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <input type="number" step="0.1" value={quickValue} onChange={(e) => setQuickValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleQuickLog(item.type, quickValue); if (e.key === 'Escape') { setQuickInput(null); setQuickValue(''); } }}
                        autoFocus className="w-16 bg-transparent text-sm text-white outline-none" placeholder="0" />
                      <span className="text-xs text-neutral-500">{item.unit}</span>
                    </>
                  )}
                  <button onClick={() => { setQuickInput(null); setQuickValue(''); }} className="text-neutral-500 hover:text-neutral-300 ml-1"><X size={12} /></button>
                </div>
              ) : (
                <button onClick={() => { setQuickInput(item.type); setQuickValue(''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 text-xs text-neutral-400 hover:text-neutral-200 transition-colors">
                  {item.icon} {item.label}
                </button>
              )}
            </div>
          ))}
          <button onClick={onAddWorkout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900/30 hover:bg-blue-900/50 text-xs text-blue-300 transition-colors">
            <Plus size={14} /> Тренировка
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-neutral-300 mb-3">Последние тренировки</h3>
        {workouts.length === 0 ? (
          <div className="text-sm text-neutral-600 py-8 text-center">Нет тренировок. Добавь первую!</div>
        ) : (
          <div className="space-y-1.5">
            {workouts.slice(0, 10).map((w) => {
              const meta = WORKOUT_TYPE_META[w.type] ?? WORKOUT_TYPE_META.other;
              return (
                <button key={w.id} onClick={() => onOpenWorkout(w.id)}
                  className="w-full text-left px-4 py-3 rounded-lg bg-neutral-900/50 hover:bg-neutral-800/50 transition-colors flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${meta.color}`}>{meta.icon} {meta.label}</span>
                  <span className="text-sm text-neutral-200 truncate flex-1">{w.title ?? meta.label}</span>
                  <span className="text-xs text-neutral-500">{formatDate(w.date)}</span>
                  {w.durationMinutes && <span className="text-xs text-neutral-600">{w.durationMinutes} мин</span>}
                  {w.mood && <span className="text-sm">{MOOD_EMOJI[w.mood] ?? ''}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, color, trend, trendUnit }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string; trend?: number; trendUnit?: string;
}) {
  return (
    <div className="bg-neutral-900/50 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 mb-1"><span className={color}>{icon}</span><span className="text-xs text-neutral-500">{label}</span></div>
      <div className="flex items-center gap-2">
        <span className="text-xl font-semibold text-white">{value}</span>
        {trend != null && trend !== 0 && (
          <span className={`flex items-center gap-0.5 text-[10px] ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {trend > 0 ? '+' : ''}{trend}{trendUnit ?? ''}
          </span>
        )}
      </div>
      <div className="text-[10px] text-neutral-600 mt-0.5">{sub}</div>
    </div>
  );
}

// --- Training Program View ---

function TrainingProgramView({ onChanged }: { onChanged: () => void }) {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [days, setDays] = useState<TrainingProgramDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editExercises, setEditExercises] = useState<TrainingProgramDayExercise[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const loadPrograms = useCallback(async () => {
    try {
      const progs = await window.db.health.programs.list();
      setPrograms(progs);
      const active = progs.find((p) => p.status === 'active');
      if (active) {
        const d = await window.db.health.programDays.list(active.id);
        setDays(d);
      } else {
        setDays([]);
      }
    } catch (err) {
      console.error('Failed to load programs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPrograms(); }, [loadPrograms]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('health')) loadPrograms();
    });
  }, [loadPrograms]);

  const activeProgram = programs.find((p) => p.status === 'active') ?? null;

  const handleCreateProgram = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      await window.db.health.programs.create({ name: newName, description: newDesc || null });
      setCreating(false);
      setNewName('');
      setNewDesc('');
      loadPrograms();
      onChanged();
    } catch (err) { console.error('Failed to create program:', err); }
  }, [newName, newDesc, loadPrograms, onChanged]);

  const handleAddDay = useCallback(async () => {
    if (!activeProgram) return;
    try {
      await window.db.health.programDays.create({
        programId: activeProgram.id,
        dayName: `День ${days.length + 1}`,
        orderIndex: days.length,
        exercises: [],
      });
      loadPrograms();
    } catch (err) { console.error('Failed to add day:', err); }
  }, [activeProgram, days.length, loadPrograms]);

  const { pushUndo } = useUndo();

  const handleDeleteDay = useCallback(async (dayId: string) => {
    try {
      const saved = days.find((d) => d.id === dayId);
      await window.db.health.programDays.delete(dayId);
      loadPrograms();
      if (saved) pushUndo({ label: saved.dayName, restoreFn: async () => { await window.db.health.programDays.create(saved); loadPrograms(); } });
    } catch (err) { console.error('Failed to delete day:', err); }
  }, [loadPrograms, days, pushUndo]);

  const startEditDay = useCallback((day: TrainingProgramDay) => {
    setEditingDay(day.id);
    setEditExercises([...day.exercises]);
  }, []);

  const saveEditDay = useCallback(async () => {
    if (!editingDay) return;
    try {
      await window.db.health.programDays.update(editingDay, { exercises: editExercises });
      setEditingDay(null);
      loadPrograms();
      onChanged();
    } catch (err) { console.error('Failed to save day:', err); }
  }, [editingDay, editExercises, loadPrograms, onChanged]);

  const updateEditEx = useCallback((idx: number, field: keyof TrainingProgramDayExercise, value: string | number | undefined) => {
    setEditExercises((prev) => prev.map((ex, i) => i === idx ? { ...ex, [field]: value } : ex));
  }, []);

  const addEditEx = useCallback(() => {
    setEditExercises((prev) => [...prev, { name: '' }]);
  }, []);

  const removeEditEx = useCallback((idx: number) => {
    setEditExercises((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-neutral-500" /></div>;

  if (!activeProgram) {
    return (
      <div className="max-w-3xl space-y-4">
        <h2 className="text-lg font-semibold text-white">Программа тренировок</h2>
        {creating ? (
          <div className="space-y-3 bg-neutral-900/50 rounded-lg p-4">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название программы"
              className="w-full bg-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none" />
            <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Описание (необязательно)" rows={2}
              className="w-full bg-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none" />
            <div className="flex gap-2">
              <button onClick={handleCreateProgram} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white transition-colors">Создать</button>
              <button onClick={() => setCreating(false)} className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300 transition-colors">Отмена</button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-4">
            <div className="text-neutral-500 text-sm">Нет активной программы тренировок</div>
            <button onClick={() => setCreating(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white transition-colors inline-flex items-center gap-2">
              <Plus size={14} /> Создать программу
            </button>
            <div className="text-xs text-neutral-600 mt-2">Или попросите ИИ составить программу в чате</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-white flex-1">{activeProgram.name}</h2>
        <span className="text-xs text-neutral-500 bg-neutral-800 rounded px-2 py-0.5">{activeProgram.status}</span>
      </div>
      {activeProgram.description && <p className="text-sm text-neutral-400">{activeProgram.description}</p>}

      <div className="space-y-3">
        {days.map((day) => (
          <div key={day.id} className="bg-neutral-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-neutral-200 flex-1">{day.dayName}</h3>
              {editingDay === day.id ? (
                <button onClick={saveEditDay} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"><Check size={12} /> Сохранить</button>
              ) : (
                <button onClick={() => startEditDay(day)} className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1"><Pencil size={12} /> Редактировать</button>
              )}
              <ConfirmDelete label={day.dayName} onConfirm={() => handleDeleteDay(day.id)} variant="icon" iconSize={12} className="text-xs text-neutral-600 hover:text-red-400" />
            </div>

            {editingDay === day.id ? (
              <div className="space-y-2">
                {editExercises.map((ex, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input value={ex.name} onChange={(e) => updateEditEx(idx, 'name', e.target.value)}
                      className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none flex-1" placeholder="Упражнение" />
                    <input value={ex.sets ?? ''} onChange={(e) => updateEditEx(idx, 'sets', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none w-12 text-center" placeholder="Сеты" type="number" />
                    <span className="text-neutral-600 text-xs">&times;</span>
                    <input value={ex.reps ?? ''} onChange={(e) => updateEditEx(idx, 'reps', e.target.value || undefined)}
                      className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none w-16 text-center" placeholder="Повт." />
                    <input value={ex.weightKg ?? ''} onChange={(e) => updateEditEx(idx, 'weightKg', e.target.value ? parseFloat(e.target.value) : undefined)}
                      className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none w-16 text-center" placeholder="кг" type="number" step="0.5" />
                    <button onClick={() => removeEditEx(idx)} className="text-neutral-600 hover:text-red-400"><X size={14} /></button>
                  </div>
                ))}
                <button onClick={addEditEx} className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1 mt-1"><Plus size={12} /> Добавить упражнение</button>
              </div>
            ) : (
              <div className="space-y-1">
                {day.exercises.length === 0 ? (
                  <div className="text-xs text-neutral-600">Нет упражнений</div>
                ) : day.exercises.map((ex, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs text-neutral-300">
                    <span className="flex-1">{ex.name}</span>
                    {ex.sets != null && ex.reps != null && <span className="text-neutral-500">{ex.sets}&times;{ex.reps}</span>}
                    {ex.weightKg != null && <span className="text-neutral-600">{ex.weightKg} кг</span>}
                  </div>
                ))}
              </div>
            )}

            {day.notes && <p className="text-xs text-neutral-500 mt-2">{day.notes}</p>}
          </div>
        ))}
      </div>

      <button onClick={handleAddDay}
        className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
        <Plus size={14} /> Добавить день
      </button>
    </div>
  );
}

// --- Nutrition View ---

function NutritionView({ todayMeals, activePlan, onChanged }: {
  todayMeals: Meal[]; activePlan: MealPlan | null; onChanged: () => void;
}) {
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null);
  const [mealTitle, setMealTitle] = useState('');
  const [mealCalories, setMealCalories] = useState('');
  const [mealProtein, setMealProtein] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [mealFat, setMealFat] = useState('');
  const [saving, setSaving] = useState(false);

  const totalCal = todayMeals.reduce((s, m) => s + (m.calories ?? 0), 0);
  const totalProtein = todayMeals.reduce((s, m) => s + (m.proteinG ?? 0), 0);
  const totalCarbs = todayMeals.reduce((s, m) => s + (m.carbsG ?? 0), 0);
  const totalFat = todayMeals.reduce((s, m) => s + (m.fatG ?? 0), 0);
  const calTarget = activePlan?.dailyCalories ?? 0;

  const handleSaveMeal = useCallback(async () => {
    if (!addingMeal) return;
    setSaving(true);
    try {
      await window.db.health.meals.create({
        type: addingMeal,
        title: mealTitle || null,
        calories: mealCalories ? parseInt(mealCalories, 10) : null,
        proteinG: mealProtein ? parseInt(mealProtein, 10) : null,
        carbsG: mealCarbs ? parseInt(mealCarbs, 10) : null,
        fatG: mealFat ? parseInt(mealFat, 10) : null,
        date: todayStr(),
      });
      setAddingMeal(null);
      setMealTitle(''); setMealCalories(''); setMealProtein(''); setMealCarbs(''); setMealFat('');
      onChanged();
    } catch (err) { console.error('Failed to save meal:', err); }
    finally { setSaving(false); }
  }, [addingMeal, mealTitle, mealCalories, mealProtein, mealCarbs, mealFat, onChanged]);

  const { pushUndo } = useUndo();

  const handleDeleteMeal = useCallback(async (id: string) => {
    try {
      const saved = todayMeals.find((m) => m.id === id);
      await window.db.health.meals.delete(id);
      onChanged();
      if (saved) pushUndo({ label: saved.title ?? 'приём пищи', restoreFn: async () => { await window.db.health.meals.create(saved); onChanged(); } });
    } catch (err) { console.error('Failed to delete meal:', err); }
  }, [onChanged, todayMeals, pushUndo]);

  const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

  return (
    <div className="max-w-3xl space-y-5">
      {/* Plan targets */}
      {activePlan && (
        <div className="bg-neutral-900/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-medium text-neutral-200 flex-1">{activePlan.name}</h3>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center text-xs">
            <div>
              <div className="text-neutral-500">Калории</div>
              <div className="text-white font-medium">{activePlan.dailyCalories ?? '—'}</div>
            </div>
            <div>
              <div className="text-neutral-500">Белки</div>
              <div className="text-white font-medium">{activePlan.proteinG ? `${activePlan.proteinG}г` : '—'}</div>
            </div>
            <div>
              <div className="text-neutral-500">Углеводы</div>
              <div className="text-white font-medium">{activePlan.carbsG ? `${activePlan.carbsG}г` : '—'}</div>
            </div>
            <div>
              <div className="text-neutral-500">Жиры</div>
              <div className="text-white font-medium">{activePlan.fatG ? `${activePlan.fatG}г` : '—'}</div>
            </div>
          </div>
          {calTarget > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-neutral-400">{totalCal} / {calTarget} ккал</span>
                <span className="text-neutral-500">{Math.round((totalCal / calTarget) * 100)}%</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${totalCal > calTarget ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (totalCal / calTarget) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meals by type */}
      {mealTypes.map((type) => {
        const mealsOfType = todayMeals.filter((m) => m.type === type);
        const meta = MEAL_TYPE_META[type];
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{meta.icon}</span>
              <h3 className="text-sm font-medium text-neutral-300 flex-1">{meta.label}</h3>
              <button onClick={() => { setAddingMeal(type); setMealTitle(''); setMealCalories(''); setMealProtein(''); setMealCarbs(''); setMealFat(''); }}
                className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1"><Plus size={12} /></button>
            </div>

            {addingMeal === type && (
              <div className="bg-neutral-900/50 rounded-lg p-3 mb-2 space-y-2">
                <input value={mealTitle} onChange={(e) => setMealTitle(e.target.value)} placeholder="Что ели?"
                  className="w-full bg-neutral-800 rounded px-3 py-1.5 text-sm text-white outline-none" autoFocus />
                <div className="grid grid-cols-4 gap-2">
                  <input value={mealCalories} onChange={(e) => setMealCalories(e.target.value)} placeholder="ккал" type="number"
                    className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none text-center" />
                  <input value={mealProtein} onChange={(e) => setMealProtein(e.target.value)} placeholder="Б (г)" type="number"
                    className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none text-center" />
                  <input value={mealCarbs} onChange={(e) => setMealCarbs(e.target.value)} placeholder="У (г)" type="number"
                    className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none text-center" />
                  <input value={mealFat} onChange={(e) => setMealFat(e.target.value)} placeholder="Ж (г)" type="number"
                    className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none text-center" />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveMeal} disabled={saving}
                    className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs text-white transition-colors">Добавить</button>
                  <button onClick={() => setAddingMeal(null)}
                    className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 transition-colors">Отмена</button>
                </div>
              </div>
            )}

            {mealsOfType.length === 0 && addingMeal !== type ? (
              <div className="text-xs text-neutral-600 pl-7 mb-2">Ещё не записано</div>
            ) : (
              <div className="space-y-1 mb-2">
                {mealsOfType.map((meal) => (
                  <div key={meal.id} className="flex items-center gap-3 px-3 py-2 rounded bg-neutral-900/30 text-xs group">
                    <span className="text-neutral-200 flex-1 truncate">{meal.title ?? 'Без названия'}</span>
                    {meal.calories != null && <span className="text-neutral-400">{meal.calories} ккал</span>}
                    {meal.proteinG != null && <span className="text-neutral-500">Б{meal.proteinG}</span>}
                    {meal.carbsG != null && <span className="text-neutral-500">У{meal.carbsG}</span>}
                    {meal.fatG != null && <span className="text-neutral-500">Ж{meal.fatG}</span>}
                    <span className="opacity-0 group-hover:opacity-100 transition-all">
                      <ConfirmDelete label={meal.title ?? 'приём пищи'} onConfirm={() => handleDeleteMeal(meal.id)} variant="icon" iconSize={12} className="text-neutral-700 hover:text-red-400" />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Daily totals */}
      <div className="bg-neutral-900/50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-neutral-300 mb-2">Итого за день</h3>
        <div className="grid grid-cols-4 gap-3 text-center text-xs">
          <div><div className="text-neutral-500">Калории</div><div className="text-white font-medium">{totalCal}</div></div>
          <div><div className="text-neutral-500">Белки</div><div className="text-white font-medium">{totalProtein}г</div></div>
          <div><div className="text-neutral-500">Углеводы</div><div className="text-white font-medium">{totalCarbs}г</div></div>
          <div><div className="text-neutral-500">Жиры</div><div className="text-white font-medium">{totalFat}г</div></div>
        </div>
      </div>

      {!activePlan && (
        <div className="text-xs text-neutral-600 text-center py-2">
          Нет активного плана питания. Попросите ИИ составить план в чате.
        </div>
      )}
    </div>
  );
}

// --- Stats View ---

type StatsPeriod = '1w' | '1m' | '3m' | '6m' | '1y';

const PERIOD_LABELS: { id: StatsPeriod; label: string }[] = [
  { id: '1w', label: 'Неделя' },
  { id: '1m', label: 'Месяц' },
  { id: '3m', label: '3 месяца' },
  { id: '6m', label: 'Полгода' },
  { id: '1y', label: 'Год' },
];

function getPeriodStart(period: StatsPeriod): string {
  const d = new Date();
  switch (period) {
    case '1w': d.setDate(d.getDate() - 7); break;
    case '1m': d.setMonth(d.getMonth() - 1); break;
    case '3m': d.setMonth(d.getMonth() - 3); break;
    case '6m': d.setMonth(d.getMonth() - 6); break;
    case '1y': d.setFullYear(d.getFullYear() - 1); break;
  }
  return d.toISOString().slice(0, 10);
}

function groupByWeek(dates: string[]): Record<string, number> {
  const weeks: Record<string, number> = {};
  for (const d of dates) {
    const dt = new Date(d);
    const wStart = new Date(dt);
    wStart.setDate(dt.getDate() - dt.getDay() + 1);
    const key = wStart.toISOString().slice(0, 10);
    weeks[key] = (weeks[key] ?? 0) + 1;
  }
  return weeks;
}

function StatsView({ workouts, allLogs, allMeals, activePlan }: {
  workouts: WorkoutV2[]; allLogs: HealthLog[]; allMeals: Meal[]; activePlan: MealPlan | null;
}) {
  const [period, setPeriod] = useState<StatsPeriod>('1m');
  const start = getPeriodStart(period);
  const today = todayStr();

  const filteredWorkouts = workouts.filter((w) => w.date >= start);
  const filteredLogs = allLogs.filter((l) => l.date >= start);
  const filteredMeals = allMeals.filter((m) => m.date >= start);

  // Workout stats
  const workoutWeeks = groupByWeek(filteredWorkouts.map((w) => w.date));
  const totalDuration = filteredWorkouts.reduce((s, w) => s + (w.durationMinutes ?? 0), 0);
  const totalHours = Math.floor(totalDuration / 60);
  const totalMins = totalDuration % 60;

  // Weight data
  const weightLogs = filteredLogs.filter((l) => l.type === 'weight' && l.value != null).sort((a, b) => a.date.localeCompare(b.date));
  const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1]?.value ?? null : null;
  const startWeight = weightLogs.length > 0 ? weightLogs[0]?.value ?? null : null;
  const weightDelta = currentWeight != null && startWeight != null ? Math.round((currentWeight - startWeight) * 10) / 10 : null;

  // Calories by day
  const caloriesByDay: Record<string, number> = {};
  for (const m of filteredMeals) {
    caloriesByDay[m.date] = (caloriesByDay[m.date] ?? 0) + (m.calories ?? 0);
  }
  const calDays = Object.entries(caloriesByDay).sort((a, b) => a[0].localeCompare(b[0]));
  const avgCalories = calDays.length > 0 ? Math.round(calDays.reduce((s, [, v]) => s + v, 0) / calDays.length) : 0;
  const calTarget = activePlan?.dailyCalories ?? 0;

  // Sleep data
  const sleepLogs = filteredLogs.filter((l) => l.type === 'sleep' && l.value != null).sort((a, b) => a.date.localeCompare(b.date));
  const avgSleep = sleepLogs.length > 0 ? Math.round((sleepLogs.reduce((s, l) => s + (l.value ?? 0), 0) / sleepLogs.length) * 10) / 10 : null;

  // Water data
  const waterLogs = filteredLogs.filter((l) => l.type === 'water' && l.value != null).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="max-w-4xl space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-1">
        {PERIOD_LABELS.map((p) => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              period === p.id ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
            }`}>{p.label}</button>
        ))}
      </div>

      {/* Chart 1: Workouts */}
      <ChartSection title="Тренировки" subtitle={`Всего: ${filteredWorkouts.length} тренировок, ${totalHours}ч ${totalMins}мин`}>
        {Object.keys(workoutWeeks).length === 0 ? (
          <EmptyChart />
        ) : (
          <BarChart
            data={Object.entries(workoutWeeks).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({
              label: formatDate(k), value: v,
              color: 'bg-blue-500',
            }))}
            maxValue={Math.max(...Object.values(workoutWeeks), 1)}
          />
        )}
      </ChartSection>

      {/* Chart 2: Weight */}
      <ChartSection title="Вес" subtitle={
        currentWeight != null
          ? `Текущий: ${currentWeight} кг${weightDelta != null ? ` (${weightDelta > 0 ? '+' : ''}${weightDelta} кг)` : ''}`
          : 'Нет данных'
      }>
        {weightLogs.length === 0 ? (
          <EmptyChart />
        ) : (
          <LineChart points={weightLogs.map((l) => ({ label: formatDate(l.date), value: l.value ?? 0 }))} />
        )}
      </ChartSection>

      {/* Chart 3: Calories */}
      <ChartSection title="Калории" subtitle={`Среднее: ${avgCalories} ккал/день`}>
        {calDays.length === 0 ? (
          <EmptyChart />
        ) : (
          <BarChart
            data={calDays.map(([d, v]) => ({ label: formatDate(d), value: v, color: v > calTarget && calTarget > 0 ? 'bg-red-500' : 'bg-amber-500' }))}
            maxValue={Math.max(...calDays.map(([, v]) => v), calTarget, 1)}
            targetLine={calTarget > 0 ? calTarget : undefined}
          />
        )}
      </ChartSection>

      {/* Chart 4: Sleep */}
      <ChartSection title="Сон" subtitle={avgSleep != null ? `Среднее: ${avgSleep} ч/день` : 'Нет данных'}>
        {sleepLogs.length === 0 ? (
          <EmptyChart />
        ) : (
          <BarChart
            data={sleepLogs.map((l) => {
              const v = l.value ?? 0;
              const color = v < 6 ? 'bg-red-500' : v < 7 ? 'bg-yellow-500' : v <= 9 ? 'bg-emerald-500' : 'bg-blue-500';
              return { label: formatDate(l.date), value: v, color };
            })}
            maxValue={Math.max(...sleepLogs.map((l) => l.value ?? 0), 10)}
          />
        )}
      </ChartSection>

      {/* Chart 5: Water */}
      <ChartSection title="Вода" subtitle={`Цель: 2 л/день`}>
        {waterLogs.length === 0 ? (
          <EmptyChart />
        ) : (
          <BarChart
            data={waterLogs.map((l) => ({
              label: formatDate(l.date), value: l.value ?? 0,
              color: (l.value ?? 0) >= 2 ? 'bg-cyan-500' : 'bg-cyan-800',
            }))}
            maxValue={Math.max(...waterLogs.map((l) => l.value ?? 0), 3)}
            targetLine={2}
          />
        )}
      </ChartSection>
    </div>
  );
}

function ChartSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-200">{title}</h3>
        <span className="text-[10px] text-neutral-500">{subtitle}</span>
      </div>
      {children}
    </div>
  );
}

function EmptyChart() {
  return <div className="h-32 flex items-center justify-center text-xs text-neutral-600">Нет данных за этот период</div>;
}

function BarChart({ data, maxValue, targetLine }: {
  data: { label: string; value: number; color: string }[];
  maxValue: number;
  targetLine?: number;
}) {
  return (
    <div className="relative">
      {targetLine != null && maxValue > 0 && (
        <div className="absolute left-0 right-0 border-t border-dashed border-neutral-600 z-10"
          style={{ bottom: `${(targetLine / maxValue) * 128}px` }}>
          <span className="absolute -top-3 right-0 text-[9px] text-neutral-500">{targetLine}</span>
        </div>
      )}
      <div className="flex items-end gap-1 h-32 overflow-x-auto">
        {data.map((d, i) => {
          const pct = maxValue > 0 ? (d.value / maxValue) * 100 : 0;
          return (
            <div key={i} className="flex flex-col items-center flex-1 min-w-[16px] max-w-[40px] group" title={`${d.label}: ${d.value}`}>
              <div className="w-full flex-1 flex items-end">
                <div className={`w-full rounded-t ${d.color} transition-all`} style={{ height: `${Math.max(pct, 2)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {data.length <= 20 && (
        <div className="flex gap-1 mt-1">
          {data.map((d, i) => (
            <div key={i} className="flex-1 min-w-[16px] max-w-[40px] text-center text-[8px] text-neutral-600 truncate">{d.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function LineChart({ points }: { points: { label: string; value: number }[] }) {
  if (points.length === 0) return <EmptyChart />;
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const range = max - min || 1;

  return (
    <div>
      <div className="relative h-32">
        {/* Y axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[8px] text-neutral-600 w-8">
          <span>{max.toFixed(1)}</span>
          <span>{((max + min) / 2).toFixed(1)}</span>
          <span>{min.toFixed(1)}</span>
        </div>
        {/* Points + lines */}
        <div className="ml-9 h-full flex items-end gap-0">
          {points.map((p, i) => {
            const pct = ((p.value - min) / range) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative group" title={`${p.label}: ${p.value}`}>
                <div className="absolute" style={{ bottom: `${pct}%` }}>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 border border-neutral-900" />
                </div>
                {/* Connect line */}
                {i > 0 && (() => {
                  const prevPct = (((points[i - 1]?.value ?? 0) - min) / range) * 100;
                  const angle = Math.atan2(pct - prevPct, 100 / points.length) * (180 / Math.PI);
                  const length = Math.sqrt(Math.pow(100 / points.length, 2) + Math.pow(pct - prevPct, 2));
                  return (
                    <div className="absolute h-px bg-emerald-500/50"
                      style={{
                        bottom: `${prevPct}%`,
                        left: '-50%',
                        width: `${length}%`,
                        transform: `rotate(${-angle}deg)`,
                        transformOrigin: 'left center',
                      }} />
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
      {points.length <= 15 && (
        <div className="flex gap-0 ml-9 mt-1">
          {points.map((p, i) => (
            <div key={i} className="flex-1 text-center text-[8px] text-neutral-600 truncate">{p.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Goals View ---

function GoalsView({ goals, onChanged }: { goals: HealthGoal[]; onChanged: () => void }) {
  const activeGoals = goals.filter((g) => g.status === 'active');
  const completedGoals = goals.filter((g) => g.status === 'completed');

  return (
    <div className="max-w-3xl space-y-4">
      <h2 className="text-lg font-semibold text-white">Цели</h2>

      {activeGoals.length === 0 && completedGoals.length === 0 ? (
        <div className="text-sm text-neutral-600 py-8 text-center">
          Нет целей. Попросите ИИ поставить цель в чате.
        </div>
      ) : (
        <>
          {activeGoals.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm text-neutral-400">Активные</h3>
              {activeGoals.map((g) => (
                <GoalCard key={g.id} goal={g} onChanged={onChanged} />
              ))}
            </div>
          )}
          {completedGoals.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm text-neutral-500 mt-4">Завершённые</h3>
              {completedGoals.map((g) => (
                <GoalCard key={g.id} goal={g} onChanged={onChanged} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GoalCard({ goal, onChanged }: { goal: HealthGoal; onChanged: () => void }) {
  const pct = goal.targetValue && goal.targetValue > 0
    ? Math.min(100, Math.round(((goal.currentValue ?? 0) / goal.targetValue) * 100))
    : 0;

  const handleComplete = useCallback(async () => {
    try { await window.db.health.goals.update(goal.id, { status: 'completed' }); onChanged(); }
    catch (err) { console.error(err); }
  }, [goal.id, onChanged]);

  return (
    <div className="bg-neutral-900/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-neutral-200 flex-1">{goal.title}</span>
        {goal.type && <span className="text-[10px] text-neutral-500 bg-neutral-800 rounded px-1.5 py-0.5">{goal.type}</span>}
        {goal.deadline && <span className="text-[10px] text-neutral-600">до {formatDate(goal.deadline)}</span>}
      </div>
      {goal.targetValue != null && (
        <>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-neutral-400">{goal.currentValue ?? 0} / {goal.targetValue} {goal.unit ?? ''}</span>
            <span className="text-neutral-500">{pct}%</span>
          </div>
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${goal.status === 'completed' ? 'bg-emerald-600' : 'bg-blue-500'}`}
              style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
      {goal.status === 'active' && (
        <button onClick={handleComplete} className="text-xs text-neutral-500 hover:text-emerald-400 mt-2 flex items-center gap-1">
          <Check size={12} /> Завершить
        </button>
      )}
    </div>
  );
}

// --- Workout Detail View ---

function WorkoutDetailView({ workoutId, onBack, onDeleted, onUpdated }: {
  workoutId: string; onBack: () => void; onDeleted: () => void; onUpdated: () => void;
}) {
  const [workout, setWorkout] = useState<WorkoutV2 | null>(null);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editMood, setEditMood] = useState<WorkoutMood | ''>('');

  const loadWorkout = useCallback(async () => {
    try {
      const [allWorkouts, exs] = await Promise.all([
        window.db.health.workouts.list(),
        window.db.health.exercises.list(workoutId),
      ]);
      const w = allWorkouts.find((w) => w.id === workoutId) ?? null;
      setWorkout(w);
      setExercises(exs);
      if (w) {
        setEditTitle(w.title ?? '');
        setEditNotes(w.notes ?? '');
        setEditDuration(w.durationMinutes != null ? String(w.durationMinutes) : '');
        setEditMood(w.mood ?? '');
      }
    } catch (err) { console.error('Failed to load workout:', err); }
    finally { setLoading(false); }
  }, [workoutId]);

  useEffect(() => { loadWorkout(); }, [loadWorkout]);

  const handleSaveEdit = useCallback(async () => {
    if (!workout) return;
    try {
      await window.db.health.workouts.update(workout.id, {
        title: editTitle || null, notes: editNotes || null,
        durationMinutes: editDuration ? parseInt(editDuration, 10) : null, mood: editMood || null,
      });
      setEditing(false); loadWorkout(); onUpdated();
    } catch (err) { console.error('Failed to update workout:', err); }
  }, [workout, editTitle, editNotes, editDuration, editMood, loadWorkout, onUpdated]);

  const { pushUndo } = useUndo();

  const handleDelete = useCallback(async () => {
    if (!workout) return;
    try {
      const saved = { ...workout };
      await window.db.health.workouts.delete(workout.id);
      onDeleted();
      pushUndo({ label: saved.title ?? 'тренировка', restoreFn: async () => { await window.db.health.workouts.create(saved); onDeleted(); } });
    } catch (err) { console.error('Failed to delete workout:', err); }
  }, [workout, onDeleted, pushUndo]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-neutral-500" /></div>;
  if (!workout) return <div className="text-neutral-500 text-sm">Тренировка не найдена. <button onClick={onBack} className="ml-2 text-blue-400 hover:underline">Назад</button></div>;

  const meta = WORKOUT_TYPE_META[workout.type] ?? WORKOUT_TYPE_META.other;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-neutral-500 hover:text-neutral-300 transition-colors"><ChevronLeft size={20} /></button>
        <div className="flex-1">
          {editing ? (
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
              className="bg-neutral-800 rounded px-2 py-1 text-lg text-white outline-none w-full" placeholder="Название тренировки" />
          ) : (
            <h2 className="text-lg font-semibold text-white">{workout.title ?? meta.label}</h2>
          )}
        </div>
        <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${meta.color}`}>{meta.icon} {meta.label}</span>
      </div>

      <div className="flex items-center gap-4 text-sm text-neutral-400">
        <span>{formatDate(workout.date)}</span>
        {editing ? (
          <input type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)}
            className="bg-neutral-800 rounded px-2 py-0.5 text-sm text-white outline-none w-20" placeholder="мин" />
        ) : workout.durationMinutes ? <span>{workout.durationMinutes} мин</span> : null}
        {editing ? (
          <div className="flex gap-1">
            {MOOD_OPTIONS.map((m) => (
              <button key={m.value} onClick={() => setEditMood(m.value)}
                className={`text-lg px-1 rounded ${editMood === m.value ? 'bg-neutral-700' : 'hover:bg-neutral-800'}`} title={m.label}>{m.emoji}</button>
            ))}
          </div>
        ) : workout.mood ? <span>{MOOD_EMOJI[workout.mood]} {MOOD_OPTIONS.find((m) => m.value === workout.mood)?.label}</span> : null}
      </div>

      {exercises.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-neutral-400 mb-2">Упражнения</h3>
          <div className="space-y-1">
            {exercises.map((ex) => (
              <div key={ex.id} className="flex items-center gap-3 px-3 py-2 rounded bg-neutral-900/50 text-sm">
                <span className="text-neutral-200 flex-1">{ex.name}</span>
                {ex.sets != null && ex.reps != null && <span className="text-neutral-400">{ex.sets}&times;{ex.reps}</span>}
                {ex.weightKg != null && <span className="text-neutral-500">{ex.weightKg} кг</span>}
                {ex.distanceKm != null && <span className="text-neutral-500">{ex.distanceKm} км</span>}
                {ex.durationMinutes != null && <span className="text-neutral-500">{ex.durationMinutes} мин</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {editing ? (
        <div>
          <h3 className="text-sm font-medium text-neutral-400 mb-2">Заметки</h3>
          <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3}
            className="w-full bg-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none" placeholder="Заметки..." />
        </div>
      ) : workout.notes ? (
        <div>
          <h3 className="text-sm font-medium text-neutral-400 mb-1">Заметки</h3>
          <p className="text-sm text-neutral-300 whitespace-pre-wrap">{workout.notes}</p>
        </div>
      ) : null}

      <div className="flex gap-2 pt-2">
        {editing ? (
          <>
            <button onClick={handleSaveEdit} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white transition-colors">Сохранить</button>
            <button onClick={() => setEditing(false)} className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300 transition-colors">Отмена</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300 transition-colors">Редактировать</button>
            <ConfirmDelete label={workout?.title ?? 'тренировку'} onConfirm={handleDelete} variant="button" />
          </>
        )}
      </div>
    </div>
  );
}

// --- Add Workout View ---

interface ExerciseInput { key: string; name: string; sets: string; reps: string; weight: string; distance: string; duration: string; }

function newExerciseInput(): ExerciseInput {
  return { key: Math.random().toString(36).slice(2), name: '', sets: '', reps: '', weight: '', distance: '', duration: '' };
}

function AddWorkoutView({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [type, setType] = useState<WorkoutTypeV2>('gym');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [mood, setMood] = useState<WorkoutMood | ''>('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<ExerciseInput[]>([newExerciseInput()]);
  const [saving, setSaving] = useState(false);

  const updateExercise = useCallback((key: string, field: keyof ExerciseInput, value: string) => {
    setExercises((prev) => prev.map((ex) => ex.key === key ? { ...ex, [field]: value } : ex));
  }, []);

  const removeExercise = useCallback((key: string) => {
    setExercises((prev) => prev.filter((ex) => ex.key !== key));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const workout = await window.db.health.workouts.create({
        type, title: title || null, durationMinutes: duration ? parseInt(duration, 10) : null,
        mood: mood || null, notes: notes || null, date: todayStr(),
      });
      const validExercises = exercises.filter((ex) => ex.name.trim());
      for (let i = 0; i < validExercises.length; i++) {
        const ex = validExercises[i];
        await window.db.health.exercises.create({
          workoutId: workout.id, name: ex.name.trim(), sets: ex.sets ? parseInt(ex.sets, 10) : null,
          reps: ex.reps || null, weightKg: ex.weight ? parseFloat(ex.weight) : null,
          distanceKm: ex.distance ? parseFloat(ex.distance) : null, durationMinutes: ex.duration ? parseInt(ex.duration, 10) : null,
          orderIndex: i,
        });
      }
      onSaved();
    } catch (err) { console.error('Failed to save workout:', err); }
    finally { setSaving(false); }
  }, [type, title, duration, mood, notes, exercises, onSaved]);

  const workoutTypes: WorkoutTypeV2[] = ['gym', 'running', 'cycling', 'calisthenics', 'stretching', 'swimming', 'other'];

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-neutral-500 hover:text-neutral-300 transition-colors"><ChevronLeft size={20} /></button>
        <h2 className="text-lg font-semibold text-white">Новая тренировка</h2>
      </div>

      <div>
        <label className="text-xs text-neutral-500 mb-2 block">Тип тренировки</label>
        <div className="flex gap-1.5 flex-wrap">
          {workoutTypes.map((t) => {
            const meta = WORKOUT_TYPE_META[t];
            return (
              <button key={t} onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
                  type === t ? `${meta.color} ring-1 ring-white/20` : 'bg-neutral-800/50 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                }`}>{meta.icon} {meta.label}</button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Название</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none" placeholder="Грудь + трицепс" />
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Длительность (мин)</label>
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
            className="w-full bg-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none" placeholder="60" />
        </div>
      </div>

      <div>
        <label className="text-xs text-neutral-500 mb-2 block">Упражнения</label>
        <div className="space-y-2">
          {exercises.map((ex) => (
            <div key={ex.key} className="flex items-center gap-2 bg-neutral-900/50 rounded-lg px-3 py-2">
              <input value={ex.name} onChange={(e) => updateExercise(ex.key, 'name', e.target.value)}
                className="bg-transparent text-sm text-white outline-none flex-1 min-w-0" placeholder="Название" />
              <input value={ex.sets} onChange={(e) => updateExercise(ex.key, 'sets', e.target.value)}
                className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none w-12 text-center" placeholder="Сеты" type="number" />
              <span className="text-neutral-600 text-xs">&times;</span>
              <input value={ex.reps} onChange={(e) => updateExercise(ex.key, 'reps', e.target.value)}
                className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none w-16 text-center" placeholder="Повт." />
              <input value={ex.weight} onChange={(e) => updateExercise(ex.key, 'weight', e.target.value)}
                className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none w-16 text-center" placeholder="кг" type="number" step="0.5" />
              {exercises.length > 1 && (
                <button onClick={() => removeExercise(ex.key)} className="text-neutral-600 hover:text-red-400 transition-colors"><X size={14} /></button>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => setExercises((prev) => [...prev, newExerciseInput()])}
          className="mt-2 flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"><Plus size={14} /> Добавить упражнение</button>
      </div>

      <div>
        <label className="text-xs text-neutral-500 mb-2 block">Настроение</label>
        <div className="flex gap-2">
          {MOOD_OPTIONS.map((m) => (
            <button key={m.value} onClick={() => setMood(mood === m.value ? '' : m.value)}
              className={`text-xl px-2 py-1 rounded-lg transition-colors ${mood === m.value ? 'bg-neutral-700 ring-1 ring-white/20' : 'hover:bg-neutral-800'}`}
              title={m.label}>{m.emoji}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-neutral-500 mb-1 block">Заметки</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          className="w-full bg-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none" placeholder="Как прошла тренировка..." />
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm text-white font-medium transition-colors flex items-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin" />} Сохранить
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300 transition-colors">Отмена</button>
      </div>
    </div>
  );
}
