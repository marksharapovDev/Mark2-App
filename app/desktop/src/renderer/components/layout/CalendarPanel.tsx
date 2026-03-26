import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Bell, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useCalendar } from '../../context/calendar-context';

// --- Types ---

type Sphere = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'personal';

interface ReminderSubtask {
  id: string;
  title: string;
  done: boolean;
}

interface PanelReminder {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'done' | 'skipped' | 'deferred';
  sphere: Sphere;
  subtasks: ReminderSubtask[];
}

interface RecurrenceRule {
  pattern: string;
  days?: number[];
  dayTimes?: Record<number, { startHour: number; startMin: number; endHour: number; endMin: number }>;
  endDate?: string;
  exceptions?: string[];
}

interface CalendarEvent {
  id: string;
  title: string;
  sphere: Sphere;
  date: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  allDay?: boolean;
  description?: string;
  isReminder?: boolean;
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
  isException?: boolean;
  recurringParentId?: string;
}

type DetailView = { type: 'event'; event: CalendarEvent } | { type: 'reminder'; reminder: PanelReminder };

// --- Constants ---

const SPHERE_META: Record<Sphere, { label: string; color: string; bg: string; border: string; dot: string }> = {
  dev:      { label: 'Dev',       color: 'text-blue-300',    bg: 'bg-blue-500/15',    border: 'border-l-blue-500',    dot: 'bg-blue-500' },
  teaching: { label: 'Teaching',  color: 'text-green-300',   bg: 'bg-green-500/15',   border: 'border-l-green-500',   dot: 'bg-green-500' },
  study:    { label: 'Study',     color: 'text-purple-300',  bg: 'bg-purple-500/15',  border: 'border-l-purple-500',  dot: 'bg-purple-500' },
  health:   { label: 'Health',    color: 'text-orange-300',  bg: 'bg-orange-500/15',  border: 'border-l-orange-500',  dot: 'bg-orange-500' },
  finance:  { label: 'Finance',   color: 'text-red-300',     bg: 'bg-red-500/15',     border: 'border-l-red-500',     dot: 'bg-red-500' },
  personal: { label: 'Личное',    color: 'text-neutral-300', bg: 'bg-neutral-500/15', border: 'border-l-neutral-500', dot: 'bg-neutral-500' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Низкий', color: 'text-neutral-500' },
  medium: { label: 'Средний', color: 'text-blue-400' },
  high: { label: 'Высокий', color: 'text-amber-400' },
  urgent: { label: 'Срочный', color: 'text-red-400' },
};

const DAY_NAMES_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const TODAY = new Date().toLocaleDateString('sv-SE');

function pad2(n: number): string { return String(n).padStart(2, '0'); }

function mapDbEventToPanel(e: Record<string, unknown>): CalendarEvent {
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
    description: meta.description ? String(meta.description) : undefined,
    isRecurring: (e.isRecurring as boolean) ?? false,
    recurrenceRule: e.recurrenceRule ? (e.recurrenceRule as RecurrenceRule) : undefined,
    isException: (e.isException as boolean) ?? false,
    recurringParentId: e.recurringParentId ? String(e.recurringParentId) : undefined,
  };
}

// --- Utilities ---

function fmtTime(h: number, m: number): string { return `${pad2(h)}:${pad2(m)}`; }

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

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function expandRecurringForPanel(
  dbEvents: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string,
): CalendarEvent[] {
  const result: CalendarEvent[] = [];
  const exceptionDates = new Map<string, Set<string>>();
  const exceptionEventDates = new Map<string, Set<string>>();

  for (const e of dbEvents) {
    if (e.isRecurring && e.recurrenceRule?.exceptions) {
      exceptionDates.set(e.id, new Set(e.recurrenceRule.exceptions));
    }
    if (e.isException && e.recurringParentId) {
      if (!exceptionEventDates.has(e.recurringParentId)) exceptionEventDates.set(e.recurringParentId, new Set());
      exceptionEventDates.get(e.recurringParentId)!.add(e.date);
    }
  }

  for (const e of dbEvents) {
    if (!e.isRecurring || !e.recurrenceRule) {
      result.push(e);
      continue;
    }
    const rule = e.recurrenceRule;
    const exceptions = exceptionDates.get(e.id) ?? new Set<string>();
    const exceptionEvts = exceptionEventDates.get(e.id) ?? new Set<string>();
    const ruleEnd = rule.endDate ?? rangeEnd;
    const originDate = new Date(e.date);
    const cursor = new Date(Math.max(originDate.getTime(), new Date(rangeStart).getTime()));
    const end = new Date(Math.min(new Date(ruleEnd).getTime(), new Date(rangeEnd).getTime()));

    while (cursor <= end) {
      const curStr = dateToStr(cursor);
      const curDow = getDayOfWeek(curStr);
      let matches = false;
      if (rule.pattern === 'daily') matches = cursor >= originDate;
      else if (rule.pattern === 'weekly') matches = (rule.days ?? [getDayOfWeek(e.date)]).includes(curDow) && cursor >= originDate;
      else if (rule.pattern === 'biweekly') {
        const weeksDiff = Math.floor((cursor.getTime() - originDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        matches = (rule.days ?? [getDayOfWeek(e.date)]).includes(curDow) && weeksDiff % 2 === 0 && cursor >= originDate;
      } else if (rule.pattern === 'custom') matches = (rule.days ?? []).includes(curDow) && cursor >= originDate;

      if (matches && !exceptions.has(curStr) && !exceptionEvts.has(curStr)) {
        const dayTime = rule.dayTimes?.[curDow];
        result.push({
          ...e,
          id: curStr === e.date ? e.id : `${e.id}__${curStr}`,
          date: curStr,
          startHour: dayTime?.startHour ?? e.startHour,
          startMin: dayTime?.startMin ?? e.startMin,
          endHour: dayTime?.endHour ?? e.endHour,
          endMin: dayTime?.endMin ?? e.endMin,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return result;
}

function eventsForDateFn(date: string, events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((e) => e.date === date);
}

function fmtDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day ?? '0', 10)} ${months[parseInt(month ?? '0', 10)]}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// --- Component ---

export function CalendarPanel() {
  const { closeCalendar, selectedDate, setSelectedDate } = useCalendar();
  const navigate = useNavigate();

  const nowDate = new Date();
  const [viewYear, setViewYear] = useState(nowDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(nowDate.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<PanelReminder[]>([]);
  const [detailView, setDetailView] = useState<DetailView | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPriority, setEditPriority] = useState<PanelReminder['priority']>('medium');
  const [editSphere, setEditSphere] = useState<Sphere>('personal');
  const [editSubtasks, setEditSubtasks] = useState<ReminderSubtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');

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
      setEvents(dbEvents.map((e) => mapDbEventToPanel(e as unknown as Record<string, unknown>)));
      setReminders((dbReminders ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        title: String(r.title),
        description: r.description ? String(r.description) : null,
        date: String(r.date).slice(0, 10),
        time: r.time ? String(r.time) : null,
        priority: (r.priority as PanelReminder['priority']) ?? 'medium',
        status: (r.status as PanelReminder['status']) ?? 'pending',
        sphere: (r.sphere as Sphere) ?? 'personal',
        subtasks: Array.isArray(r.subtasks) ? (r.subtasks as ReminderSubtask[]) : [],
      })));
    } catch {
      // keep empty state
    }
  }, []);

  useEffect(() => { reloadEvents(); }, [reloadEvents]);

  useEffect(() => {
    return window.dataEvents.onDataChanged((entities) => {
      if (entities.includes('events') || entities.includes('reminders')) {
        reloadEvents();
      }
    });
  }, [reloadEvents]);

  const handleToggleReminder = useCallback(async (id: string) => {
    const current = reminders.find((r) => r.id === id);
    const newStatus = current?.status === 'done' ? 'pending' as const : 'done' as const;
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, status: newStatus } : r));
    try {
      if (newStatus === 'done') await window.db.reminders.complete(id);
      else await window.db.reminders.uncomplete(id);
    } catch { /* ignore */ }
  }, [reminders]);

  const handleToggleSubtask = useCallback(async (reminderId: string, subtaskId: string) => {
    setReminders((prev) => prev.map((r) => {
      if (r.id !== reminderId) return r;
      const updated = r.subtasks.map((s) => s.id === subtaskId ? { ...s, done: !s.done } : s);
      return { ...r, subtasks: updated };
    }));
    // Also update detail view if viewing this reminder
    setDetailView((prev) => {
      if (prev?.type === 'reminder' && prev.reminder.id === reminderId) {
        const updated = prev.reminder.subtasks.map((s) => s.id === subtaskId ? { ...s, done: !s.done } : s);
        return { type: 'reminder', reminder: { ...prev.reminder, subtasks: updated } };
      }
      return prev;
    });
    const r = reminders.find((r) => r.id === reminderId);
    if (r) {
      const updated = r.subtasks.map((s) => s.id === subtaskId ? { ...s, done: !s.done } : s);
      try { await window.db.reminders.update(reminderId, { subtasks: updated }); } catch { /* ignore */ }
    }
  }, [reminders]);

  const remindersForDate = useCallback((date: string) => {
    return reminders.filter((r) => r.date === date);
  }, [reminders]);

  const monthGrid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const expandedEvents = useMemo(() => {
    const year = new Date().getFullYear();
    return expandRecurringForPanel(events, `${year}-01-01`, `${year}-12-31`);
  }, [events]);

  const selectedDayEvents = useMemo(() => eventsForDateFn(selectedDate, expandedEvents).sort((a, b) =>
    (a.allDay ? -1 : b.allDay ? 1 : (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin))
  ), [selectedDate, expandedEvents]);

  // Upcoming: future events (exclude today), max 5
  const upcomingItems = useMemo(() => {
    const tomorrow = dateToStr(addDays(new Date(TODAY), 1));
    const futureEvents = expandedEvents
      .filter((e) => e.date >= tomorrow)
      .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin))
      .slice(0, 5);
    const futureReminders = reminders
      .filter((r) => r.date >= tomorrow && r.status !== 'done')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
    const combined = [
      ...futureEvents.map((e) => ({ key: `e-${e.id}`, date: e.date, time: e.allDay ? 'Весь день' : fmtTime(e.startHour, e.startMin), title: e.title, sphere: e.sphere, isReminder: false as const, item: e })),
      ...futureReminders.map((r) => ({ key: `r-${r.id}`, date: r.date, time: r.time?.slice(0, 5) ?? 'Весь день', title: r.title, sphere: r.sphere, isReminder: true as const, item: r })),
    ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
    return combined;
  }, [expandedEvents, reminders]);

  const navigateMonth = useCallback((dir: -1 | 1) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
  }, [viewMonth, viewYear]);

  const handlePopout = useCallback(async () => {
    await window.calendar.popout();
    closeCalendar();
  }, [closeCalendar]);

  const handleFullscreen = useCallback(() => {
    navigate('/calendar');
    closeCalendar();
  }, [navigate, closeCalendar]);

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setDetailView(null);
    setEditMode(false);
  }, [setSelectedDate]);

  const openReminderDetail = (r: PanelReminder) => {
    setDetailView({ type: 'reminder', reminder: r });
    setEditMode(false);
  };

  const openEventDetail = (ev: CalendarEvent) => {
    setDetailView({ type: 'event', event: ev });
    setEditMode(false);
  };

  const startEditReminder = (r: PanelReminder) => {
    setEditTitle(r.title);
    setEditDesc(r.description ?? '');
    setEditDate(r.date);
    setEditTime(r.time?.slice(0, 5) ?? '');
    setEditPriority(r.priority);
    setEditSphere(r.sphere);
    setEditSubtasks([...r.subtasks]);
    setNewSubtask('');
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (detailView?.type !== 'reminder' || !editTitle.trim()) return;
    const id = detailView.reminder.id;
    const data: Record<string, unknown> = {
      title: editTitle.trim(),
      description: editDesc.trim() || null,
      date: editDate,
      time: editTime || null,
      priority: editPriority,
      sphere: editSphere,
      subtasks: editSubtasks,
    };
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, ...data, subtasks: editSubtasks } as PanelReminder : r));
    const updated = { ...detailView.reminder, ...data, subtasks: editSubtasks } as PanelReminder;
    setDetailView({ type: 'reminder', reminder: updated });
    setEditMode(false);
    try { await window.db.reminders.update(id, data); } catch { /* ignore */ }
  };

  const addEditSubtask = () => {
    if (!newSubtask.trim()) return;
    setEditSubtasks((prev) => [...prev, { id: crypto.randomUUID(), title: newSubtask.trim(), done: false }]);
    setNewSubtask('');
  };

  const inputCls = 'w-full px-2.5 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 focus:outline-none focus:border-blue-500';

  // ===== DETAIL VIEW =====
  if (detailView) {
    if (editMode && detailView.type === 'reminder') {
      // Edit form
      return (
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-neutral-800 shrink-0">
            <button onClick={() => setEditMode(false)} className="text-neutral-500 hover:text-neutral-200 transition-colors"><ArrowLeft size={14} /></button>
            <span className="flex-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Редактировать</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <input type="text" placeholder="Название" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputCls} autoFocus />
            <textarea placeholder="Описание" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={inputCls} />
              <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as PanelReminder['priority'])} className={inputCls}>
                {Object.entries(PRIORITY_LABELS).map(([v, p]) => <option key={v} value={v}>{p.label}</option>)}
              </select>
              <select value={editSphere} onChange={(e) => setEditSphere(e.target.value as Sphere)} className={inputCls}>
                {Object.entries(SPHERE_META).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-neutral-500 uppercase mb-1">Подзадачи</div>
              {editSubtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-1.5 py-0.5 group">
                  <button onClick={() => setEditSubtasks((prev) => prev.map((x) => x.id === s.id ? { ...x, done: !x.done } : x))} className="shrink-0">
                    {s.done
                      ? <svg className="w-3 h-3 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                      : <svg className="w-3 h-3 text-neutral-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                    }
                  </button>
                  <span className={`text-[11px] flex-1 ${s.done ? 'text-neutral-600 line-through' : 'text-neutral-300'}`}>{s.title}</span>
                  <button onClick={() => setEditSubtasks((prev) => prev.filter((x) => x.id !== s.id))} className="text-neutral-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <div className="flex gap-1 mt-1">
                <input type="text" placeholder="+ Подзадача" value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditSubtask(); } }}
                  className="flex-1 px-2 py-1 rounded bg-neutral-800 border border-neutral-700/50 text-[11px] text-neutral-300 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditMode(false)} className="px-3 py-1 text-xs text-neutral-400 hover:text-neutral-200">Отмена</button>
              <button onClick={handleSaveEdit} disabled={!editTitle.trim()} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs text-white">Сохранить</button>
            </div>
          </div>
        </div>
      );
    }

    // Detail card
    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-neutral-800 shrink-0">
          <button onClick={() => { setDetailView(null); setEditMode(false); }} className="text-neutral-500 hover:text-neutral-200 transition-colors flex items-center gap-1 text-[10px]">
            <ArrowLeft size={12} /> Назад
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {detailView.type === 'event' ? (
            // Event detail
            <div>
              <div className={`text-sm font-medium mb-1 ${SPHERE_META[detailView.event.sphere].color}`}>{detailView.event.title}</div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${SPHERE_META[detailView.event.sphere].bg} ${SPHERE_META[detailView.event.sphere].color}`}>{SPHERE_META[detailView.event.sphere].label}</span>
              </div>
              <div className="text-[11px] text-neutral-400 mb-1">
                {fmtDateShort(detailView.event.date)} &middot; {detailView.event.allDay ? 'Весь день' : `${fmtTime(detailView.event.startHour, detailView.event.startMin)} – ${fmtTime(detailView.event.endHour, detailView.event.endMin)}`}
              </div>
              {detailView.event.description && <div className="text-[11px] text-neutral-500 mt-2">{detailView.event.description}</div>}
            </div>
          ) : (
            // Reminder detail
            <div>
              <div className={`text-sm font-medium mb-1 flex items-center gap-1.5 ${SPHERE_META[detailView.reminder.sphere].color}`}>
                <Bell size={14} strokeWidth={1.5} />
                {detailView.reminder.title}
              </div>
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${SPHERE_META[detailView.reminder.sphere].bg} ${SPHERE_META[detailView.reminder.sphere].color}`}>{SPHERE_META[detailView.reminder.sphere].label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 ${PRIORITY_LABELS[detailView.reminder.priority]?.color ?? 'text-neutral-400'}`}>{PRIORITY_LABELS[detailView.reminder.priority]?.label ?? detailView.reminder.priority}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${detailView.reminder.status === 'done' ? 'bg-green-500/15 text-green-400' : 'bg-neutral-800 text-neutral-400'}`}>
                  {detailView.reminder.status === 'done' ? 'Выполнено' : 'Ожидает'}
                </span>
              </div>
              <div className="text-[11px] text-neutral-400 mb-2">
                {fmtDateShort(detailView.reminder.date)} &middot; {detailView.reminder.time ? detailView.reminder.time.slice(0, 5) : 'Весь день'}
              </div>
              {detailView.reminder.description && <div className="text-[11px] text-neutral-500 mb-3">{detailView.reminder.description}</div>}

              {/* Subtasks */}
              {detailView.reminder.subtasks.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-semibold text-neutral-500 uppercase mb-1">Подзадачи</div>
                  {detailView.reminder.subtasks.map((s) => (
                    <div key={s.id} className="flex items-center gap-1.5 py-0.5 cursor-pointer" onClick={() => handleToggleSubtask(detailView.reminder.id, s.id)}>
                      {s.done
                        ? <svg className="w-3 h-3 text-green-400 shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                        : <svg className="w-3 h-3 text-neutral-500 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                      }
                      <span className={`text-[11px] ${s.done ? 'text-neutral-600 line-through' : 'text-neutral-300'}`}>{s.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                <button onClick={() => startEditReminder(detailView.reminder)} className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors">
                  <Pencil size={10} /> Редактировать
                </button>
                <button onClick={() => handleToggleReminder(detailView.reminder.id)} className={`px-2.5 py-1 rounded text-xs transition-colors ${detailView.reminder.status === 'done' ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25' : 'bg-green-500/15 text-green-400 hover:bg-green-500/25'}`}>
                  {detailView.reminder.status === 'done' ? 'Вернуть' : 'Выполнить'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== LIST VIEW (default) =====
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-neutral-800 shrink-0">
        <span className="flex-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Календарь</span>
        <button onClick={handlePopout} className="text-neutral-600 hover:text-neutral-400 transition-colors" title="Плавающее окно">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
        </button>
        <button onClick={handleFullscreen} className="text-neutral-600 hover:text-neutral-400 transition-colors" title="Полный экран">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
        </button>
        <button onClick={closeCalendar} className="text-neutral-600 hover:text-neutral-400 transition-colors" title="Закрыть">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Mini month calendar */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => navigateMonth(-1)} className="text-neutral-500 hover:text-neutral-200 transition-colors"><ChevronLeft size={14} /></button>
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button onClick={() => navigateMonth(1)} className="text-neutral-500 hover:text-neutral-200 transition-colors"><ChevronRight size={14} /></button>
          </div>

          <div className="grid grid-cols-7 gap-0">
            {DAY_NAMES_SHORT.map((d) => (
              <div key={d} className="text-[9px] text-neutral-600 text-center py-0.5">{d[0]}</div>
            ))}
            {monthGrid.flat().map((date, idx) => {
              if (!date) return <div key={idx} />;
              const d = new Date(date);
              const isToday = date === TODAY;
              const isSelected = date === selectedDate;
              const hasEvents = eventsForDateFn(date, expandedEvents).length > 0;
              const hasReminders = remindersForDate(date).length > 0;
              const hasItems = hasEvents || hasReminders;
              return (
                <button
                  key={date}
                  onClick={() => handleSelectDate(date)}
                  className={`text-[10px] py-0.5 rounded-full relative transition-colors ${
                    isToday
                      ? 'bg-blue-500/30 text-blue-300 font-bold'
                      : isSelected
                        ? 'ring-1 ring-neutral-500 text-white'
                        : 'text-neutral-400 hover:bg-neutral-800'
                  }`}
                >
                  {d.getDate()}
                  {hasItems && (
                    <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-0.5 rounded-full ${
                      isToday ? 'bg-blue-300' : hasReminders && !hasEvents ? 'bg-amber-400' : 'bg-blue-400'
                    }`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-3 border-t border-neutral-800" />

        {/* Selected day's events + reminders */}
        <div className="p-3">
          <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            {selectedDate === TODAY ? 'Сегодня' : fmtDateShort(selectedDate)}
          </div>
          {selectedDayEvents.length === 0 && remindersForDate(selectedDate).length === 0 ? (
            <div className="text-[11px] text-neutral-700">Нет событий</div>
          ) : (
            <div className="space-y-1">
              {selectedDayEvents.map((ev) => (
                <div key={ev.id} onClick={() => openEventDetail(ev)} className={`flex gap-2 py-1 border-l-2 pl-2 rounded-r cursor-pointer hover:bg-neutral-800/30 transition-colors ${SPHERE_META[ev.sphere].border}`}>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] truncate ${SPHERE_META[ev.sphere].color}`}>{ev.title}</div>
                    <div className="text-[10px] text-neutral-600">
                      {ev.allDay ? 'Весь день' : `${fmtTime(ev.startHour, ev.startMin)} – ${fmtTime(ev.endHour, ev.endMin)}`}
                    </div>
                  </div>
                </div>
              ))}
              {remindersForDate(selectedDate).map((r) => (
                <div
                  key={`rem-${r.id}`}
                  className={`flex items-center gap-1.5 py-1 border-l-2 pl-2 rounded-r cursor-pointer hover:bg-neutral-800/30 transition-all
                    ${SPHERE_META[r.sphere].border} ${r.status === 'done' ? 'opacity-40' : ''}`}
                >
                  <span className="shrink-0" onClick={(e) => { e.stopPropagation(); handleToggleReminder(r.id); }}>
                    {r.status === 'done'
                      ? <svg className="w-2.5 h-2.5 text-green-400" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.03 5.53-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.44l2.97-2.97a.75.75 0 0 1 1.06 1.06Z"/></svg>
                      : <svg className={`w-2.5 h-2.5 ${SPHERE_META[r.sphere].color}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg>
                    }
                  </span>
                  <div className="flex-1 min-w-0" onClick={() => openReminderDetail(r)}>
                    <div className={`text-[11px] truncate flex items-center gap-0.5 ${r.status === 'done' ? 'text-neutral-600 line-through' : SPHERE_META[r.sphere].color}`}>
                      <Bell size={10} strokeWidth={1.5} className="shrink-0" />
                      {(r.priority === 'urgent' || r.priority === 'high') && <AlertTriangle size={9} strokeWidth={1.5} className="shrink-0 text-amber-400" />}
                      {r.title}
                    </div>
                    <div className="text-[10px] text-neutral-600">
                      {r.time ? r.time.slice(0, 5) : 'Весь день'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mx-3 border-t border-neutral-800" />

        {/* Upcoming (future days only) */}
        <div className="p-3">
          <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Ближайшие
          </div>
          {upcomingItems.length === 0 ? (
            <div className="text-[11px] text-neutral-700">Нет событий</div>
          ) : (
            <div className="space-y-1">
              {upcomingItems.map((item) => (
                <div
                  key={item.key}
                  onClick={() => item.isReminder ? openReminderDetail(item.item as PanelReminder) : openEventDetail(item.item as CalendarEvent)}
                  className={`flex gap-2 py-1 border-l-2 pl-2 rounded-r cursor-pointer hover:bg-neutral-800/30 transition-colors ${SPHERE_META[item.sphere].border}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] truncate flex items-center gap-0.5 ${SPHERE_META[item.sphere].color}`}>
                      {item.isReminder && <Bell size={10} strokeWidth={1.5} className="shrink-0" />}
                      {item.title}
                    </div>
                    <div className="text-[10px] text-neutral-600">
                      {fmtDateShort(item.date)} &middot; {item.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
