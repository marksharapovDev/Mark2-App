import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCalendar } from '../../context/calendar-context';

// --- Types ---

type Sphere = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'personal';

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
}

// --- Constants (shared with Calendar.tsx — later extract to shared module) ---

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

const TODAY = '2026-03-21';

// --- Mock Events (same as Calendar.tsx) ---

function weekDate(dayIndex: number): string {
  const base = 16;
  const d = base + dayIndex;
  return `2026-03-${String(d).padStart(2, '0')}`;
}

const MOCK_EVENTS: CalendarEvent[] = [
  { id: 'ev1',  title: 'Урок Миша (ЕГЭ Информатика)',  sphere: 'teaching', date: weekDate(1), startHour: 17, startMin: 0, endHour: 18, endMin: 0, description: 'Системы счисления — повторение' },
  { id: 'ev2',  title: 'Урок Аня (Python)',              sphere: 'teaching', date: weekDate(2), startHour: 15, startMin: 0, endHour: 16, endMin: 0, description: 'Циклы while и for' },
  { id: 'ev3',  title: 'Урок Миша (ЕГЭ Информатика)',   sphere: 'teaching', date: weekDate(5), startHour: 11, startMin: 0, endHour: 12, endMin: 0, description: 'Рекурсия — базовые понятия' },
  { id: 'ev4',  title: 'Матанализ (лекция)',    sphere: 'study', date: weekDate(0), startHour: 10, startMin: 0, endHour: 11, endMin: 30, description: 'Интегралы — продолжение' },
  { id: 'ev5',  title: 'Физика (лекция)',       sphere: 'study', date: weekDate(1), startHour: 14, startMin: 0, endHour: 15, endMin: 30, description: 'Термодинамика' },
  { id: 'ev6',  title: 'Матанализ (семинар)',   sphere: 'study', date: weekDate(2), startHour: 12, startMin: 0, endHour: 13, endMin: 30, description: 'Задачи на производные' },
  { id: 'ev7',  title: 'Физика (лаб.)',         sphere: 'study', date: weekDate(3), startHour: 16, startMin: 0, endHour: 17, endMin: 30, description: 'Теплоёмкость — лабораторная' },
  { id: 'ev8',  title: 'Информатика (лекция)',  sphere: 'study', date: weekDate(4), startHour: 10, startMin: 0, endHour: 11, endMin: 30, description: 'Графы и деревья' },
  { id: 'ev9',  title: 'Зал (грудь + трицепс)',  sphere: 'health', date: weekDate(0), startHour: 18, startMin: 0, endHour: 19, endMin: 0 },
  { id: 'ev10', title: 'Зал (спина + бицепс)',   sphere: 'health', date: weekDate(3), startHour: 18, startMin: 0, endHour: 19, endMin: 0 },
  { id: 'ev11', title: 'Бег 5км',                sphere: 'health', date: weekDate(5), startHour: 9,  startMin: 0, endHour: 9,  endMin: 45 },
  { id: 'ev12', title: 'Работа над LI Group',   sphere: 'dev', date: weekDate(2), startHour: 20, startMin: 0, endHour: 22, endMin: 0, description: 'Интеграция CRM API' },
  { id: 'ev13', title: 'Mark2 разработка',       sphere: 'dev', date: weekDate(4), startHour: 19, startMin: 0, endHour: 21, endMin: 0, description: 'Calendar view + Claude Bridge streaming' },
  { id: 'ev14', title: 'Оплата VPS',            sphere: 'finance', date: weekDate(4), startHour: 0, startMin: 0, endHour: 0, endMin: 0, allDay: true },
  { id: 'ev15', title: 'Встреча с друзьями',     sphere: 'personal', date: weekDate(5), startHour: 16, startMin: 0, endHour: 18, endMin: 0 },
  { id: 'ev16', title: 'Стрижка',               sphere: 'personal', date: weekDate(6), startHour: 12, startMin: 0, endHour: 13, endMin: 0 },
];

// --- Utilities ---

function pad2(n: number): string { return String(n).padStart(2, '0'); }
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

function eventsForDate(date: string): CalendarEvent[] {
  return MOCK_EVENTS.filter((e) => e.date === date);
}

function getUpcomingEvents(fromDate: string, count: number): CalendarEvent[] {
  return MOCK_EVENTS
    .filter((e) => e.date >= fromDate)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin);
    })
    .slice(0, count);
}

function fmtDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  const months = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${parseInt(day ?? '0', 10)} ${months[parseInt(month ?? '0', 10)]}`;
}

// --- Component ---

export function CalendarPanel() {
  const { closeCalendar } = useCalendar();
  const navigate = useNavigate();

  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(2); // March = 2 (0-indexed)

  const monthGrid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const todayEvents = useMemo(() => eventsForDate(TODAY).sort((a, b) =>
    (a.allDay ? -1 : b.allDay ? 1 : (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin))
  ), []);
  const upcomingEvents = useMemo(() => getUpcomingEvents(TODAY, 3), []);

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

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-neutral-800 shrink-0">
        <span className="flex-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Календарь</span>

        {/* Pop-out */}
        <button onClick={handlePopout} className="text-neutral-600 hover:text-neutral-400 transition-colors" title="Плавающее окно">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </button>

        {/* Fullscreen */}
        <button onClick={handleFullscreen} className="text-neutral-600 hover:text-neutral-400 transition-colors" title="Полный экран">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        </button>

        {/* Close */}
        <button onClick={closeCalendar} className="text-neutral-600 hover:text-neutral-400 transition-colors" title="Закрыть">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Mini month calendar */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => navigateMonth(-1)} className="text-neutral-500 hover:text-neutral-200 transition-colors text-xs px-1">&larr;</button>
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button onClick={() => navigateMonth(1)} className="text-neutral-500 hover:text-neutral-200 transition-colors text-xs px-1">&rarr;</button>
          </div>

          <div className="grid grid-cols-7 gap-0">
            {DAY_NAMES_SHORT.map((d) => (
              <div key={d} className="text-[9px] text-neutral-600 text-center py-0.5">{d[0]}</div>
            ))}
            {monthGrid.flat().map((date, idx) => {
              if (!date) return <div key={idx} />;
              const d = new Date(date);
              const isToday = date === TODAY;
              const hasEvents = eventsForDate(date).length > 0;
              return (
                <div
                  key={date}
                  className={`text-[10px] py-0.5 text-center rounded-full relative ${
                    isToday
                      ? 'bg-blue-500/30 text-blue-300 font-bold'
                      : 'text-neutral-400'
                  }`}
                >
                  {d.getDate()}
                  {hasEvents && !isToday && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-0.5 rounded-full bg-blue-400" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mx-3 border-t border-neutral-800" />

        {/* Today's events */}
        <div className="p-3">
          <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Сегодня &middot; {fmtDateShort(TODAY)}
          </div>
          {todayEvents.length === 0 ? (
            <div className="text-[11px] text-neutral-700">Нет событий</div>
          ) : (
            <div className="space-y-1">
              {todayEvents.map((ev) => (
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

        {/* Upcoming events */}
        <div className="p-3">
          <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Ближайшие
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="text-[11px] text-neutral-700">Нет событий</div>
          ) : (
            <div className="space-y-1">
              {upcomingEvents.map((ev) => (
                <div key={ev.id} className={`flex gap-2 py-1 border-l-2 pl-2 rounded-r ${SPHERE_META[ev.sphere].border}`}>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] truncate ${SPHERE_META[ev.sphere].color}`}>{ev.title}</div>
                    <div className="text-[10px] text-neutral-600">
                      {fmtDateShort(ev.date)} &middot; {ev.allDay ? 'Весь день' : fmtTime(ev.startHour, ev.startMin)}
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
