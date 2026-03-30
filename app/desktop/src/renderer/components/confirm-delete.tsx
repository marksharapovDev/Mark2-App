import { useState } from 'react';
import { Trash2 } from 'lucide-react';

interface ConfirmDeleteProps {
  label: string;
  onConfirm: () => void;
  /** Render style: 'icon' = small trash icon, 'button' = text button, 'inline-red' = red text button */
  variant?: 'icon' | 'button' | 'inline-red';
  /** Custom icon size for icon variant */
  iconSize?: number;
  /** Extra className for the trigger button */
  className?: string;
}

export function ConfirmDelete({
  label,
  onConfirm,
  variant = 'icon',
  iconSize = 12,
  className,
}: ConfirmDeleteProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div
        className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-neutral-400 whitespace-nowrap">Удалить {label}?</span>
        <button
          onClick={(e) => { e.stopPropagation(); onConfirm(); setConfirming(false); }}
          className="px-2 py-0.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
        >
          Удалить
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
          className="px-2 py-0.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          Отмена
        </button>
      </div>
    );
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
        className={className ?? 'text-neutral-600 hover:text-red-400 transition-all'}
        title="Удалить"
      >
        <Trash2 size={iconSize} />
      </button>
    );
  }

  if (variant === 'inline-red') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
        className={className ?? 'flex items-center gap-1 px-3 py-1.5 rounded text-xs text-red-400 hover:bg-red-900/30 transition-colors'}
      >
        <Trash2 size={iconSize} /> Удалить
      </button>
    );
  }

  // variant === 'button'
  return (
    <button
      onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
      className={className ?? 'px-4 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-sm text-red-400 transition-colors flex items-center gap-1'}
    >
      <Trash2 size={14} /> Удалить
    </button>
  );
}
