import { useState, useRef, useCallback, useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useSidebar } from '../context/sidebar-context';
import type { WorkoutV2, WorkoutExercise, HealthLog, HealthGoal, WorkoutTypeV2, WorkoutMood } from '@mark2/shared';
import {
  Dumbbell, Activity, Droplets, Moon, Scale, Brain, Target,
  ChevronLeft, Plus, Trash2, X, Bike, Waves, PersonStanding, StretchHorizontal, Loader2,
} from 'lucide-react';

// --- Types ---

type MainView =
  | { kind: 'overview' }
  | { kind: 'workout-detail'; workoutId: string }
  | { kind: 'add-workout' };

// --- Constants ---

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

function monthAgoStr(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
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
  const [loading, setLoading] = useState(true);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 400;

  const reloadData = useCallback(async () => {
    try {
      const today = todayStr();
      const [w, g, logs] = await Promise.all([
        window.db.health.workouts.list(),
        window.db.health.goals.list(),
        window.db.health.logs.list(undefined, today, today),
      ]);
      setWorkouts(w);
      setGoals(g);
      setTodayLogs(logs);
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

  return (
    <MainLayout agent="health" noPadding defaultChatWidthPct={30}>
      <div className="flex flex-1 h-full overflow-hidden">
        {/* === SIDEBAR === */}
        <aside
          className="shrink-0 border-r border-neutral-800 flex flex-col bg-neutral-950/50 overflow-hidden transition-[width] duration-200 ease-in-out"
          style={{ width: leftCollapsed ? 0 : sidebarWidth }}
        >
          <div className="flex-1 overflow-y-auto pb-4">
            {/* Today section */}
            <div className="px-3 pt-3 pb-2">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                Сегодня
              </div>
              <div className="space-y-1">
                <SidebarTodayItem
                  icon={<Dumbbell size={14} />}
                  label="Тренировка"
                  value={todayWorkout ? (todayWorkout.title ?? WORKOUT_TYPE_META[todayWorkout.type]?.label ?? todayWorkout.type) : 'Нет'}
                  active={!!todayWorkout}
                  onClick={() => todayWorkout ? setMainView({ kind: 'workout-detail', workoutId: todayWorkout.id }) : setMainView({ kind: 'add-workout' })}
                />
                <SidebarTodayItem
                  icon={<Scale size={14} />}
                  label="Вес"
                  value={todayWeight ? `${todayWeight.value} кг` : '—'}
                  active={!!todayWeight}
                  onClick={() => {/* quick input handled in overview */}}
                />
                <SidebarTodayItem
                  icon={<Moon size={14} />}
                  label="Сон"
                  value={todaySleep ? `${todaySleep.value} ч` : '—'}
                  active={!!todaySleep}
                  onClick={() => {}}
                />
                <SidebarTodayItem
                  icon={<Droplets size={14} />}
                  label="Вода"
                  value={todayWater ? `${todayWater.value} л` : '—'}
                  active={!!todayWater}
                  onClick={() => {}}
                />
                <SidebarTodayItem
                  icon={<Brain size={14} />}
                  label="Настроение"
                  value={todayMood?.value != null ? `${todayMood.value}/5` : '—'}
                  active={!!todayMood}
                  onClick={() => {}}
                />
              </div>
            </div>

            <div className="mx-3 border-t border-neutral-800 mt-1 mb-2" />

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
        <main className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="animate-spin text-neutral-500" />
            </div>
          ) : mainView.kind === 'overview' ? (
            <OverviewView
              workouts={workouts}
              todayLogs={todayLogs}
              goals={goals}
              thisMonthCount={thisMonth.length}
              latestWeight={latestWeight}
              onOpenWorkout={(id) => setMainView({ kind: 'workout-detail', workoutId: id })}
              onAddWorkout={() => setMainView({ kind: 'add-workout' })}
              onLogSaved={reloadData}
            />
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
    </MainLayout>
  );
}

// --- Sidebar components ---

function SidebarTodayItem({ icon, label, value, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
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
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// --- Overview View ---

function OverviewView({ workouts, todayLogs, goals, thisMonthCount, latestWeight, onOpenWorkout, onAddWorkout, onLogSaved }: {
  workouts: WorkoutV2[];
  todayLogs: HealthLog[];
  goals: HealthGoal[];
  thisMonthCount: number;
  latestWeight: HealthLog | null;
  onOpenWorkout: (id: string) => void;
  onAddWorkout: () => void;
  onLogSaved: () => void;
}) {
  const [quickInput, setQuickInput] = useState<string | null>(null);
  const [quickValue, setQuickValue] = useState('');
  const [saving, setSaving] = useState(false);

  const todaySleep = todayLogs.find((l) => l.type === 'sleep');
  const todayWater = todayLogs.find((l) => l.type === 'water');

  const handleQuickLog = useCallback(async (type: string, value: string) => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await window.db.health.logs.create({
        type,
        value: parseFloat(value),
        date: todayStr(),
      });
      onLogSaved();
      setQuickInput(null);
      setQuickValue('');
    } catch (err) {
      console.error('Failed to log:', err);
    } finally {
      setSaving(false);
    }
  }, [onLogSaved]);

  const handleMoodLog = useCallback(async (moodValue: number) => {
    setSaving(true);
    try {
      await window.db.health.logs.create({
        type: 'mood',
        value: moodValue,
        date: todayStr(),
      });
      onLogSaved();
      setQuickInput(null);
    } catch (err) {
      console.error('Failed to log mood:', err);
    } finally {
      setSaving(false);
    }
  }, [onLogSaved]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Тренировок"
          value={String(thisMonthCount)}
          sub="этот месяц"
          icon={<Dumbbell size={16} />}
          color="text-blue-400"
        />
        <StatCard
          label="Средний сон"
          value={todaySleep ? `${todaySleep.value}ч` : '—'}
          sub="сегодня"
          icon={<Moon size={16} />}
          color="text-purple-400"
        />
        <StatCard
          label="Текущий вес"
          value={latestWeight ? `${latestWeight.value}кг` : '—'}
          sub="последний замер"
          icon={<Scale size={16} />}
          color="text-emerald-400"
        />
        <StatCard
          label="Вода"
          value={todayWater ? `${todayWater.value}л` : '—'}
          sub="сегодня"
          icon={<Droplets size={16} />}
          color="text-cyan-400"
        />
      </div>

      {/* Quick input */}
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
                        <button
                          key={v}
                          onClick={() => handleMoodLog(v)}
                          disabled={saving}
                          className="w-7 h-7 rounded hover:bg-neutral-700 text-sm transition-colors"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <input
                        type="number"
                        step="0.1"
                        value={quickValue}
                        onChange={(e) => setQuickValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleQuickLog(item.type, quickValue);
                          if (e.key === 'Escape') { setQuickInput(null); setQuickValue(''); }
                        }}
                        autoFocus
                        className="w-16 bg-transparent text-sm text-white outline-none"
                        placeholder="0"
                      />
                      <span className="text-xs text-neutral-500">{item.unit}</span>
                    </>
                  )}
                  <button
                    onClick={() => { setQuickInput(null); setQuickValue(''); }}
                    className="text-neutral-500 hover:text-neutral-300 ml-1"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setQuickInput(item.type); setQuickValue(''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  {item.icon}
                  {item.label}
                </button>
              )}
            </div>
          ))}

          <button
            onClick={onAddWorkout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900/30 hover:bg-blue-900/50 text-xs text-blue-300 transition-colors"
          >
            <Plus size={14} />
            Тренировка
          </button>
        </div>
      </div>

      {/* Recent workouts */}
      <div>
        <h3 className="text-sm font-medium text-neutral-300 mb-3">Последние тренировки</h3>
        {workouts.length === 0 ? (
          <div className="text-sm text-neutral-600 py-8 text-center">
            Нет тренировок. Добавь первую!
          </div>
        ) : (
          <div className="space-y-1.5">
            {workouts.slice(0, 10).map((w) => {
              const meta = WORKOUT_TYPE_META[w.type] ?? WORKOUT_TYPE_META.other;
              return (
                <button
                  key={w.id}
                  onClick={() => onOpenWorkout(w.id)}
                  className="w-full text-left px-4 py-3 rounded-lg bg-neutral-900/50 hover:bg-neutral-800/50 transition-colors flex items-center gap-3"
                >
                  <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${meta.color}`}>
                    {meta.icon}
                    {meta.label}
                  </span>
                  <span className="text-sm text-neutral-200 truncate flex-1">
                    {w.title ?? meta.label}
                  </span>
                  <span className="text-xs text-neutral-500">{formatDate(w.date)}</span>
                  {w.durationMinutes && (
                    <span className="text-xs text-neutral-600">{w.durationMinutes} мин</span>
                  )}
                  {w.mood && (
                    <span className="text-sm">{MOOD_EMOJI[w.mood] ?? ''}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="bg-neutral-900/50 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-xs text-neutral-500">{label}</span>
      </div>
      <div className="text-xl font-semibold text-white">{value}</div>
      <div className="text-[10px] text-neutral-600 mt-0.5">{sub}</div>
    </div>
  );
}

// --- Workout Detail View ---

function WorkoutDetailView({ workoutId, onBack, onDeleted, onUpdated }: {
  workoutId: string;
  onBack: () => void;
  onDeleted: () => void;
  onUpdated: () => void;
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
    } catch (err) {
      console.error('Failed to load workout:', err);
    } finally {
      setLoading(false);
    }
  }, [workoutId]);

  useEffect(() => { loadWorkout(); }, [loadWorkout]);

  const handleSaveEdit = useCallback(async () => {
    if (!workout) return;
    try {
      await window.db.health.workouts.update(workout.id, {
        title: editTitle || null,
        notes: editNotes || null,
        durationMinutes: editDuration ? parseInt(editDuration, 10) : null,
        mood: editMood || null,
      });
      setEditing(false);
      loadWorkout();
      onUpdated();
    } catch (err) {
      console.error('Failed to update workout:', err);
    }
  }, [workout, editTitle, editNotes, editDuration, editMood, loadWorkout, onUpdated]);

  const handleDelete = useCallback(async () => {
    if (!workout) return;
    try {
      await window.db.health.workouts.delete(workout.id);
      onDeleted();
    } catch (err) {
      console.error('Failed to delete workout:', err);
    }
  }, [workout, onDeleted]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-neutral-500" />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="text-neutral-500 text-sm">
        Тренировка не найдена.
        <button onClick={onBack} className="ml-2 text-blue-400 hover:underline">Назад</button>
      </div>
    );
  }

  const meta = WORKOUT_TYPE_META[workout.type] ?? WORKOUT_TYPE_META.other;

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-neutral-500 hover:text-neutral-300 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          {editing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="bg-neutral-800 rounded px-2 py-1 text-lg text-white outline-none w-full"
              placeholder="Название тренировки"
            />
          ) : (
            <h2 className="text-lg font-semibold text-white">
              {workout.title ?? meta.label}
            </h2>
          )}
        </div>
        <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${meta.color}`}>
          {meta.icon} {meta.label}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-sm text-neutral-400">
        <span>{formatDate(workout.date)}</span>
        {editing ? (
          <input
            type="number"
            value={editDuration}
            onChange={(e) => setEditDuration(e.target.value)}
            className="bg-neutral-800 rounded px-2 py-0.5 text-sm text-white outline-none w-20"
            placeholder="мин"
          />
        ) : (
          workout.durationMinutes && <span>{workout.durationMinutes} мин</span>
        )}
        {editing ? (
          <div className="flex gap-1">
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m.value}
                onClick={() => setEditMood(m.value)}
                className={`text-lg px-1 rounded ${editMood === m.value ? 'bg-neutral-700' : 'hover:bg-neutral-800'}`}
                title={m.label}
              >
                {m.emoji}
              </button>
            ))}
          </div>
        ) : (
          workout.mood && <span>{MOOD_EMOJI[workout.mood]} {MOOD_OPTIONS.find((m) => m.value === workout.mood)?.label}</span>
        )}
      </div>

      {/* Exercises */}
      {exercises.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-neutral-400 mb-2">Упражнения</h3>
          <div className="space-y-1">
            {exercises.map((ex) => (
              <div
                key={ex.id}
                className="flex items-center gap-3 px-3 py-2 rounded bg-neutral-900/50 text-sm"
              >
                <span className="text-neutral-200 flex-1">{ex.name}</span>
                {ex.sets != null && ex.reps != null && (
                  <span className="text-neutral-400">
                    {ex.sets}&times;{ex.reps}
                  </span>
                )}
                {ex.weightKg != null && (
                  <span className="text-neutral-500">{ex.weightKg} кг</span>
                )}
                {ex.distanceKm != null && (
                  <span className="text-neutral-500">{ex.distanceKm} км</span>
                )}
                {ex.durationMinutes != null && (
                  <span className="text-neutral-500">{ex.durationMinutes} мин</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {editing ? (
        <div>
          <h3 className="text-sm font-medium text-neutral-400 mb-2">Заметки</h3>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={3}
            className="w-full bg-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none"
            placeholder="Заметки..."
          />
        </div>
      ) : workout.notes ? (
        <div>
          <h3 className="text-sm font-medium text-neutral-400 mb-1">Заметки</h3>
          <p className="text-sm text-neutral-300 whitespace-pre-wrap">{workout.notes}</p>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        {editing ? (
          <>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white transition-colors"
            >
              Сохранить
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300 transition-colors"
            >
              Отмена
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300 transition-colors"
            >
              Редактировать
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-sm text-red-400 transition-colors flex items-center gap-1"
            >
              <Trash2 size={14} />
              Удалить
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// --- Add Workout View ---

interface ExerciseInput {
  key: string;
  name: string;
  sets: string;
  reps: string;
  weight: string;
  distance: string;
  duration: string;
}

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
        type,
        title: title || null,
        durationMinutes: duration ? parseInt(duration, 10) : null,
        mood: mood || null,
        notes: notes || null,
        date: todayStr(),
      });

      // Save exercises
      const validExercises = exercises.filter((ex) => ex.name.trim());
      for (let i = 0; i < validExercises.length; i++) {
        const ex = validExercises[i];
        await window.db.health.exercises.create({
          workoutId: workout.id,
          name: ex.name.trim(),
          sets: ex.sets ? parseInt(ex.sets, 10) : null,
          reps: ex.reps || null,
          weightKg: ex.weight ? parseFloat(ex.weight) : null,
          distanceKm: ex.distance ? parseFloat(ex.distance) : null,
          durationMinutes: ex.duration ? parseInt(ex.duration, 10) : null,
          orderIndex: i,
        });
      }

      onSaved();
    } catch (err) {
      console.error('Failed to save workout:', err);
    } finally {
      setSaving(false);
    }
  }, [type, title, duration, mood, notes, exercises, onSaved]);

  const workoutTypes: WorkoutTypeV2[] = ['gym', 'running', 'cycling', 'calisthenics', 'stretching', 'swimming', 'other'];

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="text-neutral-500 hover:text-neutral-300 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-white">Новая тренировка</h2>
      </div>

      {/* Type */}
      <div>
        <label className="text-xs text-neutral-500 mb-2 block">Тип тренировки</label>
        <div className="flex gap-1.5 flex-wrap">
          {workoutTypes.map((t) => {
            const meta = WORKOUT_TYPE_META[t];
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
                  type === t
                    ? `${meta.color} ring-1 ring-white/20`
                    : 'bg-neutral-800/50 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {meta.icon}
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Title + Duration */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Название</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none"
            placeholder="Грудь + трицепс"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">Длительность (мин)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full bg-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none"
            placeholder="60"
          />
        </div>
      </div>

      {/* Exercises */}
      <div>
        <label className="text-xs text-neutral-500 mb-2 block">Упражнения</label>
        <div className="space-y-2">
          {exercises.map((ex) => (
            <div key={ex.key} className="flex items-center gap-2 bg-neutral-900/50 rounded-lg px-3 py-2">
              <input
                value={ex.name}
                onChange={(e) => updateExercise(ex.key, 'name', e.target.value)}
                className="bg-transparent text-sm text-white outline-none flex-1 min-w-0"
                placeholder="Название"
              />
              <input
                value={ex.sets}
                onChange={(e) => updateExercise(ex.key, 'sets', e.target.value)}
                className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none w-12 text-center"
                placeholder="Сеты"
                type="number"
              />
              <span className="text-neutral-600 text-xs">&times;</span>
              <input
                value={ex.reps}
                onChange={(e) => updateExercise(ex.key, 'reps', e.target.value)}
                className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none w-16 text-center"
                placeholder="Повт."
              />
              <input
                value={ex.weight}
                onChange={(e) => updateExercise(ex.key, 'weight', e.target.value)}
                className="bg-neutral-800 rounded px-2 py-1 text-xs text-white outline-none w-16 text-center"
                placeholder="кг"
                type="number"
                step="0.5"
              />
              {exercises.length > 1 && (
                <button
                  onClick={() => removeExercise(ex.key)}
                  className="text-neutral-600 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => setExercises((prev) => [...prev, newExerciseInput()])}
          className="mt-2 flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <Plus size={14} />
          Добавить упражнение
        </button>
      </div>

      {/* Mood */}
      <div>
        <label className="text-xs text-neutral-500 mb-2 block">Настроение</label>
        <div className="flex gap-2">
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMood(mood === m.value ? '' : m.value)}
              className={`text-xl px-2 py-1 rounded-lg transition-colors ${
                mood === m.value ? 'bg-neutral-700 ring-1 ring-white/20' : 'hover:bg-neutral-800'
              }`}
              title={m.label}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-neutral-500 mb-1 block">Заметки</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full bg-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none"
          placeholder="Как прошла тренировка..."
        />
      </div>

      {/* Save */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm text-white font-medium transition-colors flex items-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Сохранить
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300 transition-colors"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
