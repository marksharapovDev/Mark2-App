import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';

type AgentName = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'general';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  engine?: 'api' | 'claude-code';
  isNotification?: boolean;
}

export function ChatPopout() {
  const { agent: agentParam } = useParams<{ agent: string }>();
  const agent = (agentParam ?? 'general') as AgentName;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('New chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load or create session
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    window.chat.getSessions(agent).then(async (list) => {
      if (cancelled) return;
      if (list.length > 0) {
        const latest = list[0];
        if (!latest) return;
        setSessionId(latest.id);
        setSessionTitle(latest.title);
        const msgs = await window.chat.getSessionMessages(latest.id);
        if (!cancelled) setMessages(msgs.map((h) => ({ id: h.id, role: h.role, content: h.content, engine: h.engine })));
      } else {
        const session = await window.chat.createSession(agent);
        if (!cancelled) {
          setSessionId(session.id);
          setSessionTitle(session.title);
        }
      }
    }).catch(console.error).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [agent]);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking || !sessionId) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: trimmed }]);
    setInput('');
    setIsThinking(true);

    try {
      const response = await window.chat.send(agent, sessionId, trimmed);
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
      if (response.sessionTitle) setSessionTitle(response.sessionTitle);
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

  const handlePopin = useCallback(async () => {
    await window.chat.popin();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  }, [handleSubmit]);

  return (
    <div className="flex flex-col h-screen bg-neutral-950 text-neutral-100">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-800 bg-neutral-900/50">
        <span className="text-sm font-semibold text-neutral-300 uppercase">{agent}</span>
        <span className="text-xs text-neutral-600 truncate flex-1">{sessionTitle}</span>
        <button onClick={handlePopin} className="text-neutral-500 hover:text-neutral-300 transition-colors" title="Return to main window">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && <div className="text-center text-neutral-600 text-sm py-4">Loading...</div>}
        {!isLoading && messages.length === 0 && (
          <div className="text-center text-neutral-600 text-sm py-8">Chat with {agent} agent</div>
        )}
        {messages.map((msg) => <PopoutBubble key={msg.id} message={msg} />)}
        {isThinking && <div className="text-neutral-500 text-sm py-1"><span className="animate-pulse">Thinking...</span></div>}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-neutral-800">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            disabled={isThinking || !sessionId}
            rows={2}
            className="flex-1 bg-neutral-900 text-neutral-200 rounded-lg px-3 py-2 text-sm border border-neutral-700 focus:outline-none focus:border-neutral-500 resize-none placeholder:text-neutral-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isThinking || !input.trim() || !sessionId}
            className="self-end px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function PopoutBubble({ message }: { message: { role: string; content: string; engine?: string; isNotification?: boolean } }) {
  const isUser = message.role === 'user';

  if (message.isNotification) {
    return (
      <div className="text-center py-0.5">
        <span className="text-xs text-orange-400 bg-orange-900/20 px-2 py-0.5 rounded-full">{message.content}</span>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
        isUser ? 'bg-blue-600/20 text-blue-100' : 'bg-neutral-800 text-neutral-300'
      }`}>
        {!isUser && message.engine && (
          <span className={`text-[10px] font-medium mr-1 ${message.engine === 'claude-code' ? 'text-orange-400' : 'text-neutral-500'}`}>
            {message.engine === 'claude-code' ? 'CC' : 'API'}
          </span>
        )}
        {message.content}
      </div>
    </div>
  );
}
