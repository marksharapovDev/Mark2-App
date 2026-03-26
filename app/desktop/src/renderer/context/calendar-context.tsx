import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

const TODAY = new Date().toLocaleDateString('sv-SE');

interface CalendarContextValue {
  calendarOpen: boolean;
  toggleCalendar: () => void;
  closeCalendar: () => void;
  openCalendar: () => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

const LS_KEY = 'mark2-calendar-open';

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [calendarOpen, setCalendarOpen] = useState(() => {
    return localStorage.getItem(LS_KEY) === 'true';
  });
  const [selectedDate, setSelectedDate] = useState(TODAY);

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
    <CalendarContext.Provider value={{ calendarOpen, toggleCalendar, closeCalendar, openCalendar, selectedDate, setSelectedDate }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be used within CalendarProvider');
  return ctx;
}
