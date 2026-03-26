import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SidebarContextValue {
  leftCollapsed: boolean;
  toggleLeft: () => void;
  chatCollapsed: boolean;
  toggleChat: () => void;
  /** Set the left sidebar key (changes per page) */
  setLeftKey: (key: string) => void;
}

const LS_CHAT_KEY = 'mark2-chat-collapsed';

function lsLeftKey(key: string) {
  return `mark2-sidebar-collapsed-${key}`;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [leftKey, setLeftKeyRaw] = useState('');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(() => localStorage.getItem(LS_CHAT_KEY) === '1');

  const setLeftKey = useCallback((key: string) => {
    setLeftKeyRaw(key);
    setLeftCollapsed(localStorage.getItem(lsLeftKey(key)) === '1');
  }, []);

  const toggleLeft = useCallback(() => {
    setLeftCollapsed((prev) => {
      const next = !prev;
      if (leftKey) localStorage.setItem(lsLeftKey(leftKey), next ? '1' : '0');
      return next;
    });
  }, [leftKey]);

  const toggleChat = useCallback(() => {
    setChatCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(LS_CHAT_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ leftCollapsed, toggleLeft, chatCollapsed, toggleChat, setLeftKey }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be inside SidebarProvider');
  return ctx;
}
