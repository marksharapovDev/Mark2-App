import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
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
  isReminder?: boolean;
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

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

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

const MOCK_EVENTS = generateMockEvents();

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
  const { closeCalendar, selectedDate, setSelectedDate } = useCalendar();
  const navigate = useNavigate();

  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(2); // March = 2 (0-indexed)

  const monthGrid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const selectedDayEvents = useMemo(() => eventsForDate(selectedDate).sort((a, b) =>
    (a.allDay ? -1 : b.allDay ? 1 : (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin))
  ), [selectedDate]);

  const upcomingEvents = useMemo(() => getUpcomingEvents(selectedDate, 3), [selectedDate]);

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
  }, [setSelectedDate]);

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
              const isSelected = date === selectedDate;
              const hasEvents = eventsForDate(date).length > 0;
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
                  {hasEvents && (
                    <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-0.5 rounded-full ${
                      isToday ? 'bg-blue-300' : 'bg-blue-400'
                    }`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-3 border-t border-neutral-800" />

        {/* Selected day's events */}
        <div className="p-3">
          <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            {selectedDate === TODAY ? 'Сегодня' : fmtDateShort(selectedDate)}
          </div>
          {selectedDayEvents.length === 0 ? (
            <div className="text-[11px] text-neutral-700">Нет событий</div>
          ) : (
            <div className="space-y-1">
              {selectedDayEvents.map((ev) => (
                <div key={ev.id} className={`flex gap-2 py-1 border-l-2 pl-2 rounded-r ${SPHERE_META[ev.sphere].border}`}>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] truncate ${SPHERE_META[ev.sphere].color}`}>
                      {ev.isReminder && <><Bell size={11} strokeWidth={1.5} className="inline mr-0.5" /></>}{ev.title}
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
