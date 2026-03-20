import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';

type AgentName = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'general';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  engine?: 'api' | 'claude-code';
  isNotification?: boolean;
}

interface ChatPanelProps {
  agent: AgentName;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 360;

export function ChatPanel({ agent }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isDragging = useRef(false);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load history when agent changes
  useEffect(() => {
    let cancelled = false;
    setIsLoadingHistory(true);

    window.chat.history(agent)
      .then((history) => {
        if (cancelled) return;
        setMessages(
          history.map((h) => ({
            id: h.id,
            role: h.role,
            content: h.content,
            engine: h.engine,
          })),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load history:', err);
        setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });

    return () => { cancelled = true; };
  }, [agent]);

  // Drag to resize
  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: trimmed }]);
    setInput('');
    setIsThinking(true);

    try {
      const response = await window.chat.send(agent, trimmed);

      if (response.notification) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: response.notification ?? '', engine: 'claude-code', isNotification: true },
        ]);
      }

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: response.content, engine: response.engine },
      ]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${errorMsg}` },
      ]);
    } finally {
      setIsThinking(false);
      inputRef.current?.focus();
    }
  }, [input, isThinking, agent]);

  const handleClear = useCallback(async () => {
    await window.chat.clear(agent);
    setMessages([]);
  }, [agent]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  }, [handleSubmit]);

  // Collapsed state
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-10 shrink-0 border-l border-neutral-800 flex flex-col items-center justify-center gap-1 bg-neutral-950/50 hover:bg-neutral-900 transition-colors"
        title="Open chat"
      >
        <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>
        <span className="text-[10px] text-neutral-600 [writing-mode:vertical-lr]">Chat</span>
      </button>
    );
  }

  return (
    <div className="shrink-0 border-l border-neutral-800 flex bg-neutral-950/50" style={{ width }}>
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1 cursor-col-resize hover:bg-blue-500/30 transition-colors"
      />

      {/* Chat content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800">
          <span className="text-xs font-semibold text-neutral-400 uppercase">{agent}</span>
          <button
            onClick={handleClear}
            className="ml-auto text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-neutral-600 hover:text-neutral-400 transition-colors"
            title="Collapse chat"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
          {isLoadingHistory && (
            <div className="text-center text-neutral-600 text-xs py-4">Loading...</div>
          )}

          {!isLoadingHistory && messages.length === 0 && (
            <div className="text-center text-neutral-600 text-xs py-8">
              Chat with {agent} agent
            </div>
          )}

          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}

          {isThinking && (
            <div className="text-neutral-500 text-xs py-1">
              <span className="animate-pulse">Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-neutral-800">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              disabled={isThinking}
              rows={1}
              className="flex-1 bg-neutral-900 text-neutral-200 rounded px-3 py-2 text-xs border border-neutral-700 focus:outline-none focus:border-neutral-500 resize-none placeholder:text-neutral-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isThinking || !input.trim()}
              className="self-end px-3 py-2 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  if (message.isNotification) {
    return (
      <div className="text-center py-0.5">
        <span className="text-[10px] text-orange-400 bg-orange-900/20 px-2 py-0.5 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-lg px-3 py-2 text-xs whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-blue-600/20 text-blue-100'
            : 'bg-neutral-800 text-neutral-300'
        }`}
      >
        {!isUser && message.engine && (
          <span className={`text-[9px] font-medium mr-1 ${
            message.engine === 'claude-code' ? 'text-orange-400' : 'text-neutral-500'
          }`}>
            {message.engine === 'claude-code' ? 'CC' : 'API'}
          </span>
        )}
        {message.content}
      </div>
    </div>
  );
}
