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
      className={`shrink-0 w-5 flex items-center justify-center bg-neutral-900/80 hover:bg-neutral-800 border-neutral-800 transition-colors group ${
        isLeft ? 'border-r' : 'border-l'
      }`}
      title={collapsed ? 'Показать панель' : 'Скрыть панель'}
    >
      <span className="text-neutral-600 group-hover:text-neutral-300 transition-colors">
        {isLeft ? (
          collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />
        ) : (
          collapsed ? <MessageSquare size={12} /> : <ChevronRight size={12} />
        )}
      </span>
    </button>
  );
}
