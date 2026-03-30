interface ThinkingIndicatorProps {
  statusText?: string | null;
}

export function ThinkingIndicator({ statusText }: ThinkingIndicatorProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex gap-1">
        <span
          className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '0.8s' }}
        />
        <span
          className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
          style={{ animationDelay: '150ms', animationDuration: '0.8s' }}
        />
        <span
          className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
          style={{ animationDelay: '300ms', animationDuration: '0.8s' }}
        />
      </div>
      <span className="text-[13px] text-neutral-400">{statusText || 'Думает...'}</span>
    </div>
  );
}
