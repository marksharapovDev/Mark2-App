import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';

type AgentName = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'general';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  engine?: 'api' | 'claude-code';
  isNotification?: boolean;
}

const AGENTS: { value: AgentName; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'dev', label: 'Dev' },
  { value: 'teaching', label: 'Teaching' },
  { value: 'study', label: 'Study' },
  { value: 'health', label: 'Health' },
  { value: 'finance', label: 'Finance' },
];

export function Chat() {
  const [agent, setAgent] = useState<AgentName>('general');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const response = await window.chat.send(agent, trimmed);

      // Show notification if engine switched to Claude Code
      if (response.notification) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: response.notification ?? '',
            engine: 'claude-code',
            isNotification: true,
          },
        ]);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.content,
          engine: response.engine,
        },
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

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-neutral-800">
        <h1 className="text-xl font-bold">Chat</h1>

        <select
          value={agent}
          onChange={(e) => setAgent(e.target.value as AgentName)}
          disabled={isThinking}
          className="bg-neutral-800 text-neutral-200 rounded px-3 py-1.5 text-sm border border-neutral-700 focus:outline-none focus:border-neutral-500"
        >
          {AGENTS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <button
          onClick={handleClear}
          disabled={isThinking}
          className="ml-auto px-3 py-1.5 rounded text-sm bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-colors disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 py-4">
        {isLoadingHistory && (
          <div className="text-center text-neutral-500 text-sm py-4">
            Loading history...
          </div>
        )}

        {!isLoadingHistory && messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
            Send a message to start chatting with the {agent} agent
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isThinking && (
          <div className="flex items-center gap-2 text-neutral-400 text-sm py-2">
            <span className="flex gap-1">
              <span className="animate-bounce [animation-delay:0ms]">.</span>
              <span className="animate-bounce [animation-delay:150ms]">.</span>
              <span className="animate-bounce [animation-delay:300ms]">.</span>
            </span>
            Agent is thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="pt-4 border-t border-neutral-800">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            disabled={isThinking}
            rows={2}
            className="flex-1 bg-neutral-900 text-neutral-100 rounded-lg px-4 py-3 text-sm border border-neutral-700 focus:outline-none focus:border-neutral-500 resize-none placeholder:text-neutral-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isThinking || !input.trim()}
            className="self-end px-5 py-3 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  if (message.isNotification) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-orange-400 bg-orange-900/20 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-blue-600/20 text-blue-100'
            : 'bg-neutral-800 text-neutral-200'
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-neutral-500 font-medium">Agent</span>
            {message.engine && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                message.engine === 'claude-code'
                  ? 'bg-orange-900/40 text-orange-400'
                  : 'bg-neutral-700 text-neutral-400'
              }`}>
                {message.engine === 'claude-code' ? 'Claude Code' : 'API'}
              </span>
            )}
          </div>
        )}
        {message.content}
      </div>
    </div>
  );
}
