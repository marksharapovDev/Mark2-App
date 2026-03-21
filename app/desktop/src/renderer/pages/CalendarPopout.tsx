import { useCallback } from 'react';
import { Calendar } from './Calendar';

export function CalendarPopout() {
  const handlePopin = useCallback(async () => {
    await window.calendar.popin();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-neutral-100">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-800 bg-neutral-900/50">
        <span className="text-sm font-semibold text-neutral-300">Календарь</span>
        <span className="flex-1" />
        <button onClick={handlePopin} className="text-neutral-500 hover:text-neutral-300 transition-colors" title="Вернуть в основное окно">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <Calendar />
      </div>
    </div>
  );
}
