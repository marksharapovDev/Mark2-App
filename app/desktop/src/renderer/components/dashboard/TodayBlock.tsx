import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, Calendar, Clock } from 'lucide-react';
import type { CalendarEvent } from '@mark2/shared';

/* ── Types ────────────────────────────────────────────────── */

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

/* ── Constants ────────────────────────────────────────────── */

const SPHERE_COLOR: Record<string, string> = {
  teaching: 'bg-green-400',
  dev: 'bg-blue-400',
  study: 'bg-purple-400',
  health: 'bg-orange-400',
  finance: 'bg-yellow-400',
  personal: 'bg-neutral-400',
};

const SPHERE_TEXT_COLOR: Record<string, string> = {
  teaching: 'text-green-400',
  dev: 'text-blue-400',
  study: 'text-purple-400',
  health: 'text-orange-400',
  finance: 'text-yellow-400',
  personal: 'text-neutral-400',
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

const WEEKDAY_NAMES = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

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

/* ── Main component ───────────────────────────────────────── */

export function TodayBlock() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dateFormatted = `${today.getDate()} ${MONTH_NAMES[today.getMonth()]}, ${WEEKDAY_NAMES[today.getDay()]}`;

  return (
    <div className="bg-neutral-900/50 border border-neutral-700/30 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <h2 className="text-lg font-bold text-neutral-200">Сегодня, {dateFormatted}</h2>
      </div>

      {/* Two columns inside */}
      <div className="flex min-h-[280px]">
        {/* Left — events & lessons */}
        <div className="flex-[55] border-r border-neutral-800/50 px-5 pb-4 overflow-y-auto max-h-[420px]">
          <EventsColumn todayStr={todayStr} />
        </div>

        {/* Right — tasks & reminders */}
        <div className="flex-[45] px-5 pb-4 flex flex-col overflow-y-auto max-h-[420px]">
          <TasksColumn todayStr={todayStr} />
        </div>
      </div>
    </div>
  );
}

/* ── Left column: events & lessons ────────────────────────── */

function EventsColumn({ todayStr }: { todayStr: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [nextLessons, setNextLessons] = useState<
    { studentName: string; subject: string | null; time: string; day: string }[]
  >([]);

  const reload = useCallback(async () => {
    try {
      const [calEvents, students] = await Promise.all([
        window.db.events.list(todayStr, todayStr),
        window.db.students.list(),
      ]);

      // Calendar events for today, sorted by time
      const sorted = [...calEvents].sort((a, b) => {
        const aTime = a.startAt ? new Date(a.startAt).getTime() : 0;
        const bTime = b.startAt ? new Date(b.startAt).getTime() : 0;
        return aTime - bTime;
      });
      setEvents(sorted);

      // Today's lessons from student schedules
      const dayMap: Record<number, string> = { 0: 'Вс', 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб' };
      const todayDay = dayMap[new Date(todayStr).getDay()] ?? '';

      const lessons: { studentName: string; subject: string | null; time: string; day: string }[] = [];
      for (const student of students) {
        if (!student.schedule) continue;
        const scheduleArr = Array.isArray(student.schedule) ? student.schedule : [];
        for (const slot of scheduleArr) {
          const s = slot as { day?: string; time?: string };
          if (s.day === todayDay) {
            lessons.push({
              studentName: student.name,
              subject: student.subject ?? null,
              time: s.time ?? '00:00',
              day: todayDay,
            });
          }
        }
      }
      lessons.sort((a, b) => a.time.localeCompare(b.time));
      setNextLessons(lessons);
    } catch {
      // keep empty
    }
  }, [todayStr]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.some((e) => ['events', 'students', 'lessons'].includes(e))) {
        reload();
      }
    });
  }, [reload]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
      </div>
    );
  }

  const hasContent = events.length > 0 || nextLessons.length > 0;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <Calendar size={13} className="text-neutral-500" />
        <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
          События и уроки
        </span>
      </div>

      {!hasContent && (
        <div className="text-xs text-neutral-600 py-4 text-center">
          На сегодня событий нет
        </div>
      )}

      {/* Today's lessons from schedules */}
      {nextLessons.length > 0 && (
        <div className="mb-3">
          <div className="space-y-1">
            {nextLessons.map((lesson, i) => (
              <div
                key={`lesson-${i}`}
                className="flex items-center gap-2.5 py-1.5 cursor-pointer hover:bg-neutral-800/30 -mx-2 px-2 rounded"
                onClick={() => navigate('/teaching')}
              >
                <span className="text-[11px] font-mono text-green-400/70 w-10 shrink-0">
                  {lesson.time}
                </span>
                <span className="w-0.5 h-4 bg-green-500/40 rounded-full shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-neutral-300 truncate block">
                    {lesson.studentName}
                  </span>
                  {lesson.subject && (
                    <span className="text-[10px] text-neutral-600">{lesson.subject}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar events */}
      {events.length > 0 && (
        <div className="space-y-1">
          {events.map((event) => {
            const startTime = event.startAt
              ? new Date(event.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
              : null;
            const endTime = event.endAt
              ? new Date(event.endAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
              : null;
            const sphereColor = SPHERE_TEXT_COLOR[event.sphere] ?? 'text-neutral-500';
            const route = SPHERE_ROUTE[event.sphere];

            return (
              <div
                key={event.id}
                className={`flex items-center gap-2.5 py-1.5 ${route ? 'cursor-pointer hover:bg-neutral-800/30' : ''} -mx-2 px-2 rounded`}
                onClick={() => route && navigate(route)}
              >
                {startTime && (
                  <span className={`text-[11px] font-mono ${sphereColor} opacity-70 w-10 shrink-0`}>
                    {startTime}
                  </span>
                )}
                {!startTime && <span className="w-10 shrink-0" />}
                <span className={`w-0.5 h-4 rounded-full shrink-0 ${SPHERE_COLOR[event.sphere] ?? 'bg-neutral-500'} opacity-40`} />
                <div className="flex-1 min-w-0">
                  <span className={`text-xs truncate block ${event.done ? 'line-through text-neutral-600' : 'text-neutral-300'}`}>
                    {event.title}
                  </span>
                  {startTime && endTime && (
                    <span className="text-[10px] text-neutral-600">{startTime}–{endTime}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Right column: tasks & reminders ──────────────────────── */

function TasksColumn({ todayStr }: { todayStr: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<AggregatedTask[]>([]);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.some((e) => ['reminders', 'tasks'].includes(e))) {
        reload();
      }
    });
  }, [reload]);

  useEffect(() => {
    if (addingTask && inputRef.current) {
      inputRef.current.focus();
    }
  }, [addingTask]);

  const handleComplete = (task: AggregatedTask) => {
    if (!task.isReminder) return;

    const newStatus = task.status === 'done' ? 'pending' : 'done';

    // Optimistic update — instant UI feedback
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)),
    );

    // Fire DB call in background — no await, no full reload
    const dbCall = task.status === 'done'
      ? window.db.reminders.uncomplete(task.id)
      : window.db.reminders.complete(task.id);

    dbCall.catch((err) => {
      console.error('[TodayBlock] toggle failed, reverting:', err);
      // Revert on error
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)),
      );
    });
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

  // Split done/pending, group pending
  const pending = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const totalCount = tasks.length;
  const doneCount = done.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const groups: Record<string, AggregatedTask[]> = { morning: [], day: [], evening: [], none: [] };
  for (const t of pending) {
    groups[getTimeGroup(t.time)]!.push(t);
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Clock size={13} className="text-neutral-500" />
        <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
          Задачи
        </span>
        {totalCount > 0 && (
          <span className="ml-auto text-[10px] text-neutral-600">
            {doneCount}/{totalCount}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Task list */}
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {(['morning', 'day', 'evening', 'none'] as const).map((group) => {
              const items = groups[group];
              if (!items || items.length === 0) return null;
              return (
                <div key={group} className="mb-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">
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

            {done.length > 0 && (
              <div className="mb-2.5">
                <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">
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

            {tasks.length === 0 && (
              <div className="text-center py-4 text-xs text-neutral-600">
                Задач на сегодня нет
              </div>
            )}
          </>
        )}
      </div>

      {/* Add task */}
      <div className="pt-2 mt-auto border-t border-neutral-800/30">
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
              className="flex-1 bg-transparent text-xs text-neutral-200 placeholder-neutral-600 outline-none"
            />
            <button
              type="submit"
              disabled={!newTaskTitle.trim()}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 disabled:text-neutral-600 transition-colors"
            >
              Enter
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingTask(true)}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <Plus size={12} />
            <span>Добавить задачу</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Task row ─────────────────────────────────────────────── */

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
    <div className="flex items-center gap-2 py-1 group">
      <button
        onClick={(e) => { e.stopPropagation(); onComplete(); }}
        className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
          isDone
            ? 'bg-emerald-500/20 border-emerald-500/40'
            : 'border-neutral-600 hover:border-neutral-400'
        }`}
      >
        {isDone && <Check size={8} className="text-emerald-400" />}
      </button>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <span className={`text-xs truncate block ${isDone ? 'line-through text-neutral-600' : 'text-neutral-300'}`}>
          {task.title}
        </span>
      </div>

      {task.time && (
        <span className={`text-[10px] font-mono shrink-0 ${isDone ? 'text-neutral-700' : 'text-neutral-500'}`}>
          {task.time}
        </span>
      )}

      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SPHERE_COLOR[task.sphere] ?? 'bg-neutral-500'}`} />
    </div>
  );
}
