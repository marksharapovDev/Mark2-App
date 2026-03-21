import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useCalendar } from '../context/calendar-context';

// --- Types ---

type Sphere = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'personal';
type ViewMode = 'month' | 'week' | 'day' | 'list';

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
  isReminder?: boolean;
}

interface CreateModalData {
  date: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  editEvent?: CalendarEvent;
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

const TODAY = '2026-03-21';
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

function eventDuration(e: CalendarEvent): number {
  return (e.endHour * 60 + e.endMin) - (e.startHour * 60 + e.startMin);
}

function yToMinutes(y: number, hh: number): number {
  const raw = (y / hh) * 60;
  return Math.max(0, Math.min(23 * 60 + 45, Math.round(raw / 15) * 15));
}

// --- Mock Events ---

function generateMockEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  let id = 1;

  const weekStarts = [
    new Date(2026, 2, 9),
    new Date(2026, 2, 16),
    new Date(2026, 2, 23),
  ];

  const recurring: Array<{
    title: string; sphere: Sphere; dayOfWeek: number;
    startHour: number; startMin: number; endHour: number; endMin: number;
    description?: string;
  }> = [
    { title: 'Матанализ (лекция)', sphere: 'study', dayOfWeek: 0, startHour: 10, startMin: 0, endHour: 11, endMin: 30, description: 'Интегралы' },
    { title: 'Зал (грудь + трицепс)', sphere: 'health', dayOfWeek: 0, startHour: 18, startMin: 0, endHour: 19, endMin: 0 },
    { title: 'Физика (лекция)', sphere: 'study', dayOfWeek: 1, startHour: 14, startMin: 0, endHour: 15, endMin: 30, description: 'Термодинамика' },
    { title: 'Урок Миша (ЕГЭ Информатика)', sphere: 'teaching', dayOfWeek: 1, startHour: 17, startMin: 0, endHour: 18, endMin: 0, description: 'Подготовка к ЕГЭ' },
    { title: 'Матанализ (семинар)', sphere: 'study', dayOfWeek: 2, startHour: 12, startMin: 0, endHour: 13, endMin: 30, description: 'Задачи' },
    { title: 'Урок Аня (Python)', sphere: 'teaching', dayOfWeek: 2, startHour: 15, startMin: 0, endHour: 16, endMin: 0, description: 'Основы Python' },
    { title: 'Физика (лаб.)', sphere: 'study', dayOfWeek: 3, startHour: 16, startMin: 0, endHour: 17, endMin: 30, description: 'Лабораторная работа' },
    { title: 'Зал (спина + бицепс)', sphere: 'health', dayOfWeek: 3, startHour: 18, startMin: 0, endHour: 19, endMin: 0 },
    { title: 'Информатика (лекция)', sphere: 'study', dayOfWeek: 4, startHour: 10, startMin: 0, endHour: 11, endMin: 30, description: 'Графы и деревья' },
    { title: 'Бег 5км', sphere: 'health', dayOfWeek: 5, startHour: 9, startMin: 0, endHour: 9, endMin: 45 },
    { title: 'Урок Миша (ЕГЭ Информатика)', sphere: 'teaching', dayOfWeek: 5, startHour: 11, startMin: 0, endHour: 12, endMin: 0, description: 'Рекурсия' },
  ];

  for (const ws of weekStarts) {
    for (const r of recurring) {
      const date = addDays(ws, r.dayOfWeek);
      events.push({
        id: `ev${id++}`,
        title: r.title,
        sphere: r.sphere,
        date: dateToStr(date),
        startHour: r.startHour,
        startMin: r.startMin,
        endHour: r.endHour,
        endMin: r.endMin,
        description: r.description,
      });
    }
  }

  const oneOffs: Array<Omit<CalendarEvent, 'id'>> = [
    { title: 'Работа над LI Group', sphere: 'dev', date: '2026-03-18', startHour: 20, startMin: 0, endHour: 22, endMin: 0, description: 'Интеграция CRM API' },
    { title: 'Оплата VPS', sphere: 'finance', date: '2026-03-20', startHour: 0, startMin: 0, endHour: 0, endMin: 0, allDay: true },
    { title: 'Mark2 разработка', sphere: 'dev', date: '2026-03-20', startHour: 19, startMin: 0, endHour: 21, endMin: 0, description: 'Calendar view' },
    { title: 'Встреча с друзьями', sphere: 'personal', date: '2026-03-21', startHour: 16, startMin: 0, endHour: 18, endMin: 0 },
    { title: 'Стрижка', sphere: 'personal', date: '2026-03-22', startHour: 12, startMin: 0, endHour: 13, endMin: 0 },
    { title: 'Дедлайн курсовая', sphere: 'study', date: '2026-03-23', startHour: 0, startMin: 0, endHour: 0, endMin: 0, allDay: true },
    { title: 'Созвон с заказчиком', sphere: 'dev', date: '2026-03-25', startHour: 10, startMin: 0, endHour: 10, endMin: 30, description: 'Обсуждение ТЗ' },
    { title: 'Mark2 разработка', sphere: 'dev', date: '2026-03-27', startHour: 19, startMin: 0, endHour: 21, endMin: 0, description: 'Agent system' },
    { title: 'Оплата за обучение', sphere: 'finance', date: '2026-03-10', startHour: 0, startMin: 0, endHour: 0, endMin: 0, allDay: true },
    { title: 'Работа над LI Group', sphere: 'dev', date: '2026-03-11', startHour: 20, startMin: 0, endHour: 22, endMin: 0, description: 'Frontend рефакторинг' },
  ];

  for (const o of oneOffs) {
    events.push({ ...o, id: `ev${id++}` });
  }

  return events;
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
  const [events, setEvents] = useState<CalendarEvent[]>(generateMockEvents);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [createModal, setCreateModal] = useState<CreateModalData | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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

  // Persist zoom
  useEffect(() => {
    localStorage.setItem(ZOOM_LS_KEY, String(hourHeight));
  }, [hourHeight]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const monthGrid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const getEventsForDate = useCallback((date: string) => {
    return events.filter((e) => e.date === date);
  }, [events]);

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
    setEvents((prev) => [...prev, event]);
    setCreateModal(null);
  }, []);

  const updateEvent = useCallback((updated: CalendarEvent) => {
    setEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e));
    setCreateModal(null);
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setSelectedEvent(null);
  }, []);

  const moveEvent = useCallback((id: string, updates: { date: string; startHour: number; startMin: number; endHour: number; endMin: number }) => {
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, ...updates } : e));
  }, []);

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
      <div className="flex flex-1 overflow-hidden" ref={bodyRef}>
        <div className="flex-1 overflow-hidden">
          {view === 'week' && (
            <WeekView
              weekDates={weekDates}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              eventsForDate={getEventsForDate}
              now={now}
              hourHeight={hourHeight}
              onEventClick={setSelectedEvent}
              onCreateEvent={setCreateModal}
              onContextMenu={setContextMenu}
              onMoveEvent={moveEvent}
              onZoom={handleZoom}
            />
          )}
          {view === 'month' && (
            <MonthView
              grid={monthGrid}
              selectedDate={selectedDate}
              onSelectDate={(d) => { handleSelectDate(d); setView('day'); }}
              eventsForDate={getEventsForDate}
            />
          )}
          {view === 'day' && (
            <DayView
              date={selectedDate}
              eventsForDate={getEventsForDate}
              now={now}
              hourHeight={hourHeight}
              onEventClick={setSelectedEvent}
              onCreateEvent={setCreateModal}
              onContextMenu={setContextMenu}
              onMoveEvent={moveEvent}
              onZoom={handleZoom}
            />
          )}
          {view === 'list' && (
            <ListView
              selectedDate={selectedDate}
              eventsForDate={getEventsForDate}
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
          onNewReminder={() => {
            setCreateModal({
              date: contextMenu.date,
              startHour: contextMenu.hour,
              startMin: contextMenu.min,
              endHour: contextMenu.hour,
              endMin: contextMenu.min + 30,
            });
            setContextMenu(null);
          }}
        />
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
  now,
  hourHeight,
  onEventClick,
  onCreateEvent,
  onContextMenu,
  onMoveEvent,
  onZoom,
}: {
  weekDates: string[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
  eventsForDate: (date: string) => CalendarEvent[];
  now: Date;
  hourHeight: number;
  onEventClick: (ev: CalendarEvent) => void;
  onCreateEvent: (data: CreateModalData) => void;
  onContextMenu: (data: ContextMenuState) => void;
  onMoveEvent: (id: string, updates: { date: string; startHour: number; startMin: number; endHour: number; endMin: number }) => void;
  onZoom: (delta: number) => void;
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
  const hasAllDay = allDayEvents.some((evs) => evs.length > 0);

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
                  {evs.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border-l-2 cursor-pointer hover:brightness-125 transition-all
                        ${SPHERE_META[ev.sphere].bg} ${SPHERE_META[ev.sphere].border} ${SPHERE_META[ev.sphere].color} truncate`}
                    >
                      {ev.title}
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
                  return (
                    <div
                      key={pe.event.id}
                      className={`absolute rounded border-l-2 px-1.5 py-0.5 overflow-hidden cursor-grab
                        hover:brightness-125 transition-opacity select-none
                        ${SPHERE_META[pe.event.sphere].bg} ${SPHERE_META[pe.event.sphere].border}`}
                      style={{
                        top: pe.top,
                        height: Math.max(pe.height, 20),
                        left: `${pe.left}%`,
                        width: `${pe.width}%`,
                        zIndex: 2,
                        opacity: isDragging ? 0.3 : 1,
                      }}
                      onMouseDown={(e) => handleEventMouseDown(e, pe.event)}
                    >
                      <div className={`text-[10px] font-medium truncate ${SPHERE_META[pe.event.sphere].color}`}>
                        {pe.event.isReminder && '\uD83D\uDD14 '}{pe.event.title}
                      </div>
                      {pe.height > 30 && (
                        <div className="text-[9px] text-neutral-500">
                          {fmtTime(pe.event.startHour, pe.event.startMin)} &ndash; {fmtTime(pe.event.endHour, pe.event.endMin)}
                        </div>
                      )}
                      {/* Resize handle */}
                      <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize" />
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
}: {
  grid: string[][];
  selectedDate: string;
  onSelectDate: (d: string) => void;
  eventsForDate: (date: string) => CalendarEvent[];
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
          const shown = dayEvents.slice(0, 3);
          const more = dayEvents.length - 3;

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={`min-h-[100px] p-1.5 text-left border-t border-l border-neutral-800/50 first:border-l-0 transition-colors
                ${isToday ? 'bg-blue-500/5' : 'hover:bg-neutral-900/50'}`}
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
                {shown.map((ev) => (
                  <div
                    key={ev.id}
                    className={`text-[9px] px-1 py-0.5 rounded truncate border-l-2
                      ${SPHERE_META[ev.sphere].bg} ${SPHERE_META[ev.sphere].border} ${SPHERE_META[ev.sphere].color}`}
                  >
                    {ev.allDay ? ev.title : `${fmtTime(ev.startHour, ev.startMin)} ${ev.title}`}
                  </div>
                ))}
                {more > 0 && (
                  <div className="text-[9px] text-neutral-600 pl-1">+{more} ещё</div>
                )}
              </div>
            </button>
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
  now,
  hourHeight,
  onEventClick,
  onCreateEvent,
  onContextMenu,
  onMoveEvent,
  onZoom,
}: {
  date: string;
  eventsForDate: (date: string) => CalendarEvent[];
  now: Date;
  hourHeight: number;
  onEventClick: (ev: CalendarEvent) => void;
  onCreateEvent: (data: CreateModalData) => void;
  onContextMenu: (data: ContextMenuState) => void;
  onMoveEvent: (id: string, updates: { date: string; startHour: number; startMin: number; endHour: number; endMin: number }) => void;
  onZoom: (delta: number) => void;
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

      {/* All-day */}
      {allDay.length > 0 && (
        <div className="shrink-0 px-6 py-2 border-b border-neutral-800 flex gap-2">
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
              return (
                <div
                  key={pe.event.id}
                  className={`absolute rounded border-l-2 px-3 py-1.5 overflow-hidden cursor-grab
                    hover:brightness-125 transition-opacity select-none
                    ${SPHERE_META[pe.event.sphere].bg} ${SPHERE_META[pe.event.sphere].border}`}
                  style={{
                    top: pe.top,
                    height: Math.max(pe.height, 28),
                    left: `${pe.left}%`,
                    width: `${pe.width}%`,
                    zIndex: 2,
                    opacity: isDragging ? 0.3 : 1,
                  }}
                  onMouseDown={(e) => handleEventMouseDown(e, pe.event)}
                >
                  <div className={`text-xs font-medium ${SPHERE_META[pe.event.sphere].color}`}>
                    {pe.event.isReminder && '\uD83D\uDD14 '}{pe.event.title}
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    {fmtTime(pe.event.startHour, pe.event.startMin)} &ndash; {fmtTime(pe.event.endHour, pe.event.endMin)}
                  </div>
                  {pe.event.description && pe.height > 50 && (
                    <div className="text-[10px] text-neutral-600 mt-0.5 truncate">{pe.event.description}</div>
                  )}
                  {/* Resize handle */}
                  <div className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize" />
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
  onEventClick,
}: {
  selectedDate: string;
  eventsForDate: (date: string) => CalendarEvent[];
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
          const isToday = date === TODAY;
          if (events.length === 0) {
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
                        <div className={`text-sm ${SPHERE_META[ev.sphere].color}`}>
                          {ev.isReminder && '\uD83D\uDD14 '}{ev.title}
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
}: {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  viewYear: number;
  viewMonth: number;
  eventsForDate: (date: string) => CalendarEvent[];
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
                  <div className={`text-[11px] truncate ${SPHERE_META[ev.sphere].color}`}>
                    {ev.isReminder && '\uD83D\uDD14 '}{ev.title}
                  </div>
                  <div className="text-[10px] text-neutral-600">
                    {ev.allDay ? 'Весь день' : `${fmtTime(ev.startHour, ev.startMin)} – ${fmtTime(ev.endHour, ev.endMin)}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
}: {
  event: CalendarEvent;
  onClose: () => void;
  onDelete: (id: string) => void;
  onEdit: (ev: CalendarEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-neutral-900 border border-neutral-700 rounded-xl p-5 w-96 max-w-[90vw] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2.5 h-2.5 rounded-full ${SPHERE_META[event.sphere].dot}`} />
          <span className={`text-xs ${SPHERE_META[event.sphere].color}`}>{SPHERE_META[event.sphere].label}</span>
        </div>

        <h3 className="text-lg font-bold text-neutral-100 mb-2">
          {event.isReminder && '\uD83D\uDD14 '}{event.title}
        </h3>

        <div className="flex items-center gap-2 text-sm text-neutral-400 mb-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>
            {fmtDateShort(event.date)} &middot;{' '}
            {event.allDay ? 'Весь день' : `${fmtTime(event.startHour, event.startMin)} – ${fmtTime(event.endHour, event.endMin)}`}
          </span>
        </div>

        {event.description && (
          <p className="text-sm text-neutral-400 mb-4 leading-relaxed">{event.description}</p>
        )}

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
  const [isReminder, setIsReminder] = useState(data.editEvent?.isReminder ?? false);

  const handleSubmit = () => {
    if (!title.trim()) return;
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
      isReminder,
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
          <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isReminder}
              onChange={(e) => setIsReminder(e.target.checked)}
              className="rounded border-neutral-600 bg-neutral-800"
            />
            Напоминание
          </label>
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
  onNewReminder,
}: {
  x: number;
  y: number;
  onNewEvent: () => void;
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
        onClick={onNewReminder}
        className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors flex items-center gap-2"
      >
        <span className="text-base leading-none">{'\uD83D\uDD14'}</span>
        Новое напоминание
      </button>
    </div>
  );
}
