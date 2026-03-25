import { useState, useCallback } from 'react';

interface CollapsibleSidebar {
  collapsed: boolean;
  toggle: () => void;
  width: number | 0;
}

export function useCollapsibleSidebar(key: string, expandedWidth: number): CollapsibleSidebar {
  const lsKey = `mark2-sidebar-collapsed-${key}`;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(lsKey) === '1');

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(lsKey, next ? '1' : '0');
      return next;
    });
  }, [lsKey]);

  return {
    collapsed,
    toggle,
    width: collapsed ? 0 : expandedWidth,
  };
}
