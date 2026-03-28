import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { Mic, Paperclip, ArrowUp, Square } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { FileAttachmentCard, parseBotFileLinks } from '../FileAttachmentCard';
import { UserMessageActions, BotMessageActions, InterruptedBanner, stripInterrupted } from '../MessageActions';

type AgentName = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'general';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  engine?: 'api' | 'claude-code';
  isNotification?: boolean;
  filePaths?: string[];
}

interface ChatPanelProps {
  agent: AgentName;
  defaultWidthPct?: number; // default width as % of window (e.g. 30 or 35)
  embedded?: boolean; // when true, no width management — fills parent container
  onCollapse?: () => void; // external collapse handler (replaces internal isOpen toggle)
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const LS_KEY = 'mark2-chat-width';

function getInitialChatWidth(defaultPct: number): number {
  const saved = localStorage.getItem(LS_KEY);
  if (saved) {
    const n = parseInt(saved, 10);
    if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
  }
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(window.innerWidth * defaultPct / 100)));
}

export function ChatPanel({ agent, defaultWidthPct = 30, embedded = false, onCollapse }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isPoppedOut, setIsPoppedOut] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [width, setWidth] = useState(() => getInitialChatWidth(defaultWidthPct));

  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState('New chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [streamingDone, setStreamingDone] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isDragging = useRef(false);
  const msgCache = useRef<Map<string, Message[]>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);

  // Listen for pop-in
  useEffect(() => {
    const unsub = window.chat.onPoppedIn(() => setIsPoppedOut(false));
    return unsub;
  }, []);

  // Listen for streaming events
  useEffect(() => {
    const unsubStart = window.chat.onStreamStart((sid) => {
      if (sid === activeSessionId) {
        setStreamingText('');
        setIsThinking(true);
      }
    });
    const unsubUpdate = window.chat.onStreamUpdate((sid, text) => {
      if (sid === activeSessionId) {
        setStreamingText(text);
      }
    });
    const unsubEnd = window.chat.onStreamEnd((sid) => {
      if (sid === activeSessionId) {
        setStreamingDone(true);
        setStatusText(null);
      }
    });
    const unsubStatus = window.chat.onStatusUpdate((sid, status) => {
      if (sid === activeSessionId) {
        setStatusText(status || null);
      }
    });
    return () => { unsubStart(); unsubUpdate(); unsubEnd(); unsubStatus(); };
  }, [activeSessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Track previous agent to generate summary on tab switch
  const prevAgentRef = useRef<AgentName | null>(null);

  // Initialize: load sessions, open latest or create new
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setMessages([]);
    setActiveSessionId(null);
    setShowHistory(false);

    // Generate summary for previous agent's active session (fire-and-forget)
    if (prevAgentRef.current && prevAgentRef.current !== agent) {
      window.chat.agentSwitch(prevAgentRef.current).catch(console.error);
    }
    prevAgentRef.current = agent;

    msgCache.current.clear();

    window.chat.getSessions(agent).then(async (list) => {
      if (cancelled) return;
      setSessions(list);

      if (list.length > 0) {
        const latest = list[0];
        if (!latest) return;
        setActiveSessionId(latest.id);
        setActiveSessionTitle(latest.title);
        const [msgs, thinking] = await Promise.all([
          window.chat.getSessionMessages(latest.id),
          window.chat.isThinking(latest.id),
        ]);
        if (!cancelled) {
          const mapped = msgs.map(toMessage);
          msgCache.current.set(latest.id, mapped);
          setMessages(mapped);
          if (thinking) setIsThinking(true);
        }
      } else {
        const session = await window.chat.createSession(agent);
        if (!cancelled) {
          setSessions([session]);
          setActiveSessionId(session.id);
          setActiveSessionTitle(session.title);
          msgCache.current.set(session.id, []);
        }
      }
    }).catch(console.error).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [agent]);

  // Drag resize
  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
      setWidth(w);
      localStorage.setItem(LS_KEY, String(w));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Send message
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking || !activeSessionId) return;

    // Stop recording if active
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    // Capture files and clear state
    const filesToSend = attachedFiles.length > 0 ? [...attachedFiles] : undefined;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: trimmed, filePaths: filesToSend }]);
    setInput('');
    setAttachedFiles([]);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsThinking(true);

    try {
      console.log('[ChatPanel] Sending with filesToSend:', filesToSend);
      const response = await window.chat.send(agent, activeSessionId, trimmed, filesToSend);

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

      if (response.sessionTitle) {
        setActiveSessionTitle(response.sessionTitle);
        setSessions((prev) =>
          prev.map((s) => s.id === activeSessionId ? { ...s, title: response.sessionTitle ?? s.title } : s),
        );
      }

      // Notify pages that data has changed so they can reload
      if (response.changedEntities && response.changedEntities.length > 0) {
        window.dataEvents.emitDataChanged(response.changedEntities);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${errorMsg}` },
      ]);
    } finally {
      setStreamingText(null);
      setStreamingDone(false);
      setIsThinking(false);
      inputRef.current?.focus();
      // Update cache with latest messages
      if (activeSessionId) {
        setMessages((prev) => {
          msgCache.current.set(activeSessionId, prev);
          return prev;
        });
      }
    }
  }, [input, isThinking, activeSessionId, agent]);

  // New chat — show empty chat instantly, create in DB in background
  const handleNewChat = useCallback(async () => {
    // Save current messages to cache
    if (activeSessionId) {
      setMessages((prev) => {
        msgCache.current.set(activeSessionId, prev);
        return prev;
      });
    }

    // Instantly show empty chat with temp ID
    const tempId = crypto.randomUUID();
    setMessages([]);
    setActiveSessionId(tempId);
    setActiveSessionTitle('New chat');
    setShowHistory(false);

    // Create session in DB in background
    try {
      const session = await window.chat.createSession(agent, activeSessionId ?? undefined);
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      setActiveSessionTitle(session.title);
      msgCache.current.set(session.id, []);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  }, [agent, activeSessionId]);

  // Switch session — use cache if available, fetch in background
  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (sessionId === activeSessionId) {
      setShowHistory(false);
      return;
    }

    // Save current messages to cache before switching
    if (activeSessionId) {
      setMessages((prev) => {
        msgCache.current.set(activeSessionId, prev);
        return prev;
      });
    }

    const session = sessions.find((s) => s.id === sessionId);
    setActiveSessionId(sessionId);
    setActiveSessionTitle(session?.title ?? 'Chat');
    setShowHistory(false);

    // Use cached messages for instant switch
    const cached = msgCache.current.get(sessionId);
    if (cached) {
      setMessages(cached);
      // Still notify backend about switch (fire-and-forget)
      window.chat.switchSession(activeSessionId, sessionId).catch(console.error);
    } else {
      setIsLoading(true);
      try {
        const msgs = await window.chat.switchSession(activeSessionId, sessionId);
        const mapped = msgs.map(toMessage);
        msgCache.current.set(sessionId, mapped);
        setMessages(mapped);
      } catch (err) {
        console.error('Failed to switch session:', err);
      } finally {
        setIsLoading(false);
      }
    }
  }, [activeSessionId, sessions]);

  // Delete session
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await window.chat.deleteSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setDeleteConfirm(null);

    if (sessionId === activeSessionId) {
      const remaining = sessions.filter((s) => s.id !== sessionId);
      if (remaining.length > 0) {
        const next = remaining[0];
        if (next) {
          setActiveSessionId(next.id);
          setActiveSessionTitle(next.title);
          const msgs = await window.chat.getSessionMessages(next.id);
          setMessages(msgs.map(toMessage));
        }
      } else {
        const session = await window.chat.createSession(agent);
        setSessions([session]);
        setActiveSessionId(session.id);
        setActiveSessionTitle(session.title);
        setMessages([]);
      }
    }
  }, [activeSessionId, sessions, agent]);

  const handlePopout = useCallback(async () => {
    await window.chat.popout(agent);
    setIsPoppedOut(true);
  }, [agent]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  }, [handleSubmit]);

  // Voice input toggle (MediaRecorder + Whisper + AudioContext analyser)
  const toggleRecording = useCallback(async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Speech detection via AudioContext
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setIsSpeaking(volume > 10);
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };
      checkVolume();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current);
        setIsSpeaking(false);
        audioCtx.close().catch(() => {});
        audioContextRef.current = null;
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) return;

        setIsTranscribing(true);
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const result = await window.chat.transcribeAudio(arrayBuffer);
          console.log('[Voice] Transcribe result:', result);
          if (result.error) {
            setVoiceError('Не удалось распознать речь. Проверьте микрофон.');
            setTimeout(() => setVoiceError(null), 3000);
          } else if (result.text) {
            setInput((prev) => (prev ? prev + ' ' + result.text : result.text));
          }
        } catch (err) {
          console.error('[Voice] Transcription failed:', err);
          setVoiceError('Ошибка транскрипции');
          setTimeout(() => setVoiceError(null), 3000);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setVoiceError(null);
    } catch (err) {
      console.error('[Voice] Failed to access microphone:', err);
    }
  }, [isRecording]);

  // File attachment
  const handleAttachFiles = useCallback(async () => {
    const paths = await window.electronAPI.openFiles();
    if (paths && paths.length > 0) {
      setAttachedFiles((prev) => [...prev, ...paths]);
    }
  }, []);

  const handleRemoveFile = useCallback((filePath: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f !== filePath));
  }, []);

  // Edit user message: remove bot response, put text back in input
  const handleEditMessage = useCallback((msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg || msg.role !== 'user') return;
    // Remove this message and the bot response after it
    setMessages((prev) => {
      const next = [...prev];
      // Remove bot response (next message if it's assistant)
      if (next[msgIndex + 1]?.role === 'assistant') next.splice(msgIndex + 1, 1);
      next.splice(msgIndex, 1);
      return next;
    });
    setInput(msg.content);
    if (msg.filePaths) setAttachedFiles(msg.filePaths);
    inputRef.current?.focus();
  }, [messages]);

  // Retry: resend the user message that precedes the bot response at msgIndex
  const handleRetryMessage = useCallback((msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg) return;

    let userMsg: Message | undefined;
    if (msg.role === 'assistant') {
      // Find preceding user message
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i]?.role === 'user') { userMsg = messages[i]; break; }
      }
    } else {
      userMsg = msg;
    }
    if (!userMsg || !activeSessionId) return;

    // Remove the bot response
    setMessages((prev) => {
      const next = [...prev];
      if (msg.role === 'assistant') next.splice(msgIndex, 1);
      return next;
    });

    // Resend with variation hint
    setIsThinking(true);
    const retryText = userMsg.content + '\n\n(повторный запрос, дай другой ответ)';
    window.chat.send(agent, activeSessionId, retryText, userMsg.filePaths).then((response) => {
      if (response.notification) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: response.notification ?? '', engine: 'claude-code', isNotification: true }]);
      }
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: response.content, engine: response.engine }]);
      if (response.changedEntities?.length) window.dataEvents.emitDataChanged(response.changedEntities);
    }).catch((err) => {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${errorMsg}` }]);
    }).finally(() => {
      setStreamingText(null);
      setStreamingDone(false);
      setIsThinking(false);
      inputRef.current?.focus();
    });
  }, [messages, activeSessionId, agent]);

  // Abort current request
  const handleAbort = useCallback(() => {
    if (activeSessionId) {
      window.chat.abort(activeSessionId);
    }
  }, [activeSessionId]);

  // Auto-resize textarea on programmatic input changes (dictation, paste)
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // --- Render states ---

  if (isPoppedOut) {
    if (embedded) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-1 min-h-0">
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          <span className="text-[9px] text-blue-400">Chat in popout</span>
        </div>
      );
    }
    return (
      <div className="w-10 shrink-0 border-l border-neutral-800 flex flex-col items-center justify-center gap-1 bg-neutral-950/50">
        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
        <span className="text-[9px] text-blue-400 [writing-mode:vertical-lr]">Popout</span>
      </div>
    );
  }

  if (!isOpen) {
    if (embedded) {
      return (
        <button
          onClick={() => setIsOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 min-h-0 hover:bg-neutral-900 transition-colors"
          title="Open chat"
        >
          <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
          <span className="text-[10px] text-neutral-600">Chat</span>
        </button>
      );
    }
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

  const isWide = !embedded && width > 500;

  const chatContent = (
    <>
      {/* Session list — inline if wide, replaces chat if narrow */}
      {showHistory && isWide && (
        <SessionList
          sessions={sessions}
          activeId={activeSessionId}
          onSelect={handleSelectSession}
          onDeleteConfirm={setDeleteConfirm}
        />
      )}

      {showHistory && !isWide ? (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800">
            <span className="text-xs font-semibold text-neutral-400">History</span>
            <button
              onClick={() => setShowHistory(false)}
              className="ml-auto text-neutral-600 hover:text-neutral-400 text-xs"
            >
              Back
            </button>
          </div>
          <SessionList
            sessions={sessions}
            activeId={activeSessionId}
            onSelect={handleSelectSession}
            onDeleteConfirm={setDeleteConfirm}
            fullHeight
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Header */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-neutral-800">
            <button onClick={handleNewChat} className="text-neutral-600 hover:text-neutral-400 transition-colors" title="New chat">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            <button onClick={() => setShowHistory((v) => !v)} className={`transition-colors ${showHistory ? 'text-blue-400' : 'text-neutral-600 hover:text-neutral-400'}`} title="History">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
              </svg>
            </button>

            <span className="flex-1 text-[10px] text-neutral-500 truncate text-center">{activeSessionTitle}</span>

            <button onClick={handlePopout} className="text-neutral-600 hover:text-neutral-400 transition-colors" title="Pop out">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
            {isLoading && <div className="text-center text-neutral-600 text-xs py-4">Loading...</div>}

            {!isLoading && messages.length === 0 && (
              <div className="text-center text-neutral-600 text-xs py-8">
                Chat with {agent} agent
              </div>
            )}

            {messages.map((msg, idx) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                onEdit={() => handleEditMessage(idx)}
                onRetry={() => handleRetryMessage(idx)}
              />
            ))}

            {isThinking && streamingText && (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-lg px-3 py-2 text-xs break-words bg-neutral-800 text-neutral-300">
                  <MarkdownRenderer content={streamingText} />
                  {!streamingDone && <span className="inline-block w-1.5 h-3 bg-neutral-400 animate-pulse ml-0.5 align-middle" />}
                  {streamingDone && statusText && (
                    <div className="text-neutral-500 text-[10px] mt-1 animate-pulse">{statusText}</div>
                  )}
                </div>
              </div>
            )}

            {isThinking && !streamingText && (
              <div className="text-neutral-500 text-xs py-1">
                <span className="animate-pulse">{statusText || 'Thinking...'}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-3 py-2 border-t border-neutral-800">
            {/* Attached files */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-2">
                {attachedFiles.map((f) => (
                  <FileAttachmentCard key={f} filePath={f} onRemove={handleRemoveFile} />
                ))}
              </div>
            )}
            {/* Unified input container */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-2xl px-2 py-1.5 flex items-end gap-1">
              {!isRecording && (
                <button
                  type="button"
                  onClick={handleAttachFiles}
                  disabled={isThinking || !activeSessionId}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors shrink-0"
                  title="Attach file"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                </button>
              )}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? 'Говорите...' : isTranscribing ? 'Распознавание...' : 'Message...'}
                disabled={isThinking || isTranscribing || isRecording || !activeSessionId}
                rows={1}
                style={{ maxHeight: '200px', overflowY: 'auto', resize: 'none' }}
                className={`flex-1 bg-transparent text-neutral-200 px-2 py-1.5 text-xs outline-none border-none placeholder:text-neutral-600 disabled:opacity-50 ${isRecording ? 'opacity-40' : ''}`}
              />
              <button
                type="button"
                onClick={toggleRecording}
                disabled={isThinking || isTranscribing || !activeSessionId}
                className={`p-1.5 rounded-lg transition-all disabled:opacity-40 shrink-0 ${
                  isRecording
                    ? isSpeaking ? 'text-red-400 voice-wave' : 'text-red-400 ring-2 ring-red-500/50'
                    : isTranscribing ? 'text-yellow-400 animate-pulse' : 'text-neutral-500 hover:text-neutral-300'
                }`}
                title={isRecording ? 'Stop recording' : isTranscribing ? 'Распознавание...' : 'Voice input'}
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
              {!isRecording && (
                isThinking ? (
                  <button
                    type="button"
                    onClick={handleAbort}
                    className="w-[28px] h-[28px] shrink-0 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors"
                    title="Stop"
                  >
                    <Square className="w-2.5 h-2.5" fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim() || !activeSessionId}
                    className="w-[28px] h-[28px] shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center disabled:opacity-40 transition-colors"
                    title="Send"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                )
              )}
            </div>
            {/* Voice error toast */}
            {voiceError && (
              <div className="text-yellow-400 text-[10px] mt-1 px-1">{voiceError}</div>
            )}
          </form>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 max-w-xs" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-neutral-200 mb-4">Delete this chat?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded text-xs text-neutral-400 hover:bg-neutral-800">
                Cancel
              </button>
              <button onClick={() => handleDeleteSession(deleteConfirm)} className="px-3 py-1.5 rounded text-xs bg-red-600 text-white hover:bg-red-500">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Embedded mode: no width management, fills parent height
  if (embedded) {
    return (
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
        {chatContent}
      </div>
    );
  }

  // Standalone mode: manages own width with horizontal drag
  return (
    <div className="shrink-0 border-l border-neutral-800 flex bg-neutral-950/50" style={{ width }}>
      {/* Drag handle */}
      <div onMouseDown={handleMouseDown} className="w-1 cursor-col-resize hover:bg-blue-500/30 transition-colors" />
      {chatContent}
    </div>
  );
}

// --- Session List ---

function SessionList({
  sessions, activeId, onSelect, onDeleteConfirm, fullHeight,
}: {
  sessions: ChatSessionItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDeleteConfirm: (id: string | null) => void;
  fullHeight?: boolean;
}) {
  return (
    <div className={`${fullHeight ? 'flex-1' : 'w-44 border-r border-neutral-800'} overflow-y-auto`}>
      {sessions.length === 0 && (
        <div className="text-center text-neutral-600 text-xs py-4">No chats yet</div>
      )}
      {sessions.map((s) => (
        <div
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`group flex items-center gap-1 px-3 py-2 cursor-pointer text-xs transition-colors ${
            s.id === activeId ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800/50'
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="truncate">{s.title}</div>
            <div className="text-[10px] text-neutral-600">{formatDate(s.updated_at)}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteConfirm(s.id); }}
            className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all shrink-0"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// --- Chat Bubble ---

function ChatBubble({ message, onEdit, onRetry }: {
  message: Message;
  onEdit: () => void;
  onRetry: () => void;
}) {
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

  if (isUser) {
    return (
      <div className="flex justify-end group/msg">
        <div className="max-w-[90%]">
          {message.filePaths && message.filePaths.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-1.5 items-end">
              {message.filePaths.map((f) => <FileAttachmentCard key={f} filePath={f} />)}
            </div>
          )}
          <div className="rounded-lg px-3 py-2 text-xs break-words bg-blue-600/20 text-blue-100 whitespace-pre-wrap">
            {message.content}
          </div>
          <div className="flex justify-end opacity-0 group-hover/msg:opacity-100 transition-opacity">
            <UserMessageActions content={message.content} onEdit={onEdit} />
          </div>
        </div>
      </div>
    );
  }

  // Bot message
  const { text: rawContent, wasInterrupted } = stripInterrupted(message.content);
  const { cleanContent, filePaths: botFiles } = parseBotFileLinks(rawContent);

  return (
    <div className="flex justify-start group/msg">
      <div className="max-w-[90%]">
        <div className="rounded-lg px-3 py-2 text-xs break-words bg-neutral-800 text-neutral-300">
          {message.engine && (
            <span className={`text-[9px] font-medium mr-1 ${
              message.engine === 'claude-code' ? 'text-orange-400' : 'text-neutral-500'
            }`}>
              {message.engine === 'claude-code' ? 'CC' : 'API'}
            </span>
          )}
          <MarkdownRenderer content={cleanContent} />
          {wasInterrupted && <InterruptedBanner onRetry={onRetry} />}
        </div>
        {botFiles.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1.5">
            {botFiles.map((f) => <FileAttachmentCard key={f} filePath={f} />)}
          </div>
        )}
        <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity">
          <BotMessageActions content={rawContent} onRetry={onRetry} />
        </div>
      </div>
    </div>
  );
}

// --- Helpers ---

function toMessage(h: ChatHistoryItem): Message {
  return { id: h.id, role: h.role, content: h.content, engine: h.engine };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) {
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}
