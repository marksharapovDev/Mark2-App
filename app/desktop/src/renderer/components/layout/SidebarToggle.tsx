import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';

interface SidebarToggleProps {
  collapsed: boolean;
  onToggle: () => void;
  side: 'left' | 'right';
}

export function SidebarToggle({ collapsed, onToggle, side }: SidebarToggleProps) {
  const isLeft = side === 'left';

  return (
    <button
      onClick={onToggle}
      className="w-6 h-6 flex items-center justify-center rounded bg-neutral-800/80 hover:bg-neutral-700 text-neutral-500 hover:text-neutral-300 transition-colors z-10"
      title={collapsed ? 'Показать панель' : 'Скрыть панель'}
    >
      {isLeft ? (
        collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />
      ) : (
        collapsed ? <MessageSquare size={12} /> : <ChevronRight size={14} />
      )}
    </button>
  );
}
