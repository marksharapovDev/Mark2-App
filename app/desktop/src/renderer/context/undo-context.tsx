import { createContext, useContext, useCallback, useRef, useState, useEffect, type ReactNode } from 'react';

interface UndoItem {
  label: string;
  restoreFn: () => Promise<void> | void;
}

interface UndoContextValue {
  pushUndo: (item: UndoItem) => void;
  undo: () => void;
}

const UndoContext = createContext<UndoContextValue | null>(null);

export function useUndo() {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used within UndoProvider');
  return ctx;
}

const TOAST_DURATION = 5000;

export function UndoProvider({ children }: { children: ReactNode }) {
  const stackRef = useRef<UndoItem[]>([]);
  const [toast, setToast] = useState<UndoItem | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const hideToast = useCallback(() => {
    setVisible(false);
    setTimeout(() => setToast(null), 200); // wait for fade-out
  }, []);

  const showToast = useCallback((item: UndoItem) => {
    clearTimeout(timerRef.current);
    setToast(item);
    // Force reflow for animation
    requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(hideToast, TOAST_DURATION);
  }, [hideToast]);

  const pushUndo = useCallback((item: UndoItem) => {
    stackRef.current.push(item);
    showToast(item);
  }, [showToast]);

  const undo = useCallback(async () => {
    const item = stackRef.current.pop();
    if (!item) return;
    try {
      await item.restoreFn();
    } catch (err) {
      console.error('[Undo] restore failed:', err);
    }
    hideToast();
  }, [hideToast]);

  // Cmd+Z / Ctrl+Z global listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        // Only intercept if we have undo items and toast is showing
        if (stackRef.current.length > 0 && toast) {
          e.preventDefault();
          e.stopPropagation();
          undo();
        }
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [undo, toast]);

  return (
    <UndoContext.Provider value={{ pushUndo, undo }}>
      {children}
      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 shadow-xl">
            <span className="text-sm text-neutral-300">Удалено: {toast.label}</span>
            <button
              onClick={undo}
              className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
            >
              Отменить (⌘Z)
            </button>
          </div>
        </div>
      )}
    </UndoContext.Provider>
  );
}
