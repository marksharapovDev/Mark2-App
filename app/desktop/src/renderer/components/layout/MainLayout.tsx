import { useState, useCallback, useRef, type ReactNode } from 'react';
import { Sidebar, type SidebarItem } from './Sidebar';
import { ChatPanel } from './ChatPanel';
import { CalendarPanel } from './CalendarPanel';
import { TimerPanel } from '../timer/TimerPanel';
import { useCalendar } from '../../context/calendar-context';
import { useTimer } from '../../context/timer-context';
import { useSidebar } from '../../context/sidebar-context';

type AgentName = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'general';

interface MainLayoutProps {
  agent: AgentName;
  children: ReactNode;
  sidebar?: {
    title: string;
    items: SidebarItem[];
    activeId?: string;
    onSelect?: (id: string) => void;
  };
  showChat?: boolean;
  noPadding?: boolean;
  defaultChatWidthPct?: number;
}

const LS_WIDTH_KEY = 'mark2-chat-width';
const LS_CAL_HEIGHT_KEY = 'mark2-calendar-chat-ratio';
const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const MIN_PANEL_HEIGHT = 150;
const DEFAULT_CAL_HEIGHT = 280;

function getInitialWidth(defaultPct: number): number {
  const saved = localStorage.getItem(LS_WIDTH_KEY);
  if (saved) {
    const n = parseInt(saved, 10);
    if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
  }
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(window.innerWidth * defaultPct / 100)));
}

function getInitialCalendarHeight(): number {
  const saved = localStorage.getItem(LS_CAL_HEIGHT_KEY);
  if (saved) {
    const n = parseInt(saved, 10);
    if (n >= MIN_PANEL_HEIGHT) return n;
  }
  return DEFAULT_CAL_HEIGHT;
}

const TIMER_HEIGHT = 140;

export function MainLayout({ agent, children, sidebar, showChat = true, noPadding = false, defaultChatWidthPct = 30 }: MainLayoutProps) {
  const { calendarOpen } = useCalendar();
  const { timerOpen } = useTimer();
  const { chatCollapsed, toggleChat } = useSidebar();
  const [width, setWidth] = useState(() => getInitialWidth(defaultChatWidthPct));
  const [calendarHeight, setCalendarHeight] = useState(getInitialCalendarHeight);
  const isHDragging = useRef(false);
  const isVDragging = useRef(false);
  const contentColRef = useRef<HTMLDivElement>(null);

  // Horizontal drag (panel width)
  const handleHDragDown = useCallback(() => {
    isHDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: MouseEvent) => {
      if (!isHDragging.current) return;
      const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
      setWidth(w);
      localStorage.setItem(LS_WIDTH_KEY, String(w));
    };
    const onUp = () => {
      isHDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Vertical drag (calendar/chat split) — pixel-based with min 150px each
  const handleVDragDown = useCallback(() => {
    isVDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: MouseEvent) => {
      if (!isVDragging.current || !contentColRef.current) return;
      const rect = contentColRef.current.getBoundingClientRect();
      const totalHeight = rect.height;
      const calH = e.clientY - rect.top;
      const chatH = totalHeight - calH - 4;
      const clamped = Math.min(totalHeight - MIN_PANEL_HEIGHT - 4, Math.max(MIN_PANEL_HEIGHT, calH));
      if (chatH >= MIN_PANEL_HEIGHT || calH <= clamped) {
        setCalendarHeight(Math.round(clamped));
        localStorage.setItem(LS_CAL_HEIGHT_KEY, String(Math.round(clamped)));
      }
    };
    const onUp = () => {
      isVDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div className="flex flex-1 overflow-hidden">
      {sidebar && (
        <Sidebar
          title={sidebar.title}
          items={sidebar.items}
          activeId={sidebar.activeId}
          onSelect={sidebar.onSelect}
        />
      )}

      <main className={`flex-1 overflow-auto ${noPadding ? '' : 'p-6'}`}>
        {children}
      </main>

      {showChat && (
        <div
          className="shrink-0 flex overflow-hidden transition-[width] duration-200 ease-in-out"
          style={{ width: chatCollapsed ? 0 : width }}
        >
          {!chatCollapsed && (
            <>
              {/* Horizontal drag handle */}
              <div className="w-1 cursor-col-resize hover:bg-blue-500/30 transition-colors shrink-0 border-l border-neutral-800" onMouseDown={handleHDragDown} />

              {/* Content column: calendar (optional) + chat */}
              <div ref={contentColRef} className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-neutral-950/50">
                {calendarOpen && !timerOpen && (
                  <>
                    <div className="shrink-0 overflow-hidden" style={{ height: calendarHeight }}>
                      <CalendarPanel />
                    </div>
                    <div
                      onMouseDown={handleVDragDown}
                      className="h-1 shrink-0 cursor-row-resize hover:bg-blue-500/30 bg-neutral-800/50 transition-colors"
                    />
                  </>
                )}

                {timerOpen && (
                  <>
                    <div className="shrink-0 overflow-hidden" style={{ height: TIMER_HEIGHT }}>
                      <TimerPanel />
                    </div>
                    <div className="h-px shrink-0 bg-neutral-800/50" />
                  </>
                )}

                <ChatPanel agent={agent} embedded onCollapse={toggleChat} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
