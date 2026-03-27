import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check } from 'lucide-react';

interface AggregatedTask {
  id: string;
  title: string;
  time: string | null;
  sphere: string;
  priority: string;
  status: string;
  sourceType: string;
  sourceId: string | null;
  isReminder: boolean;
}

const SPHERE_COLOR: Record<string, string> = {
  teaching: 'bg-green-400',
  dev: 'bg-blue-400',
  study: 'bg-purple-400',
  health: 'bg-orange-400',
  finance: 'bg-yellow-400',
  personal: 'bg-neutral-400',
};

const SPHERE_ROUTE: Record<string, string> = {
  teaching: '/teaching',
  dev: '/dev',
  study: '/study',
  health: '/health',
  finance: '/finance',
};

const MONTH_NAMES = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function getTimeGroup(time: string | null): 'morning' | 'day' | 'evening' | 'none' {
  if (!time) return 'none';
  const hour = parseInt(time.split(':')[0] ?? '0', 10);
  if (hour < 12) return 'morning';
  if (hour < 18) return 'day';
  return 'evening';
}

const GROUP_LABELS: Record<string, string> = {
  morning: 'Утро',
  day: 'День',
  evening: 'Вечер',
  none: 'Без времени',
};

export function TodayPanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<AggregatedTask[]>([]);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dateFormatted = `${today.getDate()} ${MONTH_NAMES[today.getMonth()]}`;

  const reload = useCallback(async () => {
    try {
      const result = await window.tasks.getAggregated(todayStr);
      setTasks(result);
    } catch {
      setTasks([]);
    }
  }, [todayStr]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    return window.dataEvents.onDataChanged(() => {
      reload();
    });
  }, [reload]);

  useEffect(() => {
    if (addingTask && inputRef.current) {
      inputRef.current.focus();
    }
  }, [addingTask]);

  const handleComplete = async (task: AggregatedTask) => {
    try {
      if (task.isReminder) {
        if (task.status === 'done') {
          await window.db.reminders.uncomplete(task.id);
        } else {
          await window.db.reminders.complete(task.id);
        }
        window.dataEvents.emitDataChanged(['reminders']);
      }
    } catch {
      // ignore
    }
  };

  const handleAddTask = async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    try {
      await window.db.reminders.create({
        title,
        date: todayStr,
        time: null,
        priority: 'medium',
        status: 'pending',
        sphere: 'personal',
        sourceType: 'manual',
        isRecurring: false,
      });
      setNewTaskTitle('');
      setAddingTask(false);
      window.dataEvents.emitDataChanged(['reminders']);
    } catch {
      // ignore
    }
  };

  const handleTaskClick = (task: AggregatedTask) => {
    const route = SPHERE_ROUTE[task.sphere];
    if (route) {
      navigate(route);
    }
  };

  // Split into done/pending, group pending by time
  const pending = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const totalCount = tasks.length;
  const doneCount = done.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Group pending tasks
  const groups: Record<string, AggregatedTask[]> = { morning: [], day: [], evening: [], none: [] };
  for (const t of pending) {
    groups[getTimeGroup(t.time)]!.push(t);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 pb-3">
        <h2 className="text-lg font-bold text-neutral-200">Сегодня, {dateFormatted}</h2>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-neutral-500">{doneCount} из {totalCount} выполнено</span>
              <span className="text-[11px] text-neutral-600">{progressPct}%</span>
            </div>
            <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Grouped pending tasks */}
            {(['morning', 'day', 'evening', 'none'] as const).map((group) => {
              const items = groups[group];
              if (!items || items.length === 0) return null;
              return (
                <div key={group} className="mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1.5">
                    {GROUP_LABELS[group]}
                  </div>
                  <div className="space-y-0.5">
                    {items.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onComplete={() => handleComplete(task)}
                        onClick={() => handleTaskClick(task)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Done tasks */}
            {done.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1.5">
                  Выполнено
                </div>
                <div className="space-y-0.5">
                  {done.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onComplete={() => handleComplete(task)}
                      onClick={() => handleTaskClick(task)}
                    />
                  ))}
                </div>
              </div>
            )}

            {tasks.length === 0 && !loading && (
              <div className="text-center py-8 text-sm text-neutral-600">
                На сегодня задач нет
              </div>
            )}
          </>
        )}
      </div>

      {/* Add task */}
      <div className="p-4 pt-2 border-t border-neutral-800/50">
        {addingTask ? (
          <form
            onSubmit={(e) => { e.preventDefault(); handleAddTask(); }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onBlur={() => { if (!newTaskTitle.trim()) setAddingTask(false); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setAddingTask(false); setNewTaskTitle(''); } }}
              placeholder="Название задачи..."
              className="flex-1 bg-transparent text-sm text-neutral-200 placeholder-neutral-600 outline-none"
            />
            <button
              type="submit"
              disabled={!newTaskTitle.trim()}
              className="text-xs text-emerald-400 hover:text-emerald-300 disabled:text-neutral-600 transition-colors"
            >
              Enter
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingTask(true)}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <Plus size={14} />
            <span>Добавить задачу</span>
          </button>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onComplete,
  onClick,
}: {
  task: AggregatedTask;
  onComplete: () => void;
  onClick: () => void;
}) {
  const isDone = task.status === 'done';

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onComplete(); }}
        className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
          isDone
            ? 'bg-emerald-500/20 border-emerald-500/40'
            : 'border-neutral-600 hover:border-neutral-400'
        }`}
      >
        {isDone && <Check size={10} className="text-emerald-400" />}
      </button>

      {/* Content */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={onClick}
      >
        <div className="flex items-center gap-1.5">
          <span className={`text-xs truncate ${isDone ? 'line-through text-neutral-600' : 'text-neutral-300'}`}>
            {task.title}
          </span>
        </div>
      </div>

      {/* Time */}
      {task.time && (
        <span className={`text-[10px] font-mono shrink-0 ${isDone ? 'text-neutral-700' : 'text-neutral-500'}`}>
          {task.time}
        </span>
      )}

      {/* Sphere dot */}
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SPHERE_COLOR[task.sphere] ?? 'bg-neutral-500'}`} />
    </div>
  );
}
