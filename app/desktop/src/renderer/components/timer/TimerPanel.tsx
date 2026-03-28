import { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Pause, Square, ExternalLink, CheckCircle2, RotateCcw } from 'lucide-react';
import { useTimer } from '../../context/timer-context';

const SPHERE_COLORS: Record<string, string> = {
  teaching: 'bg-green-500',
  study: 'bg-purple-500',
  dev: 'bg-blue-500',
  health: 'bg-orange-500',
  finance: 'bg-yellow-500',
};

const PRESETS = [5, 10, 15, 25, 30, 45, 60] as const;
const QUICK_ADD = [1, 2, 5, 10, 15] as const;

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function MinuteInput({ initial, onSet, onCancel }: { initial: number; onSet: (seconds: number) => void; onCancel: () => void }) {
  const [value, setValue] = useState(String(Math.round(initial / 60)));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const confirm = () => {
    const mins = parseInt(value, 10);
    if (mins > 0) onSet(mins * 60);
    else onCancel();
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          className="w-14 bg-neutral-800 text-center text-lg font-mono rounded border border-neutral-700 text-neutral-200 outline-none focus:border-blue-500 py-0.5"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 3))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') onCancel();
          }}
          maxLength={3}
          autoFocus
        />
        <span className="text-neutral-500 text-sm">мин</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => onSet(p * 60)}
            className="px-1.5 py-0.5 text-[10px] rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {p}м
          </button>
        ))}
      </div>
    </div>
  );
}

interface TimerPanelProps {
  embedded?: boolean;
}

export function TimerPanel({ embedded = true }: TimerPanelProps) {
  const timer = useTimer();
  const [editing, setEditing] = useState(false);

  const handlePopout = useCallback(async () => {
    console.log('[TimerPanel] popout clicked, window.timer:', !!window.timer);
    try {
      const result = await window.timer.popout();
      console.log('[TimerPanel] popout result:', result);
      timer.closeTimer();
    } catch (err) {
      console.error('[TimerPanel] popout error:', err);
    }
  }, [timer]);

  const handlePlayPause = () => {
    if (!timer.isRunning && !timer.expired) {
      timer.startFree(timer.seconds);
    } else if (timer.isPaused) {
      timer.play();
    } else if (timer.isRunning) {
      timer.pause();
    }
  };

  const handleSetTime = (seconds: number) => {
    timer.setInitialTime(seconds);
    setEditing(false);
  };

  const handleReset = () => {
    timer.stop();
  };

  // === Event mode ===
  if (timer.mode === 'event' && timer.linkedEvent) {
    const sphereColor = SPHERE_COLORS[timer.linkedEvent.sphere ?? ''] ?? 'bg-blue-500';
    const elapsed = timer.totalSeconds - timer.seconds;
    const progress = timer.totalSeconds > 0 ? Math.min(100, (elapsed / timer.totalSeconds) * 100) : 0;

    return (
      <div className="flex flex-col gap-2 p-3 bg-neutral-900/80 h-full">
        <div className={`h-0.5 rounded-full ${sphereColor}`} />

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-neutral-400 truncate flex-1">{timer.linkedEvent.title}</span>
          {embedded && (
            <button onClick={handlePopout} className="text-neutral-600 hover:text-neutral-300 transition-colors" title="Вынести в окно">
              <ExternalLink size={12} />
            </button>
          )}
        </div>

        <div className="text-center">
          {timer.expired ? (
            <div className="text-red-400 text-lg font-bold animate-pulse">Время вышло!</div>
          ) : (
            <div className="text-2xl font-mono font-bold text-neutral-100 tabular-nums">
              {formatTime(timer.seconds)}
            </div>
          )}
        </div>

        <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${sphereColor}`} style={{ width: `${progress}%` }} />
        </div>

        <div className="flex items-center justify-center gap-2">
          <button onClick={handlePlayPause} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors">
            {timer.isPaused || !timer.isRunning ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button onClick={timer.stop} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-800 hover:bg-red-900/50 text-neutral-400 hover:text-red-400 transition-colors">
            <Square size={12} />
          </button>
        </div>
      </div>
    );
  }

  // === Task mode ===
  if (timer.mode === 'task' && timer.linkedTask) {
    return (
      <div className="flex flex-col gap-2 p-3 bg-neutral-900/80 h-full overflow-y-auto">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-neutral-400 truncate flex-1">{timer.linkedTask.title}</span>
          {embedded && (
            <button onClick={handlePopout} className="text-neutral-600 hover:text-neutral-300 transition-colors" title="Вынести в окно">
              <ExternalLink size={12} />
            </button>
          )}
        </div>

        <div className="text-center text-2xl font-mono font-bold text-neutral-100 tabular-nums">
          {formatTime(timer.seconds)}
        </div>

        {timer.linkedTask.subtasks && timer.linkedTask.subtasks.length > 0 && (
          <div className="space-y-1">
            {timer.linkedTask.subtasks.map((sub, i) => (
              <label key={i} className="flex items-center gap-1.5 text-xs cursor-pointer group">
                <input
                  type="checkbox"
                  checked={sub.done}
                  onChange={() => timer.toggleSubtask(i)}
                  className="rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-0 w-3.5 h-3.5"
                />
                <span className={sub.done ? 'text-neutral-600 line-through' : 'text-neutral-400 group-hover:text-neutral-300'}>
                  {sub.title}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 mt-auto">
          <button onClick={handlePlayPause} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors">
            {timer.isPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button onClick={timer.stop} className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-800 hover:bg-red-900/50 text-neutral-400 hover:text-red-400 transition-colors">
            <Square size={12} />
          </button>
          <button onClick={timer.completeTask} className="h-7 px-2 flex items-center gap-1 rounded-full bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs transition-colors">
            <CheckCircle2 size={12} />
            Готово
          </button>
        </div>
      </div>
    );
  }

  // === Free mode (default) — countdown ===
  const progress = timer.totalSeconds > 0 ? Math.min(100, ((timer.totalSeconds - timer.seconds) / timer.totalSeconds) * 100) : 0;

  return (
    <div className="flex flex-col gap-1.5 p-3 bg-neutral-900/80 h-full">
      {/* Header + popout */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-neutral-500 uppercase tracking-wider">Таймер</span>
        {embedded && (
          <button onClick={handlePopout} className="text-neutral-600 hover:text-neutral-300 transition-colors" title="Вынести в окно">
            <ExternalLink size={12} />
          </button>
        )}
      </div>

      {/* Time display */}
      <div className="text-center">
        {editing && !timer.isRunning ? (
          <MinuteInput
            initial={timer.seconds}
            onSet={handleSetTime}
            onCancel={() => setEditing(false)}
          />
        ) : timer.expired ? (
          <div className="text-red-400 text-2xl font-mono font-bold animate-pulse">Время вышло!</div>
        ) : (
          <button
            onClick={() => !timer.isRunning && setEditing(true)}
            className={`text-2xl font-mono font-bold tabular-nums transition-colors ${
              timer.isRunning ? 'text-neutral-100 cursor-default' : 'text-neutral-400 hover:text-neutral-200 cursor-pointer'
            }`}
            disabled={timer.isRunning}
            title={timer.isRunning ? undefined : 'Задать время'}
          >
            {formatTime(timer.seconds)}
          </button>
        )}
      </div>

      {/* Progress bar (visible when running or expired) */}
      {(timer.isRunning || timer.expired) && (
        <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${timer.expired ? 'bg-red-500' : 'bg-emerald-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Controls + quick add — single row */}
      <div className="flex items-center gap-1.5">
        {timer.expired ? (
          <button
            onClick={handleReset}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            title="Сбросить"
          >
            <RotateCcw size={16} />
          </button>
        ) : (
          <>
            <button
              onClick={handlePlayPause}
              disabled={timer.seconds === 0 && !timer.isRunning}
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 transition-colors"
            >
              {timer.isRunning && !timer.isPaused ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              onClick={handleReset}
              disabled={!timer.isRunning && timer.seconds === timer.totalSeconds}
              className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-neutral-800 hover:bg-red-900/50 text-neutral-400 hover:text-red-400 disabled:opacity-30 transition-colors"
              title="Сбросить"
            >
              <Square size={12} />
            </button>
          </>
        )}

        {/* Quick add buttons — fill remaining space */}
        <div className="flex-1 grid grid-cols-5 gap-1">
          {QUICK_ADD.map((m) => (
            <button
              key={m}
              onClick={() => timer.addMinutes(m)}
              className="py-1 text-xs rounded bg-neutral-700/50 hover:bg-neutral-600 text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              +{m}м
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
