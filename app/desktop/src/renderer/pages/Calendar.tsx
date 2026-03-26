import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, Bell, Loader2, Repeat } from 'lucide-react';
import { useCalendar } from '../context/calendar-context';

// --- Reminder type (from DB) ---

interface ReminderSubtask {
  id: string;
  title: string;
  done: boolean;
}

interface CalendarReminder {
  id: string;
  title: string;
  date: string;
  time: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'done' | 'skipped' | 'deferred';
  sphere: Sphere;
  sourceType: string | null;
  description: string | null;
  isRecurring: boolean;
  subtasks: ReminderSubtask[];
}

// --- Types ---

type Sphere = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'personal';
type ViewMode = 'month' | 'week' | 'day' | 'list';
type EventType = 'event' | 'task' | 'reminder';

interface Subtask {
  title: string;
  done: boolean;
}

type RecurrencePattern = 'daily' | 'weekly' | 'biweekly' | 'custom';

interface DayTime {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

interface RecurrenceRule {
  pattern: RecurrencePattern;
  days?: number[]; // 0=Mon, 6=Sun
  dayTimes?: Record<number, DayTime>; // per-day time overrides
  endDate?: string;
  exceptions?: string[]; // dates to skip
}

interface CalendarEvent {
  id: string;
  title: string;
  sphere: Sphere;
  date: string; // YYYY-MM-DD
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  allDay?: boolean;
  description?: string;
  type: EventType;
  done: boolean;
  subtasks: Subtask[];
  // Recurrence
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
  recurringParentId?: string;
  isException?: boolean;
  // Virtual instance (not in DB)
  isVirtual?: boolean;
  virtualDate?: string; // the date this instance represents
}

interface CreateModalData {
  date: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  editEvent?: CalendarEvent;
  defaultType?: EventType;
}

interface ContextMenuState {
  x: number;
  y: number;
  date: string;
  hour: number;
  min: number;
}

interface EventDragState {
  event: CalendarEvent;
  mode: 'move' | 'resize';
  offsetMin: number;
  currentDayIdx: number;
  currentStartMin: number;
  currentEndMin: number;
}

// --- Constants ---

const SPHERE_META: Record<Sphere, { label: string; color: string; bg: string; border: string; dot: string }> = {
  dev:      { label: 'Dev',       color: 'text-blue-300',    bg: 'bg-blue-500/15',    border: 'border-l-blue-500',    dot: 'bg-blue-500' },
  teaching: { label: 'Teaching',  color: 'text-green-300',   bg: 'bg-green-500/15',   border: 'border-l-green-500',   dot: 'bg-green-500' },
  study:    { label: 'Study',     color: 'text-purple-300',  bg: 'bg-purple-500/15',  border: 'border-l-purple-500',  dot: 'bg-purple-500' },
  health:   { label: 'Health',    color: 'text-orange-300',  bg: 'bg-orange-500/15',  border: 'border-l-orange-500',  dot: 'bg-orange-500' },
  finance:  { label: 'Finance',   color: 'text-red-300',     bg: 'bg-red-500/15',     border: 'border-l-red-500',     dot: 'bg-red-500' },
  personal: { label: 'Личное',    color: 'text-neutral-300', bg: 'bg-neutral-500/15', border: 'border-l-neutral-500', dot: 'bg-neutral-500' },
};

const SPHERES = Object.keys(SPHERE_META) as Sphere[];
const DAY_NAMES_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const VIEW_TABS: Array<{ id: ViewMode; label: string }> = [
  { id: 'month', label: 'Месяц' },
  { id: 'week', label: 'Неделя' },
  { id: 'day', label: 'День' },
  { id: 'list', label: 'Список' },
];

const TODAY = new Date().toLocaleDateString('sv-SE');
const ZOOM_LS_KEY = 'mark2-calendar-zoom';
const MIN_HOUR_HEIGHT = 25;
const MAX_HOUR_HEIGHT = 150;
const DEFAULT_HOUR_HEIGHT = 50;

// --- Utilities ---

function pad2(n: number): string { return String(n).padStart(2, '0'); }
function fmtTime(h: number, m: number): string { return `${pad2(h)}:${pad2(m)}`; }

function fmtDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day ?? '0', 10)} ${months[parseInt(month ?? '0', 10)]}`;
}

function getMonday(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getWeekDates(dateStr: string): string[] {
  const mon = getMonday(dateStr);
  return Array.from({ length: 7 }, (_, i) => dateToStr(addDays(mon, i)));
}

function getMonthGrid(year: number, month: number): string[][] {
  const first = new Date(year, month, 1);
  const firstDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: string[][] = [];
  let current = 1 - firstDay;
  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      if (current >= 1 && current <= daysInMonth) {
        week.push(`${year}-${pad2(month + 1)}-${pad2(current)}`);
      } else {
        week.push('');
      }
      current++;
    }
    if (week.every((d) => d === '')) break;
    weeks.push(week);
  }
  return weeks;
}

function isRecurringEvent(e: CalendarEvent): boolean {
  return !!(e.isRecurring || e.isVirtual || e.isException);
}

function eventDuration(e: CalendarEvent): number {
  return (e.endHour * 60 + e.endMin) - (e.startHour * 60 + e.startMin);
}

function yToMinutes(y: number, hh: number): number {
  const raw = (y / hh) * 60;
  return Math.max(0, Math.min(23 * 60 + 45, Math.round(raw / 15) * 15));
}

// --- DB ↔ Local mapping ---

function mapDbEventToLocal(e: Record<string, unknown>): CalendarEvent {
  const startAt = new Date(e.startAt as string);
  const endAt = e.endAt ? new Date(e.endAt as string) : new Date(startAt.getTime() + 60 * 60 * 1000);
  const meta = (e.metadata ?? {}) as Record<string, unknown>;
  return {
    id: String(e.id),
    title: String(e.title),
    sphere: (e.sphere as Sphere) ?? 'personal',
    date: `${startAt.getFullYear()}-${pad2(startAt.getMonth() + 1)}-${pad2(startAt.getDate())}`,
    startHour: startAt.getHours(),
    startMin: startAt.getMinutes(),
    endHour: endAt.getHours(),
    endMin: endAt.getMinutes(),
    type: (meta.type as EventType) ?? 'event',
    done: (meta.done as boolean) ?? false,
    subtasks: Array.isArray(meta.subtasks) ? (meta.subtasks as Subtask[]) : [],
    description: meta.description ? String(meta.description) : undefined,
    isRecurring: (e.isRecurring as boolean) ?? false,
    recurrenceRule: e.recurrenceRule ? (e.recurrenceRule as RecurrenceRule) : undefined,
    recurringParentId: e.recurringParentId ? String(e.recurringParentId) : undefined,
    isException: (e.isException as boolean) ?? false,
  };
}

function localEventToDb(e: CalendarEvent): Record<string, unknown> {
  const startAt = new Date(`${e.date}T${pad2(e.startHour)}:${pad2(e.startMin)}:00`);
  const endAt = new Date(`${e.date}T${pad2(e.endHour)}:${pad2(e.endMin)}:00`);
  const result: Record<string, unknown> = {
    sphere: e.sphere,
    title: e.title,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    metadata: {
      type: e.type,
      done: e.done,
      subtasks: e.subtasks,
      description: e.description,
    },
  };
  if (e.isRecurring) {
    result.isRecurring = true;
    result.recurrenceRule = e.recurrenceRule;
  }
  if (e.recurringParentId) {
    result.recurringParentId = e.recurringParentId;
  }
  if (e.isException) {
    result.isException = true;
  }
  return result;
}

// --- Recurrence expansion ---

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 ? 6 : day - 1; // 0=Mon, 6=Sun
}

function expandRecurringEvents(
  dbEvents: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string,
): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  const exceptionDates = new Map<string, Set<string>>(); // parentId -> set of exception dates

  // Collect exception dates from parent's recurrence rules
  for (const e of dbEvents) {
    if (e.isRecurring && e.recurrenceRule?.exceptions) {
      exceptionDates.set(e.id, new Set(e.recurrenceRule.exceptions));
    }
  }

  // Collect dates covered by exception events (is_exception=true)
  const exceptionEventDates = new Map<string, Set<string>>(); // parentId -> dates
  for (const e of dbEvents) {
    if (e.isException && e.recurringParentId) {
      if (!exceptionEventDates.has(e.recurringParentId)) {
        exceptionEventDates.set(e.recurringParentId, new Set());
      }
      exceptionEventDates.get(e.recurringParentId)!.add(e.date);
    }
  }

  for (const e of dbEvents) {
    if (!e.isRecurring || !e.recurrenceRule) {
      // Non-recurring event or exception — add directly
      result.push(e);
      continue;
    }

    const rule = e.recurrenceRule;
    const exceptions = exceptionDates.get(e.id) ?? new Set<string>();
    const exceptionEvts = exceptionEventDates.get(e.id) ?? new Set<string>();
    const ruleEnd = rule.endDate ?? rangeEnd;
    const originDate = new Date(e.date);

    // Generate dates based on pattern
    const cursor = new Date(Math.max(originDate.getTime(), new Date(rangeStart).getTime()));
    const end = new Date(Math.min(new Date(ruleEnd).getTime(), new Date(rangeEnd).getTime()));

    while (cursor <= end) {
      const curStr = dateToStr(cursor);
      const curDow = getDayOfWeek(curStr);
      let matches = false;

      if (rule.pattern === 'daily') {
        matches = cursor >= originDate;
      } else if (rule.pattern === 'weekly') {
        const targetDays = rule.days ?? [getDayOfWeek(e.date)];
        matches = targetDays.includes(curDow) && cursor >= originDate;
      } else if (rule.pattern === 'biweekly') {
        const targetDays = rule.days ?? [getDayOfWeek(e.date)];
        const weeksDiff = Math.floor((cursor.getTime() - originDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        matches = targetDays.includes(curDow) && weeksDiff % 2 === 0 && cursor >= originDate;
      } else if (rule.pattern === 'custom') {
        const targetDays = rule.days ?? [];
        matches = targetDays.includes(curDow) && cursor >= originDate;
      }

      if (matches && !exceptions.has(curStr) && !exceptionEvts.has(curStr)) {
        // Apply per-day time overrides if available
        const dayTime = rule.dayTimes?.[curDow];
        const instance: CalendarEvent = {
          ...e,
          id: curStr === e.date ? e.id : `${e.id}__${curStr}`,
          date: curStr,
          startHour: dayTime?.startHour ?? e.startHour,
          startMin: dayTime?.startMin ?? e.startMin,
          endHour: dayTime?.endHour ?? e.endHour,
          endMin: dayTime?.endMin ?? e.endMin,
          isVirtual: curStr !== e.date,
          virtualDate: curStr,
          done: curStr === e.date ? e.done : false,
          subtasks: curStr === e.date ? e.subtasks : e.subtasks.map((s) => ({ ...s, done: false })),
        };
        result.push(instance);
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return result;
}

// --- Overlapping event positioning ---

interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  left: number;
  width: number;
}

function positionEvents(events: CalendarEvent[], hourHeight: number): PositionedEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => {
    const aStart = a.startHour * 60 + a.startMin;
    const bStart = b.startHour * 60 + b.startMin;
    return aStart - bStart || eventDuration(b) - eventDuration(a);
  });

  const groups: CalendarEvent[][] = [];
  let currentGroup: CalendarEvent[] = [];
  let groupEnd = 0;

  for (const ev of sorted) {
    const evStart = ev.startHour * 60 + ev.startMin;
    const evEnd = ev.endHour * 60 + ev.endMin;
    if (currentGroup.length === 0 || evStart < groupEnd) {
      currentGroup.push(ev);
      groupEnd = Math.max(groupEnd, evEnd);
    } else {
      groups.push(currentGroup);
      currentGroup = [ev];
      groupEnd = evEnd;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  const result: PositionedEvent[] = [];
  const pad = 2;

  for (const group of groups) {
    const cols = group.length;
    group.forEach((ev, colIdx) => {
      const top = (ev.startHour * 60 + ev.startMin) / 60 * hourHeight;
      const height = eventDuration(ev) / 60 * hourHeight;
      const colWidth = (100 - pad) / cols;
      result.push({
        event: ev,
        top,
        height,
        left: pad / 2 + colIdx * colWidth,
        width: colWidth - 1,
      });
    });
  }

  return result;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function Calendar() {
  const { selectedDate, setSelectedDate } = useCalendar();
  const [view, setView] = useState<ViewMode>('week');
  const [viewYear, setViewYear] = useState(() => new Date(selectedDate).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate).getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<CalendarReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editReminder, setEditReminder] = useState<{ reminder: CalendarReminder; rect: DOMRect } | null>(null);
  const [createModal, setCreateModal] = useState<CreateModalData | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [recurringChoice, setRecurringChoice] = useState<{
    event: CalendarEvent;
    updates: { date: string; startHour: number; startMin: number; endHour: number; endMin: number };
  } | null>(null);
  const [recurringDeleteChoice, setRecurringDeleteChoice] = useState<CalendarEvent | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [hourHeight, setHourHeight] = useState(() => {
    const stored = localStorage.getItem(ZOOM_LS_KEY);
    if (stored) {
      const val = Number(stored);
      if (val >= MIN_HOUR_HEIGHT && val <= MAX_HOUR_HEIGHT) return val;
    }
    return DEFAULT_HOUR_HEIGHT;
  });
  const bodyRef = useRef<HTMLDivElement>(null);
  const hourHeightRef = useRef(hourHeight);
  hourHeightRef.current = hourHeight;

  // --- Undo / Redo ---
  const UNDO_LIMIT = 20;
  const undoStackRef = useRef<CalendarEvent[][]>([]);
  const redoStackRef = useRef<CalendarEvent[][]>([]);

  const commitEvents = useCallback((updater: (prev: CalendarEvent[]) => CalendarEvent[]) => {
    setEvents((prev) => {
      undoStackRef.current = [...undoStackRef.current.slice(-(UNDO_LIMIT - 1)), prev];
      redoStackRef.current = [];
      return updater(prev);
    });
  }, []);

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1]!;
    undoStackRef.current = stack.slice(0, -1);
    setEvents((current) => {
      redoStackRef.current = [...redoStackRef.current, current];
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return;
    const next = stack[stack.length - 1]!;
    redoStackRef.current = stack.slice(0, -1);
    setEvents((current) => {
      undoStackRef.current = [...undoStackRef.current, current];
      return next;
    });
  }, []);

  // Cmd+Z / Cmd+Shift+Z global listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // Persist zoom
  useEffect(() => {
    localStorage.setItem(ZOOM_LS_KEY, String(hourHeight));
  }, [hourHeight]);

  // Load events + reminders from DB
  const reloadEvents = useCallback(async () => {
    try {
      const year = new Date().getFullYear();
      const rangeFrom = `${year}-01-01`;
      const rangeTo = `${year}-12-31`;
      const [dbEvents, dbReminders] = await Promise.all([
        window.db.events.list(rangeFrom, rangeTo),
        window.db.reminders.list({ dateFrom: rangeFrom, dateTo: rangeTo }),
      ]);
      if (dbEvents.length > 0) {
        setEvents(dbEvents.map((e) => mapDbEventToLocal(e as unknown as Record<string, unknown>)));
      }
      const mappedReminders = (dbReminders ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        title: String(r.title),
        date: String(r.date).slice(0, 10),
        time: r.time ? String(r.time) : null,
        priority: (r.priority as CalendarReminder['priority']) ?? 'medium',
        status: (r.status as CalendarReminder['status']) ?? 'pending',
        sphere: (r.sphere as Sphere) ?? 'personal',
        sourceType: r.sourceType ? String(r.sourceType) : null,
        description: r.description ? String(r.description) : null,
        isRecurring: (r.isRecurring as boolean) ?? false,
        subtasks: Array.isArray(r.subtasks) ? (r.subtasks as ReminderSubtask[]) : [],
      }));
      console.log(`[Calendar] Reminders loaded: ${mappedReminders.length} items, dates: [${mappedReminders.map((r) => r.date).join(', ')}]`);
      setReminders(mappedReminders);
    } catch (err) {
      setDbError(err instanceof Error ? err.message : 'Ошибка подключения к БД');
    }
  }, []);

  // Initial load
  useEffect(() => {
    reloadEvents().finally(() => setLoading(false));
  }, [reloadEvents]);

  // Reload on data-changed from AI
  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('events') || entities.includes('tasks') || entities.includes('reminders')) {
        reloadEvents();
      }
    });
  }, [reloadEvents]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const monthGrid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  // Expand recurring events into virtual instances for the visible range
  const expandedEvents = useMemo(() => {
    const year = new Date().getFullYear();
    return expandRecurringEvents(events, `${year}-01-01`, `${year}-12-31`);
  }, [events]);

  const getEventsForDate = useCallback((date: string) => {
    return expandedEvents.filter((e) => e.date === date);
  }, [expandedEvents]);

  const getRemindersForDate = useCallback((date: string) => {
    const found = reminders.filter((r) => r.date === date);
    if (found.length > 0) {
      console.log(`[Calendar] remindersForDate(${date}): ${found.length} items`);
    }
    return found;
  }, [reminders]);

  const handleToggleReminder = useCallback(async (id: string) => {
    const current = reminders.find((r) => r.id === id);
    const newStatus = current?.status === 'done' ? 'pending' as const : 'done' as const;
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, status: newStatus } : r));
    try {
      if (newStatus === 'done') {
        await window.db.reminders.complete(id);
      } else {
        await window.db.reminders.uncomplete(id);
      }
    } catch { /* ignore */ }
  }, [reminders]);

  const handleSaveReminder = useCallback(async (id: string, data: Record<string, unknown>) => {
    const updated = { ...data };
    setReminders((prev) => prev.map((r) => r.id === id ? {
      ...r,
      title: String(updated.title ?? r.title),
      description: updated.description != null ? String(updated.description) : r.description,
      date: String(updated.date ?? r.date),
      time: updated.time != null ? String(updated.time) || null : r.time,
      priority: (updated.priority as CalendarReminder['priority']) ?? r.priority,
      sphere: (updated.sphere as Sphere) ?? r.sphere,
      subtasks: Array.isArray(updated.subtasks) ? (updated.subtasks as ReminderSubtask[]) : r.subtasks,
    } : r));
    setEditReminder(null);
    try {
      await window.db.reminders.update(id, updated);
    } catch { /* ignore */ }
  }, []);

  const handleOpenEditReminder = useCallback((reminder: CalendarReminder, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setEditReminder({ reminder, rect });
  }, []);

  const navigateMonth = useCallback((dir: -1 | 1) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
    setSelectedDate(`${y}-${pad2(m + 1)}-15`);
  }, [viewMonth, viewYear, setSelectedDate]);

  const navigateWeek = useCallback((dir: -1 | 1) => {
    const current = new Date(selectedDate);
    const next = addDays(current, dir * 7);
    const nextStr = dateToStr(next);
    setSelectedDate(nextStr);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }, [selectedDate, setSelectedDate]);

  const navigateDay = useCallback((dir: -1 | 1) => {
    const current = new Date(selectedDate);
    const next = addDays(current, dir);
    const nextStr = dateToStr(next);
    setSelectedDate(nextStr);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }, [selectedDate, setSelectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(TODAY);
    const d = new Date(TODAY);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [setSelectedDate]);

  // Swipe navigation + Ctrl+scroll zoom via native wheel event
  const swipeAccumRef = useRef(0);
  const swipeCooldownRef = useRef(false);
  const swipeResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewRef = useRef(view);
  const navigateWeekRef = useRef(navigateWeek);
  const navigateMonthRef = useRef(navigateMonth);
  const navigateDayRef = useRef(navigateDay);
  viewRef.current = view;
  navigateWeekRef.current = navigateWeek;
  navigateMonthRef.current = navigateMonth;
  navigateDayRef.current = navigateDay;

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      // Ctrl/Cmd + scroll = zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const cur = hourHeightRef.current;
        const step = Math.max(2, Math.round(cur * 0.06));
        const delta = e.deltaY > 0 ? -step : step;
        const newH = Math.max(MIN_HOUR_HEIGHT, Math.min(MAX_HOUR_HEIGHT, cur + delta));
        if (newH !== cur) {
          hourHeightRef.current = newH;
          setHourHeight(newH);
        }
        return;
      }

      // Horizontal swipe = navigate
      if (swipeCooldownRef.current) return;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.5) return;
      if (Math.abs(e.deltaX) < 3) return;

      e.preventDefault();
      swipeAccumRef.current += e.deltaX;

      if (swipeResetRef.current) clearTimeout(swipeResetRef.current);
      swipeResetRef.current = setTimeout(() => { swipeAccumRef.current = 0; }, 200);

      const threshold = 80;
      if (Math.abs(swipeAccumRef.current) > threshold) {
        const dir = swipeAccumRef.current > 0 ? 1 : -1;
        const v = viewRef.current;
        if (v === 'week') navigateWeekRef.current(dir as -1 | 1);
        else if (v === 'day') navigateDayRef.current(dir as -1 | 1);
        else if (v === 'month') navigateMonthRef.current(dir as -1 | 1);

        swipeAccumRef.current = 0;
        swipeCooldownRef.current = true;
        setTimeout(() => { swipeCooldownRef.current = false; }, 400);
      }
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Close context menu on click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  const addEvent = useCallback((event: CalendarEvent) => {
    commitEvents((prev) => [...prev, event]);
    setCreateModal(null);
    window.db.events.create(localEventToDb(event)).catch(() => {});
  }, [commitEvents]);

  const updateEvent = useCallback((updated: CalendarEvent) => {
    commitEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e));
    setCreateModal(null);
    window.db.events.update(updated.id, localEventToDb(updated)).catch(() => {});
  }, [commitEvents]);

  const deleteEvent = useCallback((id: string) => {
    const target = expandedEvents.find((e) => e.id === id);
    if (target && (target.isVirtual || target.isRecurring)) {
      setRecurringDeleteChoice(target);
      return;
    }
    commitEvents((prev) => prev.filter((e) => e.id !== id));
    setSelectedEvent(null);
    window.db.events.delete(id).catch(() => {});
  }, [commitEvents, expandedEvents]);

  // Delete ALL instances of a recurring event
  const deleteRecurringAll = useCallback((event: CalendarEvent) => {
    const parentId = event.isVirtual ? event.id.split('__')[0]! : event.id;
    commitEvents((prev) => prev.filter((e) => e.id !== parentId && e.recurringParentId !== parentId));
    window.db.events.delete(parentId).catch(() => {});
    setRecurringDeleteChoice(null);
    setSelectedEvent(null);
  }, [commitEvents]);

  const moveEvent = useCallback((id: string, updates: { date: string; startHour: number; startMin: number; endHour: number; endMin: number }) => {
    // Find the event being moved
    const target = expandedEvents.find((e) => e.id === id);
    if (target && (target.isVirtual || target.isRecurring)) {
      // Recurring event — ask user what to do
      setRecurringChoice({ event: target, updates });
      return;
    }

    commitEvents((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const moved = { ...e, ...updates };
      const startAt = new Date(`${moved.date}T${pad2(moved.startHour)}:${pad2(moved.startMin)}:00`);
      const endAt = new Date(`${moved.date}T${pad2(moved.endHour)}:${pad2(moved.endMin)}:00`);
      window.db.events.update(id, { startAt: startAt.toISOString(), endAt: endAt.toISOString() }).catch(() => {});
      return moved;
    }));
  }, [commitEvents, expandedEvents]);

  // Handle recurring move: "only this"
  const moveRecurringSingle = useCallback((parentEvent: CalendarEvent, originalDate: string, updates: { date: string; startHour: number; startMin: number; endHour: number; endMin: number }) => {
    const parentId = parentEvent.isVirtual ? parentEvent.id.split('__')[0]! : parentEvent.id;

    // Add exception to parent's rule
    commitEvents((prev) => prev.map((e) => {
      if (e.id !== parentId) return e;
      const rule = { ...e.recurrenceRule! };
      rule.exceptions = [...(rule.exceptions ?? []), originalDate];
      const updated = { ...e, recurrenceRule: rule };
      window.db.events.update(parentId, { recurrenceRule: rule }).catch(() => {});
      return updated;
    }));

    // Create exception event
    const exception: CalendarEvent = {
      ...parentEvent,
      id: `ev-${Date.now()}`,
      ...updates,
      isRecurring: false,
      recurrenceRule: undefined,
      recurringParentId: parentId,
      isException: true,
      isVirtual: false,
    };
    commitEvents((prev) => [...prev, exception]);
    window.db.events.create(localEventToDb(exception)).catch(() => {});
    setRecurringChoice(null);
  }, [commitEvents]);

  // Handle recurring delete: "only this"
  const deleteRecurringSingle = useCallback((event: CalendarEvent) => {
    const parentId = event.isVirtual ? event.id.split('__')[0]! : event.id;
    const dateToExclude = event.virtualDate ?? event.date;

    commitEvents((prev) => prev.map((e) => {
      if (e.id !== parentId) return e;
      const rule = { ...e.recurrenceRule! };
      rule.exceptions = [...(rule.exceptions ?? []), dateToExclude];
      window.db.events.update(parentId, { recurrenceRule: rule }).catch(() => {});
      return { ...e, recurrenceRule: rule };
    }));
    setRecurringDeleteChoice(null);
    setSelectedEvent(null);
  }, [commitEvents]);

  const toggleEventDone = useCallback((id: string) => {
    commitEvents((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const updated = { ...e, done: !e.done };
      const existing = events.find((ev) => ev.id === id);
      const meta = existing ? { type: existing.type, done: updated.done, subtasks: existing.subtasks, description: existing.description } : { done: updated.done };
      window.db.events.update(id, { metadata: meta }).catch(() => {});
      return updated;
    }));
  }, [commitEvents, events]);

  const toggleSubtask = useCallback((eventId: string, subtaskIdx: number) => {
    commitEvents((prev) => prev.map((e) => {
      if (e.id !== eventId) return e;
      const subtasks = e.subtasks.map((s, i) => i === subtaskIdx ? { ...s, done: !s.done } : s);
      const updated = { ...e, subtasks };
      window.db.events.update(eventId, { metadata: { type: updated.type, done: updated.done, subtasks, description: updated.description } }).catch(() => {});
      return updated;
    }));
  }, [commitEvents]);

  const openCreateFromHeader = useCallback(() => {
    setCreateModal({
      date: selectedDate,
      startHour: 12,
      startMin: 0,
      endHour: 13,
      endMin: 0,
    });
  }, [selectedDate]);

  const handleSelectDate = useCallback((d: string) => {
    setSelectedDate(d);
    const date = new Date(d);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
  }, [setSelectedDate]);

  const handleZoom = useCallback((delta: number) => {
    setHourHeight((h) => Math.max(MIN_HOUR_HEIGHT, Math.min(MAX_HOUR_HEIGHT, h + delta)));
  }, []);

  const todayDate = new Date(TODAY);
  const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {/* === HEADER === */}
      <div className="shrink-0 border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold text-neutral-200">Календарь</h1>
            <p className="text-xs text-neutral-500">{dayNames[todayDate.getDay()]}, {fmtDateShort(TODAY)}</p>
          </div>
          <button
            onClick={openCreateFromHeader}
            className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-lg text-sm text-blue-300 hover:bg-blue-600/30 transition-colors"
          >
            + Событие
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (view === 'month') navigateMonth(-1);
                else if (view === 'day') navigateDay(-1);
                else navigateWeek(-1);
              }}
              className="text-neutral-500 hover:text-neutral-200 transition-colors text-sm px-1"
            >
              &larr;
            </button>
            <span className="text-sm font-semibold text-neutral-200 w-36 text-center">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              onClick={() => {
                if (view === 'month') navigateMonth(1);
                else if (view === 'day') navigateDay(1);
                else navigateWeek(1);
              }}
              className="text-neutral-500 hover:text-neutral-200 transition-colors text-sm px-1"
            >
              &rarr;
            </button>
            <button
              onClick={goToToday}
              className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors ml-2 px-2 py-0.5 rounded border border-neutral-800 hover:border-neutral-700"
            >
              Сегодня
            </button>
          </div>

          <div className="flex gap-0.5 bg-neutral-900 rounded-lg p-0.5">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  view === tab.id
                    ? 'bg-neutral-700 text-white'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* === BODY === */}
      {loading && (
        <div className="flex items-center justify-center py-2 border-b border-neutral-800">
          <Loader2 size={14} className="animate-spin text-neutral-500 mr-2" />
          <span className="text-xs text-neutral-500">Загрузка событий…</span>
        </div>
      )}
      {dbError && (
        <div className="shrink-0 mx-6 mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {dbError}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden" ref={bodyRef}>
        <div className="flex-1 overflow-hidden">
          {view === 'week' && (
            <WeekView
              weekDates={weekDates}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              eventsForDate={getEventsForDate}
              remindersForDate={getRemindersForDate}
              onCompleteReminder={handleToggleReminder}
              onEditReminder={handleOpenEditReminder}
              now={now}
              hourHeight={hourHeight}
              onEventClick={setSelectedEvent}
              onCreateEvent={setCreateModal}
              onContextMenu={setContextMenu}
              onMoveEvent={moveEvent}
              onZoom={handleZoom}
              onToggleDone={toggleEventDone}
            />
          )}
          {view === 'month' && (
            <MonthView
              grid={monthGrid}
              selectedDate={selectedDate}
              onSelectDate={(d) => { handleSelectDate(d); setView('day'); }}
              eventsForDate={getEventsForDate}
              remindersForDate={getRemindersForDate}
              onCompleteReminder={handleToggleReminder}
              onEditReminder={handleOpenEditReminder}
            />
          )}
          {view === 'day' && (
            <DayView
              date={selectedDate}
              eventsForDate={getEventsForDate}
              remindersForDate={getRemindersForDate}
              onCompleteReminder={handleToggleReminder}
              onEditReminder={handleOpenEditReminder}
              now={now}
              hourHeight={hourHeight}
              onEventClick={setSelectedEvent}
              onCreateEvent={setCreateModal}
              onContextMenu={setContextMenu}
              onMoveEvent={moveEvent}
              onZoom={handleZoom}
              onToggleDone={toggleEventDone}
            />
          )}
          {view === 'list' && (
            <ListView
              selectedDate={selectedDate}
              eventsForDate={getEventsForDate}
              remindersForDate={getRemindersForDate}
              onCompleteReminder={handleToggleReminder}
              onEditReminder={handleOpenEditReminder}
              onEventClick={setSelectedEvent}
            />
          )}
        </div>

        <CalendarSidebar
          selectedDate={selectedDate}
          onSelectDate={(d) => { handleSelectDate(d); if (view === 'month') setView('day'); }}
          viewYear={viewYear}
          viewMonth={viewMonth}
          eventsForDate={getEventsForDate}
          remindersForDate={getRemindersForDate}
          onCompleteReminder={handleToggleReminder}
          onEditReminder={handleOpenEditReminder}
        />
      </div>

      {/* === MODALS === */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={deleteEvent}
          onEdit={(ev) => {
            setSelectedEvent(null);
            setCreateModal({
              date: ev.date,
              startHour: ev.startHour,
              startMin: ev.startMin,
              endHour: ev.endHour,
              endMin: ev.endMin,
              editEvent: ev,
            });
          }}
          onToggleDone={() => {
            toggleEventDone(selectedEvent.id);
            setSelectedEvent((prev) => prev ? { ...prev, done: !prev.done } : null);
          }}
          onToggleSubtask={(idx) => {
            toggleSubtask(selectedEvent.id, idx);
            setSelectedEvent((prev) => {
              if (!prev) return null;
              const subtasks = prev.subtasks.map((s, i) => i === idx ? { ...s, done: !s.done } : s);
              return { ...prev, subtasks };
            });
          }}
          onAddSubtask={(title) => {
            const newSubtasks = [...selectedEvent.subtasks, { title, done: false }];
            commitEvents((prev) => prev.map((e) => e.id === selectedEvent.id ? { ...e, subtasks: newSubtasks } : e));
            setSelectedEvent((prev) => prev ? { ...prev, subtasks: newSubtasks } : null);
            window.db.events.update(selectedEvent.id, { metadata: { type: selectedEvent.type, done: selectedEvent.done, subtasks: newSubtasks, description: selectedEvent.description } }).catch(() => {});
          }}
          onDeleteSubtask={(idx) => {
            const newSubtasks = selectedEvent.subtasks.filter((_, i) => i !== idx);
            commitEvents((prev) => prev.map((e) => e.id === selectedEvent.id ? { ...e, subtasks: newSubtasks } : e));
            setSelectedEvent((prev) => prev ? { ...prev, subtasks: newSubtasks } : null);
            window.db.events.update(selectedEvent.id, { metadata: { type: selectedEvent.type, done: selectedEvent.done, subtasks: newSubtasks, description: selectedEvent.description } }).catch(() => {});
          }}
        />
      )}

      {createModal && (
        <CreateEventModal
          data={createModal}
          onClose={() => setCreateModal(null)}
          onSave={addEvent}
          onUpdate={updateEvent}
        />
      )}

      {contextMenu && (
        <ContextMenuComponent
          x={contextMenu.x}
          y={contextMenu.y}
          onNewEvent={() => {
            setCreateModal({
              date: contextMenu.date,
              startHour: contextMenu.hour,
              startMin: contextMenu.min,
              endHour: contextMenu.hour + 1,
              endMin: contextMenu.min,
            });
            setContextMenu(null);
          }}

          onNewTask={() => {
            setCreateModal({
              date: contextMenu.date,
              startHour: contextMenu.hour,
              startMin: contextMenu.min,
              endHour: contextMenu.hour + 1,
              endMin: contextMenu.min,
              defaultType: 'task',
            });
            setContextMenu(null);
          }}
          onNewReminder={() => {
            setCreateModal({
              date: contextMenu.date,
              startHour: contextMenu.hour,
              startMin: contextMenu.min,
              endHour: contextMenu.hour,
              endMin: contextMenu.min + 30,
              defaultType: 'reminder',
            });
            setContextMenu(null);
          }}
        />
      )}

      {/* Reminder edit popup */}
      {editReminder && (
        <ReminderEditPopup
          reminder={editReminder.reminder}
          rect={editReminder.rect}
          onSave={(data) => handleSaveReminder(editReminder.reminder.id, data)}
          onClose={() => setEditReminder(null)}
        />
      )}

      {/* Recurring move choice */}
      {recurringChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setRecurringChoice(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-neutral-900 border border-neutral-700 rounded-xl p-5 w-[340px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-100 mb-2">Повторяющееся событие</h3>
            <p className="text-sm text-neutral-400 mb-4">Как изменить &laquo;{recurringChoice.event.title}&raquo;?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  const ev = recurringChoice.event;
                  const origDate = ev.virtualDate ?? ev.date;
                  moveRecurringSingle(ev, origDate, recurringChoice.updates);
                }}
                className="px-3 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg text-sm text-blue-300 hover:bg-blue-600/30 transition-colors"
              >
                Только это событие
              </button>
              <button
                onClick={() => setRecurringChoice(null)}
                className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring delete choice */}
      {recurringDeleteChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setRecurringDeleteChoice(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-neutral-900 border border-neutral-700 rounded-xl p-5 w-[340px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-100 mb-2">Удалить повторяющееся событие</h3>
            <p className="text-sm text-neutral-400 mb-4">&laquo;{recurringDeleteChoice.title}&raquo;</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => deleteRecurringSingle(recurringDeleteChoice)}
                className="px-3 py-2 bg-yellow-600/20 border border-yellow-500/30 rounded-lg text-sm text-yellow-300 hover:bg-yellow-600/30 transition-colors"
              >
                Отменить только этот
              </button>
              <button
                onClick={() => deleteRecurringAll(recurringDeleteChoice)}
                className="px-3 py-2 bg-red-600/20 border border-red-500/30 rounded-lg text-sm text-red-300 hover:bg-red-600/30 transition-colors"
              >
                Удалить все
              </button>
              <button
                onClick={() => setRecurringDeleteChoice(null)}
                className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// WEEK VIEW
// ============================================================

function WeekView({
  weekDates,
  selectedDate,
  onSelectDate,
  eventsForDate,
  remindersForDate,
  onCompleteReminder,
  onEditReminder,
  now,
  hourHeight,
  onEventClick,
  onCreateEvent,
  onContextMenu,
  onMoveEvent,
  onZoom,
  onToggleDone,
}: {
  weekDates: string[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
  eventsForDate: (date: string) => CalendarEvent[];
  remindersForDate: (date: string) => CalendarReminder[];
  onCompleteReminder: (id: string) => void;
  onEditReminder: (reminder: CalendarReminder, e: React.MouseEvent) => void;
  now: Date;
  hourHeight: number;
  onEventClick: (ev: CalendarEvent) => void;
  onCreateEvent: (data: CreateModalData) => void;
  onContextMenu: (data: ContextMenuState) => void;
  onMoveEvent: (id: string, updates: { date: string; startHour: number; startMin: number; endHour: number; endMin: number }) => void;
  onZoom: (delta: number) => void;
  onToggleDone: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Create-drag state
  const [dragPreview, setDragPreview] = useState<{ dayIdx: number; startMin: number; endMin: number } | null>(null);
  const dragStartRef = useRef<{ dayIdx: number; startMin: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Event drag state (move/resize)
  const [eventDrag, setEventDrag] = useState<EventDragState | null>(null);
  const eventDragRef = useRef<EventDragState | null>(null);

  // Cursor style during event drag
  const isEventDragging = eventDrag !== null;
  useEffect(() => {
    if (!isEventDragging) return;
    document.body.style.cursor = eventDrag?.mode === 'resize' ? 'ns-resize' : 'grabbing';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isEventDragging, eventDrag?.mode]);

  // Scroll to 7am on mount
  useEffect(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 7 * hourHeight + 50;
      }
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allDayEvents = weekDates.map((d) => eventsForDate(d).filter((e) => e.allDay));
  const timedEvents = weekDates.map((d) => eventsForDate(d).filter((e) => !e.allDay));
  const weekReminders = weekDates.map((d) => remindersForDate(d));
  const allDayReminders = weekReminders.map((rs) => rs.filter((r) => !r.time));
  const hasAllDay = allDayEvents.some((evs) => evs.length > 0) || allDayReminders.some((rs) => rs.length > 0);

  const nowHour = now.getHours();
  const nowMin = now.getMinutes();
  const todayCol = weekDates.indexOf(TODAY);
  const nowTop = (nowHour + nowMin / 60) * hourHeight;

  // --- Create drag handlers ---
  const handleDayMouseDown = (e: React.MouseEvent, dayIdx: number) => {
    if (e.button !== 0 || eventDragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const min = yToMinutes(y, hourHeight);
    dragStartRef.current = { dayIdx, startMin: min };
    isDraggingRef.current = false;
  };

  const handleDayMouseMove = (e: React.MouseEvent, dayIdx: number) => {
    if (!dragStartRef.current || dragStartRef.current.dayIdx !== dayIdx || eventDragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const currentMin = yToMinutes(y, hourHeight);
    if (Math.abs(currentMin - dragStartRef.current.startMin) >= 15) {
      isDraggingRef.current = true;
    }
    if (isDraggingRef.current) {
      const startMin = Math.min(dragStartRef.current.startMin, currentMin);
      const endMin = Math.max(dragStartRef.current.startMin, currentMin) + 15;
      setDragPreview({ dayIdx, startMin, endMin });
    }
  };

  const handleDayMouseUp = () => {
    if (dragPreview && isDraggingRef.current) {
      const date = weekDates[dragPreview.dayIdx] ?? selectedDate;
      onCreateEvent({
        date,
        startHour: Math.floor(dragPreview.startMin / 60),
        startMin: dragPreview.startMin % 60,
        endHour: Math.floor(dragPreview.endMin / 60),
        endMin: dragPreview.endMin % 60,
      });
    }
    dragStartRef.current = null;
    isDraggingRef.current = false;
    setDragPreview(null);
  };

  // --- Event drag handlers (move/resize) ---
  const handleEventMouseDown = useCallback((e: React.MouseEvent, ev: CalendarEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const grid = gridRef.current;
    const scroll = scrollRef.current;
    if (!grid || !scroll) return;

    const eventRect = e.currentTarget.getBoundingClientRect();
    const yInEvent = e.clientY - eventRect.top;
    const isResize = yInEvent > eventRect.height - 8;

    const evStartMin = ev.startHour * 60 + ev.startMin;
    const evEndMin = ev.endHour * 60 + ev.endMin;
    const dayIdx = weekDates.indexOf(ev.date);

    const gridRect = grid.getBoundingClientRect();
    const gutterWidth = 56;
    const relY = e.clientY - gridRect.top + scroll.scrollTop;
    const grabMin = yToMinutes(relY, hourHeight);

    const initial: EventDragState = {
      event: ev,
      mode: isResize ? 'resize' : 'move',
      offsetMin: isResize ? 0 : grabMin - evStartMin,
      currentDayIdx: dayIdx >= 0 ? dayIdx : 0,
      currentStartMin: evStartMin,
      currentEndMin: evEndMin,
    };
    eventDragRef.current = initial;
    setEventDrag(initial);

    const startX = e.clientX;
    const startY = e.clientY;
    let hasMoved = false;

    const onMove = (me: MouseEvent) => {
      if (!hasMoved) {
        if (Math.abs(me.clientX - startX) < 4 && Math.abs(me.clientY - startY) < 4) return;
        hasMoved = true;
      }
      const gridEl = gridRef.current;
      const scrollEl = scrollRef.current;
      if (!gridEl || !scrollEl || !eventDragRef.current) return;

      const gr = gridEl.getBoundingClientRect();
      const colAreaLeft = gr.left + gutterWidth;
      const colWidth = (gr.width - gutterWidth) / 7;
      const newDayIdx = Math.max(0, Math.min(6, Math.floor((me.clientX - colAreaLeft) / colWidth)));
      const relYNow = me.clientY - gr.top + scrollEl.scrollTop;
      const min = yToMinutes(relYNow, hourHeight);

      const drag = eventDragRef.current;
      let updated: EventDragState;

      if (drag.mode === 'move') {
        const duration = eventDuration(drag.event);
        const newStart = Math.max(0, Math.round((min - drag.offsetMin) / 15) * 15);
        const newEnd = Math.min(24 * 60, newStart + duration);
        updated = { ...drag, currentDayIdx: newDayIdx, currentStartMin: newStart, currentEndMin: newEnd };
      } else {
        const newEnd = Math.max(drag.currentStartMin + 15, Math.round(min / 15) * 15);
        updated = { ...drag, currentEndMin: Math.min(24 * 60, newEnd) };
      }

      eventDragRef.current = updated;
      setEventDrag(updated);
    };

    const onUp = () => {
      const drag = eventDragRef.current;
      if (drag && hasMoved) {
        const newDate = weekDates[drag.currentDayIdx] ?? ev.date;
        onMoveEvent(drag.event.id, {
          date: newDate,
          startHour: Math.floor(drag.currentStartMin / 60),
          startMin: drag.currentStartMin % 60,
          endHour: Math.floor(drag.currentEndMin / 60),
          endMin: drag.currentEndMin % 60,
        });
      } else if (!hasMoved) {
        onEventClick(ev);
      }
      eventDragRef.current = null;
      setEventDrag(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [weekDates, hourHeight, onMoveEvent, onEventClick]);

  // --- Right-click ---
  const handleContextMenu = (e: React.MouseEvent, dayIdx: number) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const min = yToMinutes(y, hourHeight);
    onContextMenu({
      x: e.clientX,
      y: e.clientY,
      date: weekDates[dayIdx] ?? selectedDate,
      hour: Math.floor(min / 60),
      min: min % 60,
    });
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Single scroll container — sticky header aligns with grid */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden"
        ref={scrollRef}
      >
        {/* Sticky day headers */}
        <div className="sticky top-0 z-20 bg-neutral-950 border-b border-neutral-800">
          <div className="grid grid-cols-[56px_repeat(7,1fr)]">
            <div />
            {weekDates.map((date, i) => {
              const d = new Date(date);
              const isToday = date === TODAY;
              return (
                <button
                  key={date}
                  onClick={() => onSelectDate(date)}
                  className={`py-2 text-center border-l border-neutral-800/50 transition-colors ${
                    isToday ? 'bg-blue-500/5' : 'hover:bg-neutral-900/50'
                  }`}
                >
                  <div className="text-[10px] text-neutral-500">{DAY_NAMES_SHORT[i]}</div>
                  <div className={`text-sm font-semibold ${
                    isToday
                      ? 'text-blue-400 bg-blue-500/20 rounded-full w-7 h-7 flex items-center justify-center mx-auto'
                      : date === selectedDate
                        ? 'text-neutral-200'
                        : 'text-neutral-400'
                  }`}>
                    {d.getDate()}
                  </div>
                </button>
              );
            })}
          </div>

          {/* All-day row */}
          {hasAllDay && (
            <div className="grid grid-cols-[56px_repeat(7,1fr)] border-t border-neutral-800/50">
              <div className="text-[10px] text-neutral-600 py-1 text-right pr-2">весь день</div>
              {allDayEvents.map((evs, i) => (
                <div key={i} className="border-l border-neutral-800/50 px-0.5 py-0.5">
                  {evs.map((ev) => {
                    const isTask = ev.type === 'task';
                    const isRem = ev.type === 'reminder';
                    return (
                      <div
                        key={ev.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer hover:brightness-125 transition-all truncate flex items-center gap-1
                          ${isTask ? 'bg-neutral-950/60 border border-neutral-700/30' : isRem ? '' : SPHERE_META[ev.sphere].bg}
                          ${isTask ? '' : 'border-l-2'} ${SPHERE_META[ev.sphere].border}
                          ${ev.done ? 'opacity-50' : ''}`}
                        style={isTask ? { borderLeftWidth: '2px', borderLeftStyle: 'dashed' } : undefined}
                        onClick={() => {
                          if (isTask || isRem) { onToggleDone(ev.id); }
                          else { onEventClick(ev); }
                        }}
                      >
                        {(isTask || isRem) && (
                          ev.done
                            ? <svg className="w-2.5 h-2.5 text-green-400 shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                            : <svg className={`w-2.5 h-2.5 shrink-0 ${SPHERE_META[ev.sphere].color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                        )}
                        {isRem && <Bell size={10} strokeWidth={1.5} className="inline" />}
                        {isRecurringEvent(ev) && <Repeat size={9} strokeWidth={1.5} className="shrink-0 opacity-50" />}
                        <span className={`${SPHERE_META[ev.sphere].color} ${ev.done ? 'line-through' : ''} ${ev.isException ? 'italic' : ''}`}>{ev.title}</span>
                      </div>
                    );
                  })}
                  {allDayReminders[i]?.map((r) => (
                    <div
                      key={`rem-${r.id}`}
                      className={`text-[10px] px-1.5 py-0.5 truncate flex items-center gap-1 cursor-pointer hover:bg-neutral-800/40 transition-all
                        border-l-2 ${SPHERE_META[r.sphere].border} ${r.status === 'done' ? 'opacity-40' : ''}`}
                    >
                      <span className="shrink-0" onClick={(e) => { e.stopPropagation(); onCompleteReminder(r.id); }}>
                        {r.status === 'done'
                          ? <svg className="w-2.5 h-2.5 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                          : <svg className={`w-2.5 h-2.5 ${SPHERE_META[r.sphere].color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                        }
                      </span>
                      <Bell size={9} strokeWidth={1.5} className={r.status === 'done' ? 'text-neutral-600' : SPHERE_META[r.sphere].color} />
                      {(r.priority === 'urgent' || r.priority === 'high') && <AlertTriangle size={9} strokeWidth={1.5} className="shrink-0 text-amber-400" />}
                      <span className={`truncate ${r.status === 'done' ? 'text-neutral-600 line-through' : SPHERE_META[r.sphere].color}`} onClick={(e) => { e.stopPropagation(); onEditReminder(r, e); }}>{r.title}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Time grid */}
        <div
          ref={gridRef}
          className="grid grid-cols-[56px_repeat(7,1fr)] relative"
          style={{ minHeight: 24 * hourHeight }}
          onMouseUp={handleDayMouseUp}
          onMouseLeave={handleDayMouseUp}
        >
          {/* Hour labels */}
          {HOURS_24.map((h) => (
            <div
              key={h}
              className="col-start-1 text-[10px] text-neutral-600 text-right pr-2"
              style={{ position: 'absolute', top: h * hourHeight - 6, left: 0, width: 56 }}
            >
              {fmtTime(h, 0)}
            </div>
          ))}

          {/* Hour lines */}
          {HOURS_24.map((h) => (
            <div
              key={`line-${h}`}
              className="absolute left-14 right-0 border-t border-neutral-800/50"
              style={{ top: h * hourHeight }}
            />
          ))}

          {/* Day columns */}
          {timedEvents.map((evs, dayIdx) => {
            const isToday = weekDates[dayIdx] === TODAY;
            const positioned = positionEvents(evs, hourHeight);

            return (
              <div
                key={dayIdx}
                className={`relative border-l border-neutral-800/50 ${isToday ? 'bg-blue-500/[0.03]' : ''}`}
                style={{ gridColumn: dayIdx + 2, gridRow: '1 / -1', minHeight: 24 * hourHeight }}
                onMouseDown={(e) => handleDayMouseDown(e, dayIdx)}
                onMouseMove={(e) => handleDayMouseMove(e, dayIdx)}
                onContextMenu={(e) => handleContextMenu(e, dayIdx)}
              >
                {positioned.map((pe) => {
                  const isDragging = eventDrag?.event.id === pe.event.id;
                  const ev = pe.event;
                  const isTask = ev.type === 'task';
                  const isReminder = ev.type === 'reminder';
                  const doneCount = ev.subtasks.filter((s) => s.done).length;
                  const totalCount = ev.subtasks.length;

                  // --- Reminder: compact thin bar ---
                  if (isReminder) {
                    return (
                      <div
                        key={ev.id}
                        className={`absolute rounded-sm px-1.5 flex items-center gap-1 cursor-grab select-none
                          border-l-2 ${SPHERE_META[ev.sphere].border} hover:bg-neutral-800/50 transition-all`}
                        style={{
                          top: pe.top,
                          height: Math.min(Math.max(pe.height, 18), 22),
                          left: `${pe.left}%`,
                          width: `${pe.width}%`,
                          zIndex: 2,
                          opacity: isDragging ? 0.3 : ev.done ? 0.4 : 1,
                        }}
                        onMouseDown={(e) => handleEventMouseDown(e, ev)}
                      >
                        <button
                          className="shrink-0"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); onToggleDone(ev.id); }}
                        >
                          {ev.done ? (
                            <svg className="w-2.5 h-2.5 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                          ) : (
                            <svg className={`w-2.5 h-2.5 ${SPHERE_META[ev.sphere].color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                          )}
                        </button>
                        <Bell size={12} strokeWidth={1.5} />
                        <span className={`text-[9px] truncate ${ev.done ? 'text-neutral-600 line-through' : SPHERE_META[ev.sphere].color}`}>{ev.title}</span>
                      </div>
                    );
                  }

                  // --- Task: outline/dashed style + checkbox ---
                  if (isTask) {
                    return (
                      <div
                        key={ev.id}
                        className={`absolute rounded px-1.5 py-0.5 overflow-hidden cursor-grab
                          select-none transition-opacity hover:brightness-125
                          ${ev.done ? 'bg-neutral-900/30' : 'bg-neutral-950/60'}`}
                        style={{
                          top: pe.top,
                          height: Math.max(pe.height, 20),
                          left: `${pe.left}%`,
                          width: `${pe.width}%`,
                          zIndex: 2,
                          opacity: isDragging ? 0.3 : ev.done ? 0.45 : 1,
                          borderLeft: `2px dashed`,
                          borderLeftColor: `var(--task-accent)`,
                          border: ev.done ? undefined : `1px solid rgba(255,255,255,0.08)`,
                          borderLeftWidth: '2px',
                          borderLeftStyle: 'dashed',
                        }}
                        onMouseDown={(e) => handleEventMouseDown(e, ev)}
                      >
                        <div className={`text-[10px] font-medium truncate flex items-center gap-1 ${ev.done ? 'text-neutral-600 line-through' : SPHERE_META[ev.sphere].color}`}>
                          <button
                            className="shrink-0 flex items-center justify-center"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onToggleDone(ev.id); }}
                          >
                            {ev.done ? (
                              <svg className="w-3 h-3 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                            ) : (
                              <svg className={`w-3 h-3 ${SPHERE_META[ev.sphere].color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                            )}
                          </button>
                          <span className="truncate">{ev.title}</span>
                        </div>
                        {pe.height > 30 && (
                          <div className="text-[9px] text-neutral-600 flex items-center justify-between">
                            <span>{fmtTime(ev.startHour, ev.startMin)} &ndash; {fmtTime(ev.endHour, ev.endMin)}</span>
                            {totalCount > 0 && (
                              <span className={`text-[8px] px-1 ${doneCount === totalCount ? 'text-green-400' : 'text-neutral-500'}`}>
                                {doneCount}/{totalCount}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize" />
                      </div>
                    );
                  }

                  // --- Event (default): filled block ---
                  return (
                    <div
                      key={ev.id}
                      className={`absolute rounded border-l-2 px-1.5 py-0.5 overflow-hidden cursor-grab
                        hover:brightness-125 transition-opacity select-none
                        ${SPHERE_META[ev.sphere].bg} ${SPHERE_META[ev.sphere].border}`}
                      style={{
                        top: pe.top,
                        height: Math.max(pe.height, 20),
                        left: `${pe.left}%`,
                        width: `${pe.width}%`,
                        zIndex: 2,
                        opacity: isDragging ? 0.3 : 1,
                      }}
                      onMouseDown={(e) => handleEventMouseDown(e, ev)}
                    >
                      <div className={`text-[10px] font-medium truncate ${SPHERE_META[ev.sphere].color}`}>
                        {ev.title}
                      </div>
                      {pe.height > 30 && (
                        <div className="text-[9px] text-neutral-500 flex items-center justify-between">
                          <span>{fmtTime(ev.startHour, ev.startMin)} &ndash; {fmtTime(ev.endHour, ev.endMin)}</span>
                          {totalCount > 0 && (
                            <span className={`text-[8px] px-1 ${doneCount === totalCount ? 'text-green-400' : 'text-neutral-500'}`}>
                              {doneCount}/{totalCount}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize" />
                    </div>
                  );
                })}

                {/* Timed reminders from reminders table */}
                {weekReminders[dayIdx]?.filter((r) => r.time).map((r) => {
                  const [hStr, mStr] = r.time!.split(':');
                  const rHour = parseInt(hStr ?? '0', 10);
                  const rMin = parseInt(mStr ?? '0', 10);
                  const top = (rHour + rMin / 60) * hourHeight;
                  return (
                    <div
                      key={`rem-${r.id}`}
                      className={`absolute rounded-sm px-1.5 flex items-center gap-1 select-none
                        border-l-2 ${SPHERE_META[r.sphere].border} hover:bg-neutral-800/50 transition-all cursor-pointer
                        ${r.status === 'done' ? 'opacity-40' : ''}`}
                      style={{ top, height: 20, left: '2%', width: '96%', zIndex: 2 }}
                    >
                      <span className="shrink-0" onClick={(e) => { e.stopPropagation(); onCompleteReminder(r.id); }}>
                        {r.status === 'done'
                          ? <svg className="w-2.5 h-2.5 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                          : <svg className={`w-2.5 h-2.5 ${SPHERE_META[r.sphere].color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                        }
                      </span>
                      <Bell size={10} strokeWidth={1.5} className={r.status === 'done' ? 'text-neutral-600' : SPHERE_META[r.sphere].color} />
                      {(r.priority === 'urgent' || r.priority === 'high') && <AlertTriangle size={9} strokeWidth={1.5} className="shrink-0 text-amber-400" />}
                      <span className={`text-[9px] truncate ${r.status === 'done' ? 'text-neutral-600 line-through' : SPHERE_META[r.sphere].color}`} onClick={(e) => { e.stopPropagation(); onEditReminder(r, e); }}>{r.title}</span>
                    </div>
                  );
                })}

                {/* Create-drag preview */}
                {dragPreview && dragPreview.dayIdx === dayIdx && (
                  <div
                    className="absolute left-[2%] right-[2%] bg-blue-500/20 border border-blue-500/40 rounded pointer-events-none"
                    style={{
                      top: (dragPreview.startMin / 60) * hourHeight,
                      height: ((dragPreview.endMin - dragPreview.startMin) / 60) * hourHeight,
                      zIndex: 3,
                    }}
                  >
                    <div className="text-[10px] text-blue-300 px-1.5 py-0.5">
                      {fmtTime(Math.floor(dragPreview.startMin / 60), dragPreview.startMin % 60)} &ndash;{' '}
                      {fmtTime(Math.floor(dragPreview.endMin / 60), dragPreview.endMin % 60)}
                    </div>
                  </div>
                )}

                {/* Event move/resize ghost */}
                {eventDrag && eventDrag.currentDayIdx === dayIdx && (
                  <div
                    className={`absolute left-[2%] right-[2%] rounded border-l-2 pointer-events-none
                      ${SPHERE_META[eventDrag.event.sphere].bg} ${SPHERE_META[eventDrag.event.sphere].border}`}
                    style={{
                      top: (eventDrag.currentStartMin / 60) * hourHeight,
                      height: ((eventDrag.currentEndMin - eventDrag.currentStartMin) / 60) * hourHeight,
                      zIndex: 5,
                      opacity: 0.7,
                      border: '1px solid rgba(96, 165, 250, 0.5)',
                    }}
                  >
                    <div className={`text-[10px] font-medium truncate px-1.5 py-0.5 ${SPHERE_META[eventDrag.event.sphere].color}`}>
                      {eventDrag.event.title}
                    </div>
                    <div className="text-[9px] text-neutral-400 px-1.5">
                      {fmtTime(Math.floor(eventDrag.currentStartMin / 60), eventDrag.currentStartMin % 60)} &ndash;{' '}
                      {fmtTime(Math.floor(eventDrag.currentEndMin / 60), eventDrag.currentEndMin % 60)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Current time line */}
          {todayCol >= 0 && (
            <div
              className="absolute left-14 right-0 z-10 pointer-events-none"
              style={{ top: nowTop }}
            >
              <div className="relative">
                <div
                  className="absolute h-0.5 bg-red-500"
                  style={{
                    left: `${(todayCol / 7) * 100}%`,
                    width: `${(1 / 7) * 100}%`,
                  }}
                />
                <div
                  className="absolute w-2 h-2 bg-red-500 rounded-full -translate-y-[3px]"
                  style={{ left: `${(todayCol / 7) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zoom controls */}
      <ZoomControls hourHeight={hourHeight} onZoom={onZoom} />
    </div>
  );
}

// ============================================================
// ZOOM CONTROLS
// ============================================================

function ZoomControls({ hourHeight, onZoom }: { hourHeight: number; onZoom: (delta: number) => void }) {
  return (
    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 bg-neutral-900/90 border border-neutral-700/50 rounded-lg px-1.5 py-1 backdrop-blur-sm">
      <button
        onClick={() => onZoom(-8)}
        className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-colors rounded hover:bg-neutral-800"
        title="Уменьшить"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
        </svg>
      </button>
      <input
        type="range"
        min={MIN_HOUR_HEIGHT}
        max={MAX_HOUR_HEIGHT}
        value={hourHeight}
        onChange={(e) => onZoom(Number(e.target.value) - hourHeight)}
        className="w-20 h-1 bg-neutral-700 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:bg-neutral-400 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:hover:bg-neutral-200 [&::-webkit-slider-thumb]:transition-colors"
        title={`Масштаб: ${hourHeight}px/ч`}
      />
      <button
        onClick={() => onZoom(8)}
        className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-200 transition-colors rounded hover:bg-neutral-800"
        title="Увеличить"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
    </div>
  );
}

// ============================================================
// MONTH VIEW
// ============================================================

function MonthView({
  grid,
  selectedDate,
  onSelectDate,
  eventsForDate,
  remindersForDate,
  onCompleteReminder,
  onEditReminder,
}: {
  grid: string[][];
  selectedDate: string;
  onSelectDate: (d: string) => void;
  eventsForDate: (date: string) => CalendarEvent[];
  remindersForDate: (date: string) => CalendarReminder[];
  onCompleteReminder: (id: string) => void;
  onEditReminder: (reminder: CalendarReminder, e: React.MouseEvent) => void;
}) {
  return (
    <div className="p-4 overflow-auto h-full">
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="text-center text-[10px] text-neutral-600 uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 border border-neutral-800 rounded-lg overflow-hidden">
        {grid.flat().map((date, idx) => {
          if (!date) {
            return <div key={idx} className="min-h-[100px] bg-neutral-950/30 border-t border-l border-neutral-800/50 first:border-l-0" />;
          }
          const isToday = date === TODAY;
          const d = new Date(date);
          const dayEvents = eventsForDate(date);
          const dayReminders = remindersForDate(date);
          const totalItems = dayEvents.length + dayReminders.length;
          const shownEvents = dayEvents.slice(0, 3);
          const shownReminders = dayReminders.slice(0, Math.max(0, 3 - shownEvents.length));
          const more = totalItems - shownEvents.length - shownReminders.length;

          return (
            <div
              key={date}
              className={`min-h-[100px] p-1.5 text-left border-t border-l border-neutral-800/50 first:border-l-0 transition-colors cursor-pointer
                ${isToday ? 'bg-blue-500/5' : 'hover:bg-neutral-900/50'}`}
              onClick={() => onSelectDate(date)}
            >
              <div className={`text-xs mb-1 ${
                isToday
                  ? 'text-blue-400 font-bold'
                  : date === selectedDate
                    ? 'text-neutral-200 font-semibold'
                    : 'text-neutral-500'
              }`}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {shownEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`text-[9px] px-1 py-0.5 rounded truncate border-l-2
                      ${SPHERE_META[ev.sphere].bg} ${SPHERE_META[ev.sphere].border} ${SPHERE_META[ev.sphere].color}`}
                  >
                    {ev.allDay ? ev.title : `${fmtTime(ev.startHour, ev.startMin)} ${ev.title}`}
                  </div>
                ))}
                {shownReminders.map((r) => (
                  <div
                    key={`rem-${r.id}`}
                    className={`text-[9px] px-1 py-0.5 truncate border-l-2 flex items-center gap-0.5 hover:bg-neutral-800/40 rounded-sm
                      ${SPHERE_META[r.sphere].border} ${r.status === 'done' ? 'text-neutral-600 line-through' : SPHERE_META[r.sphere].color}`}
                    onClick={(e) => { e.stopPropagation(); onEditReminder(r, e); }}
                  >
                    <span className="shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); onCompleteReminder(r.id); }}>
                      {r.status === 'done'
                        ? <svg className="w-2 h-2 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                        : <svg className={`w-2 h-2 ${SPHERE_META[r.sphere].color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                      }
                    </span>
                    {(r.priority === 'urgent' || r.priority === 'high') && <AlertTriangle size={8} strokeWidth={1.5} className="shrink-0 text-amber-400" />}
                    <span className="truncate">{r.title}</span>
                  </div>
                ))}
                {more > 0 && (
                  <div className="text-[9px] text-neutral-600 pl-1">+{more} ещё</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// DAY VIEW
// ============================================================

function DayView({
  date,
  eventsForDate,
  remindersForDate,
  onCompleteReminder,
  onEditReminder,
  now,
  hourHeight,
  onEventClick,
  onCreateEvent,
  onContextMenu,
  onMoveEvent,
  onZoom,
  onToggleDone,
}: {
  date: string;
  eventsForDate: (date: string) => CalendarEvent[];
  remindersForDate: (date: string) => CalendarReminder[];
  onCompleteReminder: (id: string) => void;
  onEditReminder: (reminder: CalendarReminder, e: React.MouseEvent) => void;
  now: Date;
  hourHeight: number;
  onEventClick: (ev: CalendarEvent) => void;
  onCreateEvent: (data: CreateModalData) => void;
  onContextMenu: (data: ContextMenuState) => void;
  onMoveEvent: (id: string, updates: { date: string; startHour: number; startMin: number; endHour: number; endMin: number }) => void;
  onZoom: (delta: number) => void;
  onToggleDone: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Create-drag
  const [dragPreview, setDragPreview] = useState<{ startMin: number; endMin: number } | null>(null);
  const dragStartRef = useRef<{ startMin: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Event drag
  const [eventDrag, setEventDrag] = useState<EventDragState | null>(null);
  const eventDragRef = useRef<EventDragState | null>(null);

  const events = eventsForDate(date);
  const dayReminders = remindersForDate(date);
  const allDayReminders = dayReminders.filter((r) => !r.time);
  const allDay = events.filter((e) => e.allDay);
  const timed = events.filter((e) => !e.allDay);
  const isToday = date === TODAY;
  const positioned = positionEvents(timed, hourHeight);

  const isEventDragging = eventDrag !== null;
  useEffect(() => {
    if (!isEventDragging) return;
    document.body.style.cursor = eventDrag?.mode === 'resize' ? 'ns-resize' : 'grabbing';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isEventDragging, eventDrag?.mode]);

  useEffect(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 7 * hourHeight;
      }
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nowHour = now.getHours();
  const nowMin = now.getMinutes();

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || eventDragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const min = yToMinutes(y, hourHeight);
    dragStartRef.current = { startMin: min };
    isDraggingRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStartRef.current || eventDragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const currentMin = yToMinutes(y, hourHeight);
    if (Math.abs(currentMin - dragStartRef.current.startMin) >= 15) {
      isDraggingRef.current = true;
    }
    if (isDraggingRef.current) {
      const startMin = Math.min(dragStartRef.current.startMin, currentMin);
      const endMin = Math.max(dragStartRef.current.startMin, currentMin) + 15;
      setDragPreview({ startMin, endMin });
    }
  };

  const handleMouseUp = () => {
    if (dragPreview && isDraggingRef.current) {
      onCreateEvent({
        date,
        startHour: Math.floor(dragPreview.startMin / 60),
        startMin: dragPreview.startMin % 60,
        endHour: Math.floor(dragPreview.endMin / 60),
        endMin: dragPreview.endMin % 60,
      });
    }
    dragStartRef.current = null;
    isDraggingRef.current = false;
    setDragPreview(null);
  };

  const handleEventMouseDown = useCallback((e: React.MouseEvent, ev: CalendarEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const grid = gridRef.current;
    const scroll = scrollRef.current;
    if (!grid || !scroll) return;

    const eventRect = e.currentTarget.getBoundingClientRect();
    const yInEvent = e.clientY - eventRect.top;
    const isResize = yInEvent > eventRect.height - 8;

    const evStartMin = ev.startHour * 60 + ev.startMin;
    const evEndMin = ev.endHour * 60 + ev.endMin;

    const gridRect = grid.getBoundingClientRect();
    const relY = e.clientY - gridRect.top;
    const grabMin = yToMinutes(relY, hourHeight);

    const initial: EventDragState = {
      event: ev,
      mode: isResize ? 'resize' : 'move',
      offsetMin: isResize ? 0 : grabMin - evStartMin,
      currentDayIdx: 0,
      currentStartMin: evStartMin,
      currentEndMin: evEndMin,
    };
    eventDragRef.current = initial;
    setEventDrag(initial);

    const startX = e.clientX;
    const startY = e.clientY;
    let hasMoved = false;

    const onMove = (me: MouseEvent) => {
      if (!hasMoved) {
        if (Math.abs(me.clientX - startX) < 4 && Math.abs(me.clientY - startY) < 4) return;
        hasMoved = true;
      }
      const gridEl = gridRef.current;
      if (!gridEl || !eventDragRef.current) return;

      const gr = gridEl.getBoundingClientRect();
      const relYNow = me.clientY - gr.top;
      const min = yToMinutes(relYNow, hourHeight);
      const drag = eventDragRef.current;
      let updated: EventDragState;

      if (drag.mode === 'move') {
        const duration = eventDuration(drag.event);
        const newStart = Math.max(0, Math.round((min - drag.offsetMin) / 15) * 15);
        const newEnd = Math.min(24 * 60, newStart + duration);
        updated = { ...drag, currentStartMin: newStart, currentEndMin: newEnd };
      } else {
        const newEnd = Math.max(drag.currentStartMin + 15, Math.round(min / 15) * 15);
        updated = { ...drag, currentEndMin: Math.min(24 * 60, newEnd) };
      }

      eventDragRef.current = updated;
      setEventDrag(updated);
    };

    const onUp = () => {
      const drag = eventDragRef.current;
      if (drag && hasMoved) {
        onMoveEvent(drag.event.id, {
          date,
          startHour: Math.floor(drag.currentStartMin / 60),
          startMin: drag.currentStartMin % 60,
          endHour: Math.floor(drag.currentEndMin / 60),
          endMin: drag.currentEndMin % 60,
        });
      } else if (!hasMoved) {
        onEventClick(ev);
      }
      eventDragRef.current = null;
      setEventDrag(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [date, hourHeight, onMoveEvent, onEventClick]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const min = yToMinutes(y, hourHeight);
    onContextMenu({
      x: e.clientX,
      y: e.clientY,
      date,
      hour: Math.floor(min / 60),
      min: min % 60,
    });
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Day header */}
      <div className={`shrink-0 px-6 py-3 border-b border-neutral-800 ${isToday ? 'bg-blue-500/5' : ''}`}>
        <div className="text-lg font-bold text-neutral-200">
          {DAY_NAMES_SHORT[new Date(date).getDay() === 0 ? 6 : new Date(date).getDay() - 1]}, {fmtDateShort(date)}
        </div>
        {isToday && <div className="text-[11px] text-blue-400">Сегодня</div>}
      </div>

      {/* All-day + reminders */}
      {(allDay.length > 0 || allDayReminders.length > 0) && (
        <div className="shrink-0 px-6 py-2 border-b border-neutral-800 flex flex-wrap gap-2">
          {allDay.map((ev) => (
            <div
              key={ev.id}
              onClick={() => onEventClick(ev)}
              className={`text-xs px-2 py-1 rounded border-l-2 cursor-pointer hover:brightness-125 transition-all
                ${SPHERE_META[ev.sphere].bg} ${SPHERE_META[ev.sphere].border} ${SPHERE_META[ev.sphere].color}`}
            >
              {ev.title}
            </div>
          ))}
          {allDayReminders.map((r) => (
            <div
              key={`rem-${r.id}`}
              className={`text-xs px-2 py-1 border-l-2 flex items-center gap-1 cursor-pointer hover:bg-neutral-800/40 transition-all
                ${SPHERE_META[r.sphere].border} ${r.status === 'done' ? 'opacity-40' : ''}`}
            >
              <span className="shrink-0" onClick={(e) => { e.stopPropagation(); onCompleteReminder(r.id); }}>
                {r.status === 'done'
                  ? <svg className="w-3 h-3 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                  : <svg className={`w-3 h-3 ${SPHERE_META[r.sphere].color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                }
              </span>
              <Bell size={10} strokeWidth={1.5} className={r.status === 'done' ? 'text-neutral-600' : SPHERE_META[r.sphere].color} />
              {(r.priority === 'urgent' || r.priority === 'high') && <AlertTriangle size={10} strokeWidth={1.5} className="shrink-0 text-amber-400" />}
              <span className={`${r.status === 'done' ? 'text-neutral-600 line-through' : SPHERE_META[r.sphere].color}`} onClick={(e) => { e.stopPropagation(); onEditReminder(r, e); }}>{r.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <div
          ref={gridRef}
          className="relative"
          style={{ minHeight: 24 * hourHeight }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
        >
          {/* Hour lines */}
          {HOURS_24.map((h) => (
            <div key={h} className="absolute left-0 right-0 flex" style={{ top: h * hourHeight }}>
              <div className="w-14 text-[10px] text-neutral-600 text-right pr-2 -translate-y-1.5">
                {fmtTime(h, 0)}
              </div>
              <div className="flex-1 border-t border-neutral-800/50" />
            </div>
          ))}

          {/* Events */}
          <div className="absolute left-14 right-4">
            {positioned.map((pe) => {
              const isDragging = eventDrag?.event.id === pe.event.id;
              const evnt = pe.event;
              const isTask = evnt.type === 'task';
              const isRem = evnt.type === 'reminder';
              const doneCount = evnt.subtasks.filter((s) => s.done).length;
              const totalCount = evnt.subtasks.length;

              // --- Reminder: compact thin bar ---
              if (isRem) {
                return (
                  <div
                    key={evnt.id}
                    className={`absolute rounded-sm px-2 flex items-center gap-1.5 cursor-grab select-none
                      border-l-2 ${SPHERE_META[evnt.sphere].border} hover:bg-neutral-800/50 transition-all`}
                    style={{
                      top: pe.top,
                      height: Math.min(Math.max(pe.height, 22), 26),
                      left: `${pe.left}%`,
                      width: `${pe.width}%`,
                      zIndex: 2,
                      opacity: isDragging ? 0.3 : evnt.done ? 0.4 : 1,
                    }}
                    onMouseDown={(e) => handleEventMouseDown(e, evnt)}
                  >
                    <button
                      className="shrink-0"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); onToggleDone(evnt.id); }}
                    >
                      {evnt.done ? (
                        <svg className="w-3 h-3 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                      ) : (
                        <svg className={`w-3 h-3 ${SPHERE_META[evnt.sphere].color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                      )}
                    </button>
                    <Bell size={12} strokeWidth={1.5} />
                    <span className={`text-[10px] truncate ${evnt.done ? 'text-neutral-600 line-through' : SPHERE_META[evnt.sphere].color}`}>{evnt.title}</span>
                  </div>
                );
              }

              // --- Task: outline/dashed style + checkbox ---
              if (isTask) {
                return (
                  <div
                    key={evnt.id}
                    className={`absolute rounded px-3 py-1.5 overflow-hidden cursor-grab
                      select-none transition-opacity hover:brightness-125
                      ${evnt.done ? 'bg-neutral-900/30' : 'bg-neutral-950/60'}`}
                    style={{
                      top: pe.top,
                      height: Math.max(pe.height, 28),
                      left: `${pe.left}%`,
                      width: `${pe.width}%`,
                      zIndex: 2,
                      opacity: isDragging ? 0.3 : evnt.done ? 0.45 : 1,
                      border: evnt.done ? undefined : '1px solid rgba(255,255,255,0.08)',
                      borderLeftWidth: '2px',
                      borderLeftStyle: 'dashed',
                      borderLeftColor: 'currentColor',
                    }}
                    onMouseDown={(e) => handleEventMouseDown(e, evnt)}
                  >
                    <div className={`text-xs font-medium flex items-center gap-1.5 ${evnt.done ? 'text-neutral-600 line-through' : SPHERE_META[evnt.sphere].color}`}>
                      <button
                        className="shrink-0"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onToggleDone(evnt.id); }}
                      >
                        {evnt.done ? (
                          <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                        ) : (
                          <svg className={`w-3.5 h-3.5 ${SPHERE_META[evnt.sphere].color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                        )}
                      </button>
                      <span className="truncate">{evnt.title}</span>
                    </div>
                    <div className="text-[10px] text-neutral-600 flex items-center justify-between">
                      <span>{fmtTime(evnt.startHour, evnt.startMin)} &ndash; {fmtTime(evnt.endHour, evnt.endMin)}</span>
                      {totalCount > 0 && (
                        <span className={`text-[8px] px-1 ${doneCount === totalCount ? 'text-green-400' : 'text-neutral-500'}`}>
                          {doneCount}/{totalCount}
                        </span>
                      )}
                    </div>
                    {evnt.description && pe.height > 50 && (
                      <div className="text-[10px] text-neutral-600 mt-0.5 truncate">{evnt.description}</div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize" />
                  </div>
                );
              }

              // --- Event (default): filled block ---
              return (
                <div
                  key={evnt.id}
                  className={`absolute rounded border-l-2 px-3 py-1.5 overflow-hidden cursor-grab
                    hover:brightness-125 transition-opacity select-none
                    ${SPHERE_META[evnt.sphere].bg} ${SPHERE_META[evnt.sphere].border}`}
                  style={{
                    top: pe.top,
                    height: Math.max(pe.height, 28),
                    left: `${pe.left}%`,
                    width: `${pe.width}%`,
                    zIndex: 2,
                    opacity: isDragging ? 0.3 : 1,
                  }}
                  onMouseDown={(e) => handleEventMouseDown(e, evnt)}
                >
                  <div className={`text-xs font-medium truncate ${SPHERE_META[evnt.sphere].color}`}>
                    {evnt.title}
                  </div>
                  <div className="text-[10px] text-neutral-500 flex items-center justify-between">
                    <span>{fmtTime(evnt.startHour, evnt.startMin)} &ndash; {fmtTime(evnt.endHour, evnt.endMin)}</span>
                    {totalCount > 0 && (
                      <span className={`text-[8px] px-1 ${doneCount === totalCount ? 'text-green-400' : 'text-neutral-500'}`}>
                        {doneCount}/{totalCount}
                      </span>
                    )}
                  </div>
                  {evnt.description && pe.height > 50 && (
                    <div className="text-[10px] text-neutral-600 mt-0.5 truncate">{evnt.description}</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize" />
                </div>
              );
            })}

            {/* Timed reminders from reminders table */}
            {dayReminders.filter((r) => r.time).map((r) => {
              const [hStr, mStr] = r.time!.split(':');
              const rHour = parseInt(hStr ?? '0', 10);
              const rMin = parseInt(mStr ?? '0', 10);
              const top = (rHour + rMin / 60) * hourHeight;
              return (
                <div
                  key={`rem-${r.id}`}
                  className={`absolute rounded-sm px-2 flex items-center gap-1.5 select-none
                    border-l-2 ${SPHERE_META[r.sphere].border} hover:bg-neutral-800/50 transition-all cursor-pointer
                    ${r.status === 'done' ? 'opacity-40' : ''}`}
                  style={{ top, height: 22, left: 0, right: 0, zIndex: 2 }}
                >
                  <span className="shrink-0" onClick={(e) => { e.stopPropagation(); onCompleteReminder(r.id); }}>
                    {r.status === 'done'
                      ? <svg className="w-3 h-3 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                      : <svg className={`w-3 h-3 ${SPHERE_META[r.sphere].color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                    }
                  </span>
                  <Bell size={11} strokeWidth={1.5} className={r.status === 'done' ? 'text-neutral-600' : SPHERE_META[r.sphere].color} />
                  {(r.priority === 'urgent' || r.priority === 'high') && <AlertTriangle size={10} strokeWidth={1.5} className="shrink-0 text-amber-400" />}
                  <span className={`text-[10px] truncate ${r.status === 'done' ? 'text-neutral-600 line-through' : SPHERE_META[r.sphere].color}`} onClick={(e) => { e.stopPropagation(); onEditReminder(r, e); }}>
                    {fmtTime(rHour, rMin)} {r.title}
                  </span>
                </div>
              );
            })}

            {/* Create-drag preview */}
            {dragPreview && (
              <div
                className="absolute left-0 right-0 bg-blue-500/20 border border-blue-500/40 rounded pointer-events-none"
                style={{
                  top: (dragPreview.startMin / 60) * hourHeight,
                  height: ((dragPreview.endMin - dragPreview.startMin) / 60) * hourHeight,
                  zIndex: 3,
                }}
              >
                <div className="text-[10px] text-blue-300 px-2 py-0.5">
                  {fmtTime(Math.floor(dragPreview.startMin / 60), dragPreview.startMin % 60)} &ndash;{' '}
                  {fmtTime(Math.floor(dragPreview.endMin / 60), dragPreview.endMin % 60)}
                </div>
              </div>
            )}

            {/* Event drag ghost */}
            {eventDrag && (
              <div
                className={`absolute left-0 right-0 rounded border-l-2 pointer-events-none
                  ${SPHERE_META[eventDrag.event.sphere].bg} ${SPHERE_META[eventDrag.event.sphere].border}`}
                style={{
                  top: (eventDrag.currentStartMin / 60) * hourHeight,
                  height: ((eventDrag.currentEndMin - eventDrag.currentStartMin) / 60) * hourHeight,
                  zIndex: 5,
                  opacity: 0.7,
                  border: '1px solid rgba(96, 165, 250, 0.5)',
                }}
              >
                <div className={`text-xs font-medium truncate px-3 py-1 ${SPHERE_META[eventDrag.event.sphere].color}`}>
                  {eventDrag.event.title}
                </div>
                <div className="text-[10px] text-neutral-400 px-3">
                  {fmtTime(Math.floor(eventDrag.currentStartMin / 60), eventDrag.currentStartMin % 60)} &ndash;{' '}
                  {fmtTime(Math.floor(eventDrag.currentEndMin / 60), eventDrag.currentEndMin % 60)}
                </div>
              </div>
            )}

            {/* Current time line */}
            {isToday && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{ top: ((nowHour * 60 + nowMin) / 60) * hourHeight }}
              >
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full -translate-x-1" />
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <ZoomControls hourHeight={hourHeight} onZoom={onZoom} />
    </div>
  );
}

// ============================================================
// LIST VIEW
// ============================================================

function ListView({
  selectedDate,
  eventsForDate,
  remindersForDate,
  onCompleteReminder,
  onEditReminder,
  onEventClick,
}: {
  selectedDate: string;
  eventsForDate: (date: string) => CalendarEvent[];
  remindersForDate: (date: string) => CalendarReminder[];
  onCompleteReminder: (id: string) => void;
  onEditReminder: (reminder: CalendarReminder, e: React.MouseEvent) => void;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const start = getMonday(selectedDate);
  const days = Array.from({ length: 7 }, (_, i) => dateToStr(addDays(start, i)));

  return (
    <div className="p-6 max-w-2xl overflow-auto h-full">
      <h2 className="text-lg font-bold text-neutral-200 mb-4">Ближайшие 7 дней</h2>
      <div className="space-y-4">
        {days.map((date) => {
          const events = eventsForDate(date);
          const dayReminders = remindersForDate(date);
          const isToday = date === TODAY;
          if (events.length === 0 && dayReminders.length === 0) {
            return (
              <div key={date}>
                <div className={`text-xs font-semibold mb-1 ${isToday ? 'text-blue-400' : 'text-neutral-500'}`}>
                  {DAY_NAMES_SHORT[new Date(date).getDay() === 0 ? 6 : new Date(date).getDay() - 1]}, {fmtDateShort(date)}
                  {isToday && ' — сегодня'}
                </div>
                <div className="text-xs text-neutral-700 pl-3">Нет событий</div>
              </div>
            );
          }
          return (
            <div key={date}>
              <div className={`text-xs font-semibold mb-2 ${isToday ? 'text-blue-400' : 'text-neutral-500'}`}>
                {DAY_NAMES_SHORT[new Date(date).getDay() === 0 ? 6 : new Date(date).getDay() - 1]}, {fmtDateShort(date)}
                {isToday && ' — сегодня'}
              </div>
              <div className="space-y-1 pl-1">
                {events
                  .sort((a, b) => (a.allDay ? -1 : b.allDay ? 1 : (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin)))
                  .map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className={`flex items-center gap-3 px-3 py-2 rounded border-l-2 cursor-pointer hover:brightness-125 transition-all
                        ${SPHERE_META[ev.sphere].bg} ${SPHERE_META[ev.sphere].border}`}
                    >
                      <span className="text-xs text-neutral-500 w-24 shrink-0">
                        {ev.allDay ? 'Весь день' : `${fmtTime(ev.startHour, ev.startMin)} – ${fmtTime(ev.endHour, ev.endMin)}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${SPHERE_META[ev.sphere].color} ${ev.done ? 'line-through opacity-50' : ''}`}>
                          {ev.type === 'reminder' && <><Bell size={11} strokeWidth={1.5} className="inline mr-0.5" /></>}{ev.title}
                        </div>
                        {ev.description && (
                          <div className="text-[11px] text-neutral-600 truncate">{ev.description}</div>
                        )}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${SPHERE_META[ev.sphere].bg} ${SPHERE_META[ev.sphere].color}`}>
                        {SPHERE_META[ev.sphere].label}
                      </span>
                    </div>
                  ))}
                {dayReminders.map((r) => (
                  <div
                    key={`rem-${r.id}`}
                    className={`flex items-center gap-3 px-3 py-1.5 border-l-2 cursor-pointer hover:bg-neutral-800/40 transition-all
                      ${SPHERE_META[r.sphere].border} ${r.status === 'done' ? 'opacity-40' : ''}`}
                  >
                    <span className="text-xs text-neutral-500 w-24 shrink-0">
                      {r.time ? r.time.slice(0, 5) : 'Весь день'}
                    </span>
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span className="shrink-0" onClick={(e) => { e.stopPropagation(); onCompleteReminder(r.id); }}>
                        {r.status === 'done'
                          ? <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                          : <svg className={`w-3.5 h-3.5 ${SPHERE_META[r.sphere].color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                        }
                      </span>
                      <Bell size={12} strokeWidth={1.5} className={r.status === 'done' ? 'text-neutral-600' : SPHERE_META[r.sphere].color} />
                      {(r.priority === 'urgent' || r.priority === 'high') && <AlertTriangle size={12} strokeWidth={1.5} className="shrink-0 text-amber-400" />}
                      <span className={`text-sm ${r.status === 'done' ? 'text-neutral-600 line-through' : SPHERE_META[r.sphere].color}`} onClick={(e) => { e.stopPropagation(); onEditReminder(r, e); }}>{r.title}</span>
                      {r.description && <span className="text-[11px] text-neutral-600 truncate ml-1">{r.description}</span>}
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${SPHERE_META[r.sphere].bg} ${SPHERE_META[r.sphere].color}`}>
                      {SPHERE_META[r.sphere].label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// RIGHT SIDEBAR
// ============================================================

function CalendarSidebar({
  selectedDate,
  onSelectDate,
  viewYear,
  viewMonth,
  eventsForDate,
  remindersForDate,
  onCompleteReminder,
  onEditReminder,
}: {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  viewYear: number;
  viewMonth: number;
  eventsForDate: (date: string) => CalendarEvent[];
  remindersForDate: (date: string) => CalendarReminder[];
  onCompleteReminder: (id: string) => void;
  onEditReminder: (reminder: CalendarReminder, e: React.MouseEvent) => void;
}) {
  const miniGrid = getMonthGrid(viewYear, viewMonth);
  const dayEvents = eventsForDate(selectedDate).sort((a, b) =>
    (a.allDay ? -1 : b.allDay ? 1 : (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin))
  );

  const timed = dayEvents.filter((e) => !e.allDay).sort((a, b) => (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin));
  const freeSlots: Array<{ start: string; end: string }> = [];
  let cursor = 8 * 60;
  for (const ev of timed) {
    const evStart = ev.startHour * 60 + ev.startMin;
    if (evStart > cursor) {
      freeSlots.push({ start: fmtTime(Math.floor(cursor / 60), cursor % 60), end: fmtTime(ev.startHour, ev.startMin) });
    }
    const evEnd = ev.endHour * 60 + ev.endMin;
    cursor = Math.max(cursor, evEnd);
  }
  if (cursor < 22 * 60) {
    freeSlots.push({ start: fmtTime(Math.floor(cursor / 60), cursor % 60), end: '22:00' });
  }

  return (
    <aside className="shrink-0 w-60 border-l border-neutral-800 bg-neutral-950/50 overflow-y-auto">
      {/* Mini calendar */}
      <div className="p-3">
        <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2 text-center">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </div>
        <div className="grid grid-cols-7 gap-0">
          {DAY_NAMES_SHORT.map((d) => (
            <div key={d} className="text-[9px] text-neutral-600 text-center py-0.5">{d[0]}</div>
          ))}
          {miniGrid.flat().map((date, idx) => {
            if (!date) return <div key={idx} />;
            const d = new Date(date);
            const isToday = date === TODAY;
            const isSelected = date === selectedDate;
            const hasEvents = eventsForDate(date).length > 0;
            return (
              <button
                key={date}
                onClick={() => onSelectDate(date)}
                className={`text-[10px] py-0.5 rounded-full relative transition-colors ${
                  isToday
                    ? 'bg-blue-500/30 text-blue-300 font-bold'
                    : isSelected
                      ? 'ring-1 ring-neutral-500 text-white'
                      : 'text-neutral-400 hover:bg-neutral-800'
                }`}
              >
                {d.getDate()}
                {hasEvents && !isToday && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-0.5 rounded-full bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-3 border-t border-neutral-800" />

      {/* Day schedule */}
      <div className="p-3">
        <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          {selectedDate === TODAY ? 'Сегодня' : 'Расписание'} &middot; {fmtDateShort(selectedDate)}
        </div>
        {dayEvents.length === 0 ? (
          <div className="text-[11px] text-neutral-700">Нет событий</div>
        ) : (
          <div className="space-y-1">
            {dayEvents.map((ev) => (
              <div key={ev.id} className={`flex gap-2 py-1 border-l-2 pl-2 rounded-r ${SPHERE_META[ev.sphere].border}`}>
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] truncate ${SPHERE_META[ev.sphere].color} ${ev.done ? 'line-through opacity-50' : ''}`}>
                    {ev.type === 'reminder' && <><Bell size={11} strokeWidth={1.5} className="inline mr-0.5" /></>}{ev.title}
                  </div>
                  <div className="text-[10px] text-neutral-600">
                    {ev.allDay ? 'Весь день' : `${fmtTime(ev.startHour, ev.startMin)} – ${fmtTime(ev.endHour, ev.endMin)}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reminders for selected day */}
        {(() => {
          const sidebarReminders = remindersForDate(selectedDate);
          if (sidebarReminders.length === 0) return null;
          return (
            <div className="mt-2 pt-2 border-t border-neutral-800/50">
              <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Bell size={10} strokeWidth={1.5} /> Напоминания
              </div>
              <div className="space-y-0.5">
                {sidebarReminders.map((r) => (
                  <div
                    key={`rem-${r.id}`}
                    className={`flex items-center gap-1.5 py-0.5 border-l-2 pl-2 rounded-r cursor-pointer hover:bg-neutral-800/30 transition-all
                      ${SPHERE_META[r.sphere].border} ${r.status === 'done' ? 'opacity-40' : ''}`}
                  >
                    <span className="shrink-0" onClick={(e) => { e.stopPropagation(); onCompleteReminder(r.id); }}>
                      {r.status === 'done'
                        ? <svg className="w-2.5 h-2.5 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                        : <svg className={`w-2.5 h-2.5 ${SPHERE_META[r.sphere].color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                      }
                    </span>
                    <div className="flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); onEditReminder(r, e); }}>
                      <div className={`text-[11px] truncate ${r.status === 'done' ? 'text-neutral-600 line-through' : SPHERE_META[r.sphere].color}`}>
                        {(r.priority === 'urgent' || r.priority === 'high') && <AlertTriangle size={9} strokeWidth={1.5} className="inline mr-0.5 text-amber-400" />}
                        {r.title}
                      </div>
                      {r.time && <div className="text-[10px] text-neutral-600">{r.time.slice(0, 5)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      <div className="mx-3 border-t border-neutral-800" />

      {/* Free time */}
      <div className="p-3">
        <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Свободное время
        </div>
        {freeSlots.length === 0 ? (
          <div className="text-[11px] text-neutral-700">Нет свободных слотов</div>
        ) : (
          <div className="space-y-0.5">
            {freeSlots.map((slot, i) => (
              <div key={i} className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-700 shrink-0" />
                {slot.start} &ndash; {slot.end}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mx-3 border-t border-neutral-800" />

      {/* Categories legend */}
      <div className="p-3">
        <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Категории
        </div>
        <div className="space-y-1">
          {SPHERES.map((sphere) => (
            <div key={sphere} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${SPHERE_META[sphere].dot}`} />
              <span className="text-[11px] text-neutral-400">{SPHERE_META[sphere].label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ============================================================
// EVENT DETAIL MODAL
// ============================================================

function EventDetailModal({
  event,
  onClose,
  onDelete,
  onEdit,
  onToggleDone,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit: (ev: CalendarEvent) => void;
  onToggleDone: () => void;
  onToggleSubtask: (idx: number) => void;
  onAddSubtask: (title: string) => void;
  onDeleteSubtask: (idx: number) => void;
}) {
  const [newSubtask, setNewSubtask] = useState('');
  const isTask = event.type === 'task';
  const isReminder = event.type === 'reminder';
  const typeLabel = isTask ? 'Задача' : isReminder ? 'Напоминание' : 'Событие';
  const doneCount = event.subtasks.filter((s) => s.done).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-neutral-900 border border-neutral-700 rounded-xl p-5 w-[420px] max-w-[90vw] shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Type badge + sphere */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2.5 h-2.5 rounded-full ${SPHERE_META[event.sphere].dot}`} />
          <span className={`text-xs ${SPHERE_META[event.sphere].color}`}>{SPHERE_META[event.sphere].label}</span>
          <span className="text-[10px] text-neutral-600 px-1.5 py-0.5 rounded bg-neutral-800">{typeLabel}</span>
          {isRecurringEvent(event) && (
            <span className="text-[10px] text-neutral-500 px-1.5 py-0.5 rounded bg-neutral-800 flex items-center gap-1">
              <Repeat size={10} strokeWidth={1.5} />
              {event.isException ? 'Перенос' : 'Повторяется'}
            </span>
          )}
        </div>

        {/* Title with optional checkbox */}
        <div className="flex items-start gap-2 mb-2">
          {(isTask || isReminder) && (
            <button onClick={onToggleDone} className={`mt-1 shrink-0 ${event.done ? 'text-green-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
              {event.done ? (
                <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
              )}
            </button>
          )}
          <h3 className={`text-lg font-bold text-neutral-100 ${event.done ? 'line-through opacity-50' : ''}`}>
            {isReminder && <><Bell size={11} strokeWidth={1.5} className="inline mr-0.5" /></>}{event.title}
          </h3>
        </div>

        {/* Time */}
        <div className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>
            {fmtDateShort(event.date)} &middot;{' '}
            {event.allDay ? 'Весь день' : `${fmtTime(event.startHour, event.startMin)} – ${fmtTime(event.endHour, event.endMin)}`}
          </span>
        </div>

        {/* Description */}
        {event.description && (
          <p className="text-sm text-neutral-400 mb-3 leading-relaxed">{event.description}</p>
        )}

        {/* Subtasks */}
        {(event.subtasks.length > 0 || isTask) && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Подзадачи</span>
              {event.subtasks.length > 0 && (
                <span className={`text-[10px] ${doneCount === event.subtasks.length ? 'text-green-400' : 'text-neutral-500'}`}>
                  {doneCount}/{event.subtasks.length}
                </span>
              )}
            </div>
            <div className="space-y-1">
              {event.subtasks.map((st, idx) => (
                <div key={idx} className="flex items-center gap-2 group py-0.5">
                  <button
                    onClick={() => onToggleSubtask(idx)}
                    className={`shrink-0 ${st.done ? 'text-green-400' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    {st.done ? (
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                    )}
                  </button>
                  <span className={`text-sm flex-1 ${st.done ? 'text-neutral-600 line-through' : 'text-neutral-300'}`}>{st.title}</span>
                  <button
                    onClick={() => onDeleteSubtask(idx)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            {/* Add subtask */}
            <div className="flex gap-2 mt-2">
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSubtask.trim()) {
                    onAddSubtask(newSubtask.trim());
                    setNewSubtask('');
                  }
                }}
                placeholder="+ Добавить подзадачу"
                className="flex-1 px-2 py-1 bg-neutral-800/50 border border-neutral-700/50 rounded text-xs text-neutral-300 placeholder-neutral-600 outline-none focus:border-neutral-600"
              />
              {newSubtask.trim() && (
                <button
                  onClick={() => { onAddSubtask(newSubtask.trim()); setNewSubtask(''); }}
                  className="px-2 py-1 bg-neutral-800 rounded text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Добавить
                </button>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onEdit(event)}
            className="flex-1 px-3 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg text-sm text-blue-300 hover:bg-blue-600/30 transition-colors"
          >
            Редактировать
          </button>
          <button
            onClick={() => onDelete(event.id)}
            className="flex-1 px-3 py-2 bg-red-600/20 border border-red-500/30 rounded-lg text-sm text-red-300 hover:bg-red-600/30 transition-colors"
          >
            Удалить
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CREATE / EDIT EVENT MODAL
// ============================================================

function CreateEventModal({
  data,
  onClose,
  onSave,
  onUpdate,
}: {
  data: CreateModalData;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onUpdate: (event: CalendarEvent) => void;
}) {
  const isEdit = !!data.editEvent;
  const [title, setTitle] = useState(data.editEvent?.title ?? '');
  const [description, setDescription] = useState(data.editEvent?.description ?? '');
  const [sphere, setSphere] = useState<Sphere>(data.editEvent?.sphere ?? 'personal');
  const [date, setDate] = useState(data.date);
  const [startHour, setStartHour] = useState(data.startHour);
  const [startMin, setStartMin] = useState(data.startMin);
  const [endHour, setEndHour] = useState(data.endHour);
  const [endMin, setEndMin] = useState(data.endMin);
  const [allDay, setAllDay] = useState(data.editEvent?.allDay ?? false);
  const [eventType, setEventType] = useState<EventType>(data.editEvent?.type ?? data.defaultType ?? 'event');
  const [subtasks, setSubtasks] = useState<Subtask[]>(data.editEvent?.subtasks ?? []);
  const [newSubtask, setNewSubtask] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrencePattern | 'none'>(
    data.editEvent?.recurrenceRule?.pattern ?? 'none',
  );
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(
    data.editEvent?.recurrenceRule?.days ?? [],
  );
  const [recurrenceEnd, setRecurrenceEnd] = useState(
    data.editEvent?.recurrenceRule?.endDate ?? '',
  );

  const handleSubmit = () => {
    if (!title.trim()) return;
    const isRec = recurrence !== 'none';
    const event: CalendarEvent = {
      id: data.editEvent?.id ?? `ev-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || undefined,
      sphere,
      date,
      startHour: allDay ? 0 : startHour,
      startMin: allDay ? 0 : startMin,
      endHour: allDay ? 0 : endHour,
      endMin: allDay ? 0 : endMin,
      allDay,
      type: eventType,
      done: data.editEvent?.done ?? false,
      subtasks,
      isRecurring: isRec,
      recurrenceRule: isRec
        ? {
            pattern: recurrence as RecurrencePattern,
            days: recurrence === 'custom' ? recurrenceDays : recurrence === 'weekly' || recurrence === 'biweekly' ? [getDayOfWeek(date)] : undefined,
            endDate: recurrenceEnd || undefined,
            exceptions: data.editEvent?.recurrenceRule?.exceptions,
          }
        : undefined,
    };
    if (isEdit) {
      onUpdate(event);
    } else {
      onSave(event);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-neutral-900 border border-neutral-700 rounded-xl p-5 w-[420px] max-w-[90vw] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-neutral-100 mb-4">
          {isEdit ? 'Редактировать событие' : 'Новое событие'}
        </h3>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название события"
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-600 mb-3 outline-none focus:border-blue-500/50"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание (необязательно)"
          rows={2}
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-600 mb-3 outline-none focus:border-blue-500/50 resize-none"
        />

        <div className="mb-3">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">Сфера</div>
          <div className="flex gap-1.5 flex-wrap">
            {SPHERES.map((s) => (
              <button
                key={s}
                onClick={() => setSphere(s)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors border ${
                  sphere === s
                    ? `${SPHERE_META[s].bg} ${SPHERE_META[s].color} border-current`
                    : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {SPHERE_META[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">Дата</div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 outline-none focus:border-blue-500/50"
          />
        </div>

        {/* Event type */}
        <div className="mb-3">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">Тип</div>
          <div className="flex gap-1.5">
            {([['event', 'Событие'], ['task', 'Задача'], ['reminder', 'Напоминание']] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setEventType(t)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors border ${
                  eventType === t
                    ? 'bg-neutral-700 text-white border-neutral-600'
                    : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {t === 'reminder' && <><Bell size={11} strokeWidth={1.5} className="inline mr-0.5" /></>}{label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="rounded border-neutral-600 bg-neutral-800"
            />
            Весь день
          </label>
        </div>

        {/* Recurrence */}
        <div className="mb-3">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">Повторение</div>
          <div className="flex gap-1.5 flex-wrap">
            {([['none', 'Нет'], ['daily', 'Каждый день'], ['weekly', 'Каждую неделю'], ['biweekly', 'Раз в 2 нед'], ['custom', 'Свой']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setRecurrence(val)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors border ${
                  recurrence === val
                    ? 'bg-neutral-700 text-white border-neutral-600'
                    : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {recurrence === 'custom' && (
            <div className="flex gap-1.5 mt-2">
              {(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const).map((label, idx) => (
                <button
                  key={idx}
                  onClick={() =>
                    setRecurrenceDays((prev) =>
                      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort(),
                    )
                  }
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors border ${
                    recurrenceDays.includes(idx)
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500/40'
                      : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {recurrence !== 'none' && (
            <div className="mt-2">
              <div className="text-[10px] text-neutral-600 mb-1">До (необязательно)</div>
              <input
                type="date"
                value={recurrenceEnd}
                onChange={(e) => setRecurrenceEnd(e.target.value)}
                className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-neutral-300 outline-none focus:border-blue-500/50"
              />
            </div>
          )}
        </div>

        {!allDay && (
          <div className="flex gap-3 mb-4">
            <div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Начало</div>
              <div className="flex gap-1">
                <select
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  className="px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100 outline-none"
                >
                  {HOURS_24.map((h) => <option key={h} value={h}>{pad2(h)}</option>)}
                </select>
                <select
                  value={startMin}
                  onChange={(e) => setStartMin(Number(e.target.value))}
                  className="px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100 outline-none"
                >
                  {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{pad2(m)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Конец</div>
              <div className="flex gap-1">
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  className="px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100 outline-none"
                >
                  {HOURS_24.map((h) => <option key={h} value={h}>{pad2(h)}</option>)}
                </select>
                <select
                  value={endMin}
                  onChange={(e) => setEndMin(Number(e.target.value))}
                  className="px-2 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-100 outline-none"
                >
                  {[0, 15, 30, 45].map((m) => <option key={m} value={m}>{pad2(m)}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Subtasks */}
        <div className="mb-4">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">Подзадачи</div>
          {subtasks.length > 0 && (
            <div className="space-y-1 mb-2">
              {subtasks.map((st, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <button
                    onClick={() => setSubtasks((prev) => prev.map((s, i) => i === idx ? { ...s, done: !s.done } : s))}
                    className={`shrink-0 ${st.done ? 'text-green-400' : 'text-neutral-500'}`}
                  >
                    {st.done ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                    )}
                  </button>
                  <span className={`text-xs flex-1 ${st.done ? 'text-neutral-600 line-through' : 'text-neutral-300'}`}>{st.title}</span>
                  <button
                    onClick={() => setSubtasks((prev) => prev.filter((_, i) => i !== idx))}
                    className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSubtask.trim()) {
                  setSubtasks((prev) => [...prev, { title: newSubtask.trim(), done: false }]);
                  setNewSubtask('');
                }
              }}
              placeholder="+ Добавить подзадачу"
              className="flex-1 px-2 py-1 bg-neutral-800/50 border border-neutral-700/50 rounded text-xs text-neutral-300 placeholder-neutral-600 outline-none focus:border-neutral-600"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="flex-1 px-3 py-2 bg-blue-600/30 border border-blue-500/40 rounded-lg text-sm text-blue-300 hover:bg-blue-600/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isEdit ? 'Сохранить' : 'Создать'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CONTEXT MENU
// ============================================================

function ContextMenuComponent({
  x,
  y,
  onNewEvent,
  onNewTask,
  onNewReminder,
}: {
  x: number;
  y: number;
  onNewEvent: () => void;
  onNewTask: () => void;
  onNewReminder: () => void;
}) {
  return (
    <div
      className="fixed z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[180px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onNewEvent}
        className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Новое событие
      </button>
      <button
        onClick={onNewTask}
        className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4 text-green-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
        Новая задача
      </button>
      <button
        onClick={onNewReminder}
        className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors flex items-center gap-2"
      >
        <Bell size={12} strokeWidth={1.5} />
        Новое напоминание
      </button>
    </div>
  );
}

// ============================================================
// REMINDER EDIT POPUP
// ============================================================

const PRIORITY_OPTIONS: Array<{ value: CalendarReminder['priority']; label: string; color: string }> = [
  { value: 'low', label: 'Низкий', color: 'text-neutral-400' },
  { value: 'medium', label: 'Средний', color: 'text-blue-400' },
  { value: 'high', label: 'Высокий', color: 'text-amber-400' },
  { value: 'urgent', label: 'Срочный', color: 'text-red-400' },
];

const SPHERE_OPTIONS: Array<{ value: Sphere; label: string }> = [
  { value: 'dev', label: 'Dev' },
  { value: 'teaching', label: 'Teaching' },
  { value: 'study', label: 'Study' },
  { value: 'health', label: 'Health' },
  { value: 'finance', label: 'Finance' },
  { value: 'personal', label: 'Личное' },
];

function ReminderEditPopup({ reminder, rect, onSave, onClose }: {
  reminder: CalendarReminder;
  rect: DOMRect;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(reminder.title);
  const [description, setDescription] = useState(reminder.description ?? '');
  const [date, setDate] = useState(reminder.date);
  const [time, setTime] = useState(reminder.time?.slice(0, 5) ?? '');
  const [priority, setPriority] = useState(reminder.priority);
  const [sphere, setSphere] = useState(reminder.sphere);
  const [subtasks, setSubtasks] = useState<ReminderSubtask[]>(reminder.subtasks ?? []);
  const [newSubtask, setNewSubtask] = useState('');

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEsc); };
  }, [onClose]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      date,
      time: time || null,
      priority,
      sphere,
      subtasks,
    });
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), title: newSubtask.trim(), done: false }]);
    setNewSubtask('');
  };

  const toggleSubtask = (id: string) => {
    setSubtasks((prev) => prev.map((s) => s.id === id ? { ...s, done: !s.done } : s));
  };

  const deleteSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const popupHeight = 440;
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const top = spaceBelow >= popupHeight ? rect.bottom + 4 : Math.max(8, rect.top - popupHeight - 4);
  const left = Math.min(Math.max(8, rect.left - 100), window.innerWidth - 350);

  const inputCls = 'w-full px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 focus:outline-none focus:border-blue-500';

  return (
    <div ref={ref} className="fixed z-50 animate-in fade-in duration-150" style={{ top, left, width: 340 }}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-neutral-200">Редактировать напоминание</span>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-2.5">
          <input type="text" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} autoFocus />
          <textarea placeholder="Описание" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} />

          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select value={priority} onChange={(e) => setPriority(e.target.value as CalendarReminder['priority'])} className={inputCls}>
              {PRIORITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={sphere} onChange={(e) => setSphere(e.target.value as Sphere)} className={inputCls}>
              {SPHERE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Subtasks */}
          <div>
            <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Подзадачи</div>
            <div className="space-y-1 mb-2">
              {subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5 group">
                  <button onClick={() => toggleSubtask(s.id)} className="shrink-0">
                    {s.done
                      ? <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                      : <svg className="w-3.5 h-3.5 text-neutral-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                    }
                  </button>
                  <span className={`text-xs flex-1 ${s.done ? 'text-neutral-600 line-through' : 'text-neutral-300'}`}>{s.title}</span>
                  <button onClick={() => deleteSubtask(s.id)} className="shrink-0 text-neutral-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="+ Добавить подзадачу"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                className="flex-1 px-2 py-1 rounded bg-neutral-800 border border-neutral-700/50 text-xs text-neutral-300 focus:outline-none focus:border-blue-500"
              />
              {newSubtask.trim() && (
                <button onClick={addSubtask} className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">+</button>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors">Отмена</button>
          <button onClick={handleSubmit} disabled={!title.trim()} className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm text-white transition-colors">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
