import { useState, useMemo, useCallback, useRef } from 'react';

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

const DAY_NAMES_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 08:00 - 21:00
const VIEW_TABS: Array<{ id: ViewMode; label: string }> = [
  { id: 'month', label: 'Месяц' },
  { id: 'week', label: 'Неделя' },
  { id: 'day', label: 'День' },
  { id: 'list', label: 'Список' },
];

const TODAY = '2026-03-21';
const NOW_HOUR = 14;
const NOW_MIN = 35;

// --- Mock Events ---

function weekDate(dayIndex: number): string {
  // Week of March 16-22, 2026 (Mon-Sun). dayIndex: 0=Mon..6=Sun
  const base = 16;
  const d = base + dayIndex;
  return `2026-03-${String(d).padStart(2, '0')}`;
}

const MOCK_EVENTS: CalendarEvent[] = [
  // Teaching
  { id: 'ev1',  title: 'Урок Миша (ЕГЭ Информатика)',  sphere: 'teaching', date: weekDate(1), startHour: 17, startMin: 0, endHour: 18, endMin: 0, description: 'Системы счисления — повторение' },
  { id: 'ev2',  title: 'Урок Аня (Python)',              sphere: 'teaching', date: weekDate(2), startHour: 15, startMin: 0, endHour: 16, endMin: 0, description: 'Циклы while и for' },
  { id: 'ev3',  title: 'Урок Миша (ЕГЭ Информатика)',   sphere: 'teaching', date: weekDate(5), startHour: 11, startMin: 0, endHour: 12, endMin: 0, description: 'Рекурсия — базовые понятия' },
  // Study
  { id: 'ev4',  title: 'Матанализ (лекция)',    sphere: 'study', date: weekDate(0), startHour: 10, startMin: 0, endHour: 11, endMin: 30, description: 'Интегралы — продолжение' },
  { id: 'ev5',  title: 'Физика (лекция)',       sphere: 'study', date: weekDate(1), startHour: 14, startMin: 0, endHour: 15, endMin: 30, description: 'Термодинамика' },
  { id: 'ev6',  title: 'Матанализ (семинар)',   sphere: 'study', date: weekDate(2), startHour: 12, startMin: 0, endHour: 13, endMin: 30, description: 'Задачи на производные' },
  { id: 'ev7',  title: 'Физика (лаб.)',         sphere: 'study', date: weekDate(3), startHour: 16, startMin: 0, endHour: 17, endMin: 30, description: 'Теплоёмкость — лабораторная' },
  { id: 'ev8',  title: 'Информатика (лекция)',  sphere: 'study', date: weekDate(4), startHour: 10, startMin: 0, endHour: 11, endMin: 30, description: 'Графы и деревья' },
  // Health
  { id: 'ev9',  title: 'Зал (грудь + трицепс)',  sphere: 'health', date: weekDate(0), startHour: 18, startMin: 0, endHour: 19, endMin: 0 },
  { id: 'ev10', title: 'Зал (спина + бицепс)',   sphere: 'health', date: weekDate(3), startHour: 18, startMin: 0, endHour: 19, endMin: 0 },
  { id: 'ev11', title: 'Бег 5км',                sphere: 'health', date: weekDate(5), startHour: 9,  startMin: 0, endHour: 9,  endMin: 45 },
  // Dev
  { id: 'ev12', title: 'Работа над LI Group',   sphere: 'dev', date: weekDate(2), startHour: 20, startMin: 0, endHour: 22, endMin: 0, description: 'Интеграция CRM API' },
  { id: 'ev13', title: 'Mark2 разработка',       sphere: 'dev', date: weekDate(4), startHour: 19, startMin: 0, endHour: 21, endMin: 0, description: 'Calendar view + Claude Bridge streaming' },
  // Finance
  { id: 'ev14', title: 'Оплата VPS',            sphere: 'finance', date: weekDate(4), startHour: 0, startMin: 0, endHour: 0, endMin: 0, allDay: true },
  // Personal
  { id: 'ev15', title: 'Встреча с друзьями',     sphere: 'personal', date: weekDate(5), startHour: 16, startMin: 0, endHour: 18, endMin: 0 },
  { id: 'ev16', title: 'Стрижка',               sphere: 'personal', date: weekDate(6), startHour: 12, startMin: 0, endHour: 13, endMin: 0 },
];

// --- Utilities ---

function pad2(n: number): string { return String(n).padStart(2, '0'); }

function fmtTime(h: number, m: number): string { return `${pad2(h)}:${pad2(m)}`; }

function fmtDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10)]}`;
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
  const firstDay = first.getDay() === 0 ? 6 : first.getDay() - 1; // Monday-indexed
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

function eventsForDate(date: string): CalendarEvent[] {
  return MOCK_EVENTS.filter((e) => e.date === date);
}

function eventDuration(e: CalendarEvent): number {
  return (e.endHour * 60 + e.endMin) - (e.startHour * 60 + e.startMin);
}

// --- Component ---

export function Calendar() {
  const [view, setView] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(2); // 0-indexed, March = 2

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const monthGrid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const navigateMonth = useCallback((dir: -1 | 1) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
    setSelectedDate(`${y}-${pad2(m + 1)}-15`);
  }, [viewMonth, viewYear]);

  const todayDate = new Date(TODAY);
  const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const greeting = todayDate.getHours?.() < 12 ? 'Доброе утро' : 'Добрый день';

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {/* === CALENDAR HEADER === */}
      <div className="shrink-0 border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold text-neutral-200">{greeting}, Марк!</h1>
            <p className="text-xs text-neutral-500">Вот что у тебя сегодня &middot; {dayNames[todayDate.getDay()]}, {fmtDateShort(TODAY)}</p>
          </div>
          <button className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-lg text-sm text-blue-300 hover:bg-blue-600/30 transition-colors">
            + Событие
          </button>
        </div>

        <div className="flex items-center justify-between">
          {/* Month nav */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateMonth(-1)}
              className="text-neutral-500 hover:text-neutral-200 transition-colors text-sm px-1"
            >
              &larr;
            </button>
            <span className="text-sm font-semibold text-neutral-200 w-36 text-center">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="text-neutral-500 hover:text-neutral-200 transition-colors text-sm px-1"
            >
              &rarr;
            </button>
            <button
              onClick={() => { setSelectedDate(TODAY); setViewYear(2026); setViewMonth(2); }}
              className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors ml-2 px-2 py-0.5 rounded border border-neutral-800 hover:border-neutral-700"
            >
              Сегодня
            </button>
          </div>

          {/* View tabs */}
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
      <div className="flex flex-1 overflow-hidden">
        {/* MAIN */}
        <div className="flex-1 overflow-auto">
          {view === 'week' && (
            <WeekView
              weekDates={weekDates}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          )}
          {view === 'month' && (
            <MonthView
              grid={monthGrid}
              selectedDate={selectedDate}
              onSelectDate={(d) => { setSelectedDate(d); setView('day'); }}
            />
          )}
          {view === 'day' && (
            <DayView date={selectedDate} />
          )}
          {view === 'list' && (
            <ListView selectedDate={selectedDate} />
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <CalendarSidebar
          selectedDate={selectedDate}
          onSelectDate={(d) => { setSelectedDate(d); if (view === 'month') setView('day'); }}
          viewYear={viewYear}
          viewMonth={viewMonth}
        />
      </div>
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
}: {
  weekDates: string[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);

  // Collect events per day
  const dayEvents = weekDates.map((d) => eventsForDate(d));
  const allDayEvents = weekDates.map((d) => eventsForDate(d).filter((e) => e.allDay));
  const timedEvents = weekDates.map((d) => eventsForDate(d).filter((e) => !e.allDay));

  const hourHeight = 56; // px per hour
  const startHour = 8;
  const endHour = 22;

  // Current time marker position
  const todayCol = weekDates.indexOf(TODAY);
  const nowTop = (NOW_HOUR - startHour) * hourHeight + (NOW_MIN / 60) * hourHeight;

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="shrink-0 grid grid-cols-[56px_repeat(7,1fr)] border-b border-neutral-800">
        <div /> {/* time gutter */}
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
      {allDayEvents.some((evs) => evs.length > 0) && (
        <div className="shrink-0 grid grid-cols-[56px_repeat(7,1fr)] border-b border-neutral-800">
          <div className="text-[10px] text-neutral-600 py-1 text-right pr-2">весь день</div>
          {allDayEvents.map((evs, i) => (
            <div key={i} className="border-l border-neutral-800/50 px-0.5 py-0.5">
              {evs.map((ev) => (
                <div
                  key={ev.id}
                  className={`text-[10px] px-1.5 py-0.5 rounded border-l-2 ${SPHERE_META[ev.sphere].bg} ${SPHERE_META[ev.sphere].border} ${SPHERE_META[ev.sphere].color} truncate`}
                >
                  {ev.title}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-auto" ref={gridRef}>
        <div
          className="grid grid-cols-[56px_repeat(7,1fr)] relative"
          style={{ minHeight: (endHour - startHour) * hourHeight }}
        >
          {/* Hour labels + lines */}
          {HOURS.map((h) => (
            <div
              key={h}
              className="col-start-1 text-[10px] text-neutral-600 text-right pr-2 relative"
              style={{
                gridRow: 'auto',
                position: 'absolute',
                top: (h - startHour) * hourHeight - 6,
                left: 0,
                width: 56,
              }}
            >
              {fmtTime(h, 0)}
            </div>
          ))}

          {/* Horizontal hour lines */}
          {HOURS.map((h) => (
            <div
              key={`line-${h}`}
              className="absolute left-14 right-0 border-t border-neutral-800/50"
              style={{ top: (h - startHour) * hourHeight }}
            />
          ))}

          {/* Day columns with events */}
          {timedEvents.map((evs, dayIdx) => {
            const isToday = weekDates[dayIdx] === TODAY;
            // Calculate overlapping groups
            const positioned = positionEvents(evs, startHour, hourHeight);

            return (
              <div
                key={dayIdx}
                className={`relative border-l border-neutral-800/50 ${isToday ? 'bg-blue-500/[0.03]' : ''}`}
                style={{
                  gridColumn: dayIdx + 2,
                  gridRow: '1 / -1',
                  minHeight: (endHour - startHour) * hourHeight,
                }}
              >
                {positioned.map((pe) => (
                  <div
                    key={pe.event.id}
                    className={`absolute rounded border-l-2 px-1.5 py-0.5 overflow-hidden cursor-pointer
                      hover:brightness-125 transition-all
                      ${SPHERE_META[pe.event.sphere].bg} ${SPHERE_META[pe.event.sphere].border}`}
                    style={{
                      top: pe.top,
                      height: Math.max(pe.height, 20),
                      left: `${pe.left}%`,
                      width: `${pe.width}%`,
                    }}
                    title={`${pe.event.title}\n${fmtTime(pe.event.startHour, pe.event.startMin)} - ${fmtTime(pe.event.endHour, pe.event.endMin)}`}
                  >
                    <div className={`text-[10px] font-medium truncate ${SPHERE_META[pe.event.sphere].color}`}>
                      {pe.event.title}
                    </div>
                    {pe.height > 30 && (
                      <div className="text-[9px] text-neutral-500">
                        {fmtTime(pe.event.startHour, pe.event.startMin)} &ndash; {fmtTime(pe.event.endHour, pe.event.endMin)}
                      </div>
                    )}
                  </div>
                ))}
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
    </div>
  );
}

// Overlapping event positioning
interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  left: number;  // percent
  width: number; // percent
}

function positionEvents(events: CalendarEvent[], startHour: number, hourHeight: number): PositionedEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => {
    const aStart = a.startHour * 60 + a.startMin;
    const bStart = b.startHour * 60 + b.startMin;
    return aStart - bStart || eventDuration(b) - eventDuration(a);
  });

  // Group overlapping events
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
  const pad = 2; // percent padding

  for (const group of groups) {
    const cols = group.length;
    group.forEach((ev, colIdx) => {
      const top = ((ev.startHour * 60 + ev.startMin) - startHour * 60) / 60 * hourHeight;
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
// MONTH VIEW
// ============================================================

function MonthView({
  grid,
  selectedDate,
  onSelectDate,
}: {
  grid: string[][];
  selectedDate: string;
  onSelectDate: (d: string) => void;
}) {
  return (
    <div className="p-4">
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="text-center text-[10px] text-neutral-600 uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
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

function DayView({ date }: { date: string }) {
  const events = eventsForDate(date);
  const allDay = events.filter((e) => e.allDay);
  const timed = events.filter((e) => !e.allDay).sort((a, b) => (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin));
  const isToday = date === TODAY;

  const hourHeight = 64;
  const startHour = 8;

  return (
    <div className="flex flex-col h-full">
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
              className={`text-xs px-2 py-1 rounded border-l-2 ${SPHERE_META[ev.sphere].bg} ${SPHERE_META[ev.sphere].border} ${SPHERE_META[ev.sphere].color}`}
            >
              {ev.title}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-auto">
        <div className="relative" style={{ minHeight: HOURS.length * hourHeight }}>
          {/* Hour lines */}
          {HOURS.map((h) => (
            <div key={h} className="absolute left-0 right-0 flex" style={{ top: (h - startHour) * hourHeight }}>
              <div className="w-14 text-[10px] text-neutral-600 text-right pr-2 -translate-y-1.5">
                {fmtTime(h, 0)}
              </div>
              <div className="flex-1 border-t border-neutral-800/50" />
            </div>
          ))}

          {/* Events */}
          <div className="absolute left-14 right-4">
            {timed.map((ev) => {
              const top = ((ev.startHour * 60 + ev.startMin) - startHour * 60) / 60 * hourHeight;
              const height = Math.max(eventDuration(ev) / 60 * hourHeight, 28);
              return (
                <div
                  key={ev.id}
                  className={`absolute left-0 right-0 rounded border-l-2 px-3 py-1.5 overflow-hidden
                    ${SPHERE_META[ev.sphere].bg} ${SPHERE_META[ev.sphere].border}`}
                  style={{ top, height }}
                >
                  <div className={`text-xs font-medium ${SPHERE_META[ev.sphere].color}`}>{ev.title}</div>
                  <div className="text-[10px] text-neutral-500">
                    {fmtTime(ev.startHour, ev.startMin)} &ndash; {fmtTime(ev.endHour, ev.endMin)}
                  </div>
                  {ev.description && height > 50 && (
                    <div className="text-[10px] text-neutral-600 mt-0.5 truncate">{ev.description}</div>
                  )}
                </div>
              );
            })}

            {/* Current time line */}
            {isToday && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{ top: ((NOW_HOUR * 60 + NOW_MIN) - startHour * 60) / 60 * hourHeight }}
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
    </div>
  );
}

// ============================================================
// LIST VIEW
// ============================================================

function ListView({ selectedDate }: { selectedDate: string }) {
  const start = getMonday(selectedDate);
  const days = Array.from({ length: 7 }, (_, i) => dateToStr(addDays(start, i)));

  return (
    <div className="p-6 max-w-2xl">
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
                      className={`flex items-center gap-3 px-3 py-2 rounded border-l-2
                        ${SPHERE_META[ev.sphere].bg} ${SPHERE_META[ev.sphere].border}`}
                    >
                      <span className="text-xs text-neutral-500 w-24 shrink-0">
                        {ev.allDay ? 'Весь день' : `${fmtTime(ev.startHour, ev.startMin)} – ${fmtTime(ev.endHour, ev.endMin)}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${SPHERE_META[ev.sphere].color}`}>{ev.title}</div>
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
}: {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  viewYear: number;
  viewMonth: number;
}) {
  const miniGrid = getMonthGrid(viewYear, viewMonth);
  const dayEvents = eventsForDate(selectedDate).sort((a, b) =>
    (a.allDay ? -1 : b.allDay ? 1 : (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin))
  );

  // Free time slots
  const timed = dayEvents.filter((e) => !e.allDay).sort((a, b) => (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin));
  const freeSlots: Array<{ start: string; end: string }> = [];
  let cursor = 8 * 60; // 08:00
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
                      ? 'bg-neutral-700 text-white'
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
          Расписание &middot; {fmtDateShort(selectedDate)}
        </div>
        {dayEvents.length === 0 ? (
          <div className="text-[11px] text-neutral-700">Нет событий</div>
        ) : (
          <div className="space-y-1">
            {dayEvents.map((ev) => (
              <div key={ev.id} className={`flex gap-2 py-1 border-l-2 pl-2 rounded-r ${SPHERE_META[ev.sphere].border}`}>
                <div className="flex-1 min-w-0">
                  <div className={`text-[11px] truncate ${SPHERE_META[ev.sphere].color}`}>{ev.title}</div>
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
          {(Object.keys(SPHERE_META) as Sphere[]).map((sphere) => (
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
