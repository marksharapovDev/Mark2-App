import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';

type AgentName = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'general';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streamBuffer, setStreamBuffer] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  // Subscribe to stream events
  useEffect(() => {
    const unsubStream = window.claude.onStream((_sid, chunk) => {
      setStreamBuffer((prev) => prev + chunk);
    });

    const unsubError = window.claude.onSessionError((_sid, error) => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${error}` },
      ]);
      setIsThinking(false);
    });

    const unsubEnd = window.claude.onSessionEnd(() => {
      setSessionId(null);
      setIsThinking(false);
    });

    return () => {
      unsubStream();
      unsubError();
      unsubEnd();
    };
  }, []);

  // When stream finishes (thinking stops), commit buffer to messages
  useEffect(() => {
    if (!isThinking && streamBuffer.length > 0) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: streamBuffer.trim() },
      ]);
      setStreamBuffer('');
    }
  }, [isThinking, streamBuffer]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);
    setStreamBuffer('');

    try {
      if (sessionId) {
        // Interactive session — send to stdin
        await window.claude.sendMessage(sessionId, trimmed);
      } else {
        // One-shot — claude -p "prompt"
        const result = await window.claude.run(agent, trimmed);
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: result.trim() },
        ]);
      }
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
  }, [input, isThinking, sessionId, agent]);

  const handleStartSession = useCallback(async () => {
    try {
      const sid = await window.claude.startSession(agent);
      setSessionId(sid);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start session';
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${errorMsg}` },
      ]);
    }
  }, [agent]);

  const handleStopSession = useCallback(async () => {
    if (sessionId) {
      await window.claude.stopSession(sessionId);
      setSessionId(null);
    }
  }, [sessionId]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setStreamBuffer('');
  }, []);

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
          disabled={sessionId !== null}
          className="bg-neutral-800 text-neutral-200 rounded px-3 py-1.5 text-sm border border-neutral-700 focus:outline-none focus:border-neutral-500"
        >
          {AGENTS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <div className="flex gap-2 ml-auto">
          {sessionId ? (
            <button
              onClick={handleStopSession}
              className="px-3 py-1.5 rounded text-sm bg-red-900/50 text-red-300 hover:bg-red-900/70 transition-colors"
            >
              Stop Session
            </button>
          ) : (
            <button
              onClick={handleStartSession}
              className="px-3 py-1.5 rounded text-sm bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
            >
              Start Session
            </button>
          )}
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded text-sm bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Mode indicator */}
      <div className="py-2 text-xs text-neutral-500">
        {sessionId
          ? `Interactive session with ${agent} agent`
          : `One-shot mode — ${agent} agent`}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && !streamBuffer && (
          <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
            Send a message to start chatting with the {agent} agent
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming buffer */}
        {streamBuffer && (
          <MessageBubble
            message={{ id: 'stream', role: 'assistant', content: streamBuffer }}
          />
        )}

        {/* Thinking indicator */}
        {isThinking && !streamBuffer && (
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
          <div className="text-xs text-neutral-500 mb-1 font-medium">Agent</div>
        )}
        {message.content}
      </div>
    </div>
  );
}
