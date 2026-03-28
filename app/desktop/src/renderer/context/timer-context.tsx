import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { useCalendar } from './calendar-context';

type TimerMode = 'free' | 'event' | 'task';

interface LinkedEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  sphere?: string;
}

interface LinkedTask {
  id: string;
  title: string;
  subtasks?: Array<{ title: string; done: boolean }>;
}

const DEFAULT_SECONDS = 900; // 15 minutes

interface TimerState {
  mode: TimerMode;
  isRunning: boolean;
  isPaused: boolean;
  /** Remaining seconds (counts down in all modes) */
  seconds: number;
  /** Initial duration for free mode / total for event mode (progress bar) */
  totalSeconds: number;
  linkedEvent: LinkedEvent | null;
  linkedTask: LinkedTask | null;
  expired: boolean;
}

interface TimerContextValue extends TimerState {
  timerOpen: boolean;
  toggleTimer: () => void;
  closeTimer: () => void;
  openTimer: () => void;
  startFree: (initialSeconds?: number) => void;
  startEvent: (event: LinkedEvent) => void;
  startTask: (task: LinkedTask) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  addMinutes: (min: number) => void;
  setInitialTime: (seconds: number) => void;
  toggleSubtask: (index: number) => void;
  completeTask: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

const LS_KEY = 'mark2-timer-open';

const initialState: TimerState = {
  mode: 'free',
  isRunning: false,
  isPaused: false,
  seconds: DEFAULT_SECONDS,
  totalSeconds: DEFAULT_SECONDS,
  linkedEvent: null,
  linkedTask: null,
  expired: false,
};

function playBeep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.start();
    // Three short beeps
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.stop(ctx.currentTime + 0.8);
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // AudioContext may not be available
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { closeCalendar } = useCalendar();
  const [timerOpen, setTimerOpen] = useState(() => localStorage.getItem(LS_KEY) === 'true');
  const [state, setState] = useState<TimerState>(initialState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Tick logic — always counts DOWN
  useEffect(() => {
    if (!state.isRunning || state.isPaused) {
      clearTick();
      return;
    }

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        const next = prev.seconds - 1;
        if (next <= 0) {
          playBeep();
          return { ...prev, seconds: 0, expired: true, isRunning: false };
        }
        return { ...prev, seconds: next };
      });
    }, 1000);

    return clearTick;
  }, [state.isRunning, state.isPaused, clearTick]);

  // Listen for auto-start from main process
  useEffect(() => {
    const unsub = window.timer?.onAutoStart?.((data: { eventId: string; title: string; startAt: string; endAt: string; sphere?: string }) => {
      if (state.isRunning) return;
      const end = new Date(data.endAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.round((end - now) / 1000));
      const total = Math.round((end - new Date(data.startAt).getTime()) / 1000);

      setState({
        mode: 'event',
        isRunning: true,
        isPaused: false,
        seconds: remaining,
        totalSeconds: total,
        linkedEvent: { id: data.eventId, title: data.title, startAt: data.startAt, endAt: data.endAt, sphere: data.sphere },
        linkedTask: null,
        expired: false,
      });
      setTimerOpen(true);
      localStorage.setItem(LS_KEY, 'true');
      closeCalendar();
    });
    return unsub;
  }, [state.isRunning, closeCalendar]);

  // Listen for AI timer control
  useEffect(() => {
    const unsubStart = window.timer?.onTimerControl?.((action: string, params: Record<string, unknown>) => {
      if (action === 'start') {
        const minutes = (params.minutes as number) || 15;
        const title = (params.title as string) || '';
        const secs = minutes * 60;
        setState({
          mode: 'free',
          isRunning: true,
          isPaused: false,
          seconds: secs,
          totalSeconds: secs,
          linkedEvent: null,
          linkedTask: title ? { id: '', title, subtasks: [] } : null,
          expired: false,
        });
        setTimerOpen(true);
        localStorage.setItem(LS_KEY, 'true');
        closeCalendar();
      } else if (action === 'stop') {
        clearTick();
        setState(initialState);
      }
    });
    return unsubStart;
  }, [clearTick, closeCalendar]);

  const toggleTimer = useCallback(() => {
    setTimerOpen((prev) => {
      const next = !prev;
      localStorage.setItem(LS_KEY, String(next));
      if (next) closeCalendar();
      return next;
    });
  }, [closeCalendar]);

  const closeTimer = useCallback(() => {
    setTimerOpen(false);
    localStorage.setItem(LS_KEY, 'false');
  }, []);

  const openTimer = useCallback(() => {
    setTimerOpen(true);
    localStorage.setItem(LS_KEY, 'true');
    closeCalendar();
  }, [closeCalendar]);

  const startFree = useCallback((secs?: number) => {
    clearTick();
    const duration = secs ?? DEFAULT_SECONDS;
    setState({
      mode: 'free',
      isRunning: true,
      isPaused: false,
      seconds: duration,
      totalSeconds: duration,
      linkedEvent: null,
      linkedTask: null,
      expired: false,
    });
  }, [clearTick]);

  const startEvent = useCallback((event: LinkedEvent) => {
    clearTick();
    const end = new Date(event.endAt).getTime();
    const start = new Date(event.startAt).getTime();
    const now = Date.now();
    const remaining = Math.max(0, Math.round((end - now) / 1000));
    const total = Math.round((end - start) / 1000);

    setState({
      mode: 'event',
      isRunning: true,
      isPaused: false,
      seconds: remaining,
      totalSeconds: total,
      linkedEvent: event,
      linkedTask: null,
      expired: remaining <= 0,
    });
  }, [clearTick]);

  const startTask = useCallback((task: LinkedTask) => {
    clearTick();
    setState({
      mode: 'task',
      isRunning: true,
      isPaused: false,
      seconds: 0,
      totalSeconds: 0,
      linkedEvent: null,
      linkedTask: task,
      expired: false,
    });
  }, [clearTick]);

  const play = useCallback(() => {
    setState((prev) => {
      if (!prev.isRunning) return { ...prev, isRunning: true, isPaused: false };
      if (prev.isPaused) return { ...prev, isPaused: false };
      return prev;
    });
  }, []);

  const pause = useCallback(() => {
    setState((prev) => (prev.isRunning ? { ...prev, isPaused: true } : prev));
  }, []);

  const stop = useCallback(() => {
    clearTick();
    setState(initialState);
  }, [clearTick]);

  const addMinutes = useCallback((min: number) => {
    setState((prev) => ({
      ...prev,
      seconds: prev.seconds + min * 60,
      totalSeconds: prev.isRunning ? prev.totalSeconds + min * 60 : prev.totalSeconds + min * 60,
      expired: false,
    }));
  }, []);

  const setInitialTime = useCallback((seconds: number) => {
    setState((prev) => (prev.isRunning ? prev : { ...prev, seconds, totalSeconds: seconds, expired: false }));
  }, []);

  const toggleSubtask = useCallback((index: number) => {
    setState((prev) => {
      if (!prev.linkedTask?.subtasks) return prev;
      const subtasks = prev.linkedTask.subtasks.map((s, i) =>
        i === index ? { ...s, done: !s.done } : s,
      );
      return { ...prev, linkedTask: { ...prev.linkedTask, subtasks } };
    });
  }, []);

  const completeTask = useCallback(() => {
    clearTick();
    setState(initialState);
  }, [clearTick]);

  return (
    <TimerContext.Provider
      value={{
        ...state,
        timerOpen,
        toggleTimer,
        closeTimer,
        openTimer,
        startFree,
        startEvent,
        startTask,
        play,
        pause,
        stop,
        addMinutes,
        setInitialTime,
        toggleSubtask,
        completeTask,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}
