import React, { useState, useCallback } from 'react';
import { Copy, Check, Pencil, RefreshCw, StopCircle } from 'lucide-react';

interface ActionButtonProps {
  icon: React.ReactElement;
  activeIcon?: React.ReactElement;
  title: string;
  onClick: () => void;
}

function ActionButton({ icon, activeIcon, title, onClick }: ActionButtonProps) {
  const [active, setActive] = useState(false);

  const handleClick = useCallback(() => {
    onClick();
    if (activeIcon) {
      setActive(true);
      setTimeout(() => setActive(false), 2000);
    }
  }, [onClick, activeIcon]);

  return (
    <button
      onClick={handleClick}
      className="p-0.5 text-neutral-600 hover:text-neutral-300 transition-colors"
      title={title}
    >
      {active && activeIcon ? activeIcon : icon}
    </button>
  );
}

interface UserActionsProps {
  content: string;
  onEdit: () => void;
}

export function UserMessageActions({ content, onEdit }: UserActionsProps) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).catch(console.error);
  }, [content]);

  return (
    <div className="flex items-center gap-1 pt-1">
      <ActionButton
        icon={<Copy className="w-3.5 h-3.5" />}
        activeIcon={<Check className="w-3.5 h-3.5 text-green-400" />}
        title="Copy"
        onClick={handleCopy}
      />
      <ActionButton
        icon={<Pencil className="w-3.5 h-3.5" />}
        title="Edit"
        onClick={onEdit}
      />
    </div>
  );
}

interface BotActionsProps {
  content: string;
  onRetry: () => void;
}

export function BotMessageActions({ content, onRetry }: BotActionsProps) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).catch(console.error);
  }, [content]);

  return (
    <div className="flex items-center gap-1 pt-1">
      <ActionButton
        icon={<Copy className="w-3.5 h-3.5" />}
        activeIcon={<Check className="w-3.5 h-3.5 text-green-400" />}
        title="Copy"
        onClick={handleCopy}
      />
      <ActionButton
        icon={<RefreshCw className="w-3.5 h-3.5" />}
        title="Retry"
        onClick={onRetry}
      />
    </div>
  );
}

export function InterruptedBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 pt-2 mt-1.5 border-t border-neutral-700/50">
      <StopCircle className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
      <span className="text-xs text-neutral-500">Ответ прерван</span>
      <button
        onClick={onRetry}
        className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors ml-auto"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Переделать</span>
      </button>
    </div>
  );
}

/** Strips "(прервано)" suffix from message content */
export function stripInterrupted(content: string): { text: string; wasInterrupted: boolean } {
  const re = /\n*\(прервано\)\s*$/;
  if (re.test(content)) {
    return { text: content.replace(re, '').trim(), wasInterrupted: true };
  }
  return { text: content, wasInterrupted: false };
}
