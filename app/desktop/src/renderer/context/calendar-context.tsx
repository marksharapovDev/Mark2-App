import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface CalendarContextValue {
  calendarOpen: boolean;
  toggleCalendar: () => void;
  closeCalendar: () => void;
  openCalendar: () => void;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

const LS_KEY = 'mark2-calendar-open';

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [calendarOpen, setCalendarOpen] = useState(() => {
    return localStorage.getItem(LS_KEY) === 'true';
  });

  const toggleCalendar = useCallback(() => {
    setCalendarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(LS_KEY, String(next));
      return next;
    });
  }, []);

  const closeCalendar = useCallback(() => {
    setCalendarOpen(false);
    localStorage.setItem(LS_KEY, 'false');
  }, []);

  const openCalendar = useCallback(() => {
    setCalendarOpen(true);
    localStorage.setItem(LS_KEY, 'true');
  }, []);

  return (
    <CalendarContext.Provider value={{ calendarOpen, toggleCalendar, closeCalendar, openCalendar }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider');
  return ctx;
}
