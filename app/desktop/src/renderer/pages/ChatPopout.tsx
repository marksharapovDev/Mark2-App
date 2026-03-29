import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Mic, Paperclip, ArrowUp, Square } from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { FileAttachmentCard, parseBotFileLinks } from '../components/FileAttachmentCard';
import { UserMessageActions, BotMessageActions, InterruptedBanner, stripInterrupted } from '../components/MessageActions';

type AgentName = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'general';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  engine?: 'api' | 'claude-code';
  isNotification?: boolean;
  filePaths?: string[];
  timestamp?: string;
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Listen for streaming events
  useEffect(() => {
    const unsubStart = window.chat.onStreamStart((sid) => {
      if (sid === sessionId) { setStreamingText(''); setIsThinking(true); }
    });
    const unsubUpdate = window.chat.onStreamUpdate((sid, text) => {
      if (sid === sessionId) setStreamingText(text);
    });
    const unsubEnd = window.chat.onStreamEnd((sid) => {
      if (sid === sessionId) { setStreamingDone(true); setStatusText(null); }
    });
    const unsubStatus = window.chat.onStatusUpdate((sid, status) => {
      if (sid === sessionId) setStatusText(status || null);
    });
    return () => { unsubStart(); unsubUpdate(); unsubEnd(); unsubStatus(); };
  }, [sessionId]);

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
        const [msgs, thinking] = await Promise.all([
          window.chat.getSessionMessages(latest.id),
          window.chat.isThinking(latest.id),
        ]);
        if (!cancelled) {
          setMessages(msgs.map((h) => ({ id: h.id, role: h.role, content: h.content, engine: h.engine, timestamp: h.created_at })));
          if (thinking) setIsThinking(true);
        }
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

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    const filesToSend = attachedFiles.length > 0 ? [...attachedFiles] : undefined;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: trimmed, filePaths: filesToSend, timestamp: new Date().toISOString() }]);
    setInput('');
    setAttachedFiles([]);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsThinking(true);

    try {
      const response = await window.chat.send(agent, sessionId, trimmed, filesToSend);
      if (response.notification) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: response.notification ?? '', engine: 'claude-code', isNotification: true, timestamp: new Date().toISOString() },
        ]);
      }
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: response.content, engine: response.engine, timestamp: new Date().toISOString() },
      ]);
      if (response.sessionTitle) setSessionTitle(response.sessionTitle);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${errorMsg}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setStreamingText(null);
      setStreamingDone(false);
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

      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        setIsSpeaking(dataArray.reduce((a, b) => a + b, 0) / dataArray.length > 10);
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

  const handleAttachFiles = useCallback(async () => {
    const paths = await window.electronAPI.openFiles();
    if (paths && paths.length > 0) setAttachedFiles((prev) => [...prev, ...paths]);
  }, []);

  const handleRemoveFile = useCallback((filePath: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f !== filePath));
  }, []);

  const handleEditMessage = useCallback((msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg || msg.role !== 'user') return;
    setMessages((prev) => {
      const next = [...prev];
      if (next[msgIndex + 1]?.role === 'assistant') next.splice(msgIndex + 1, 1);
      next.splice(msgIndex, 1);
      return next;
    });
    setInput(msg.content);
    if (msg.filePaths) setAttachedFiles(msg.filePaths);
    inputRef.current?.focus();
  }, [messages]);

  const handleRetryMessage = useCallback((msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg || !sessionId) return;
    let userMsg: Message | undefined;
    if (msg.role === 'assistant') {
      for (let i = msgIndex - 1; i >= 0; i--) { if (messages[i]?.role === 'user') { userMsg = messages[i]; break; } }
    } else { userMsg = msg; }
    if (!userMsg) return;
    setMessages((prev) => { const next = [...prev]; if (msg.role === 'assistant') next.splice(msgIndex, 1); return next; });
    setIsThinking(true);
    const retryText = userMsg.content + '\n\n(повторный запрос, дай другой ответ)';
    window.chat.send(agent, sessionId, retryText, userMsg.filePaths).then((response) => {
      if (response.notification) setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: response.notification ?? '', engine: 'claude-code', isNotification: true, timestamp: new Date().toISOString() }]);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: response.content, engine: response.engine, timestamp: new Date().toISOString() }]);
    }).catch((err) => {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`, timestamp: new Date().toISOString() }]);
    }).finally(() => { setStreamingText(null); setStreamingDone(false); setIsThinking(false); inputRef.current?.focus(); });
  }, [messages, sessionId, agent]);

  const handleAbort = useCallback(() => {
    if (sessionId) window.chat.abort(sessionId);
  }, [sessionId]);

  // Auto-resize textarea on programmatic input changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

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
        {messages.map((msg, idx) => (
          <PopoutBubble
            key={msg.id}
            message={msg}
            onEdit={() => handleEditMessage(idx)}
            onRetry={() => handleRetryMessage(idx)}
          />
        ))}
        {isThinking && streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm break-words bg-neutral-800 text-neutral-300">
              <MarkdownRenderer content={streamingText} />
              {!streamingDone && <span className="inline-block w-1.5 h-3.5 bg-neutral-400 animate-pulse ml-0.5 align-middle" />}
              {streamingDone && statusText && (
                <div className="text-neutral-500 text-[10px] mt-1 animate-pulse">{statusText}</div>
              )}
            </div>
          </div>
        )}
        {isThinking && !streamingText && <div className="text-neutral-500 text-sm py-1"><span className="animate-pulse">{statusText || 'Thinking...'}</span></div>}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-neutral-800">
        {attachedFiles.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-2">
            {attachedFiles.map((f) => (
              <FileAttachmentCard key={f} filePath={f} onRemove={handleRemoveFile} />
            ))}
          </div>
        )}
        {/* Unified input container */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-2xl px-3 py-2 flex items-end gap-1.5">
          {!isRecording && (
            <button
              type="button"
              onClick={handleAttachFiles}
              disabled={isThinking || !sessionId}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors shrink-0"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? 'Говорите...' : isTranscribing ? 'Распознавание...' : 'Message...'}
            disabled={isThinking || isTranscribing || isRecording || !sessionId}
            rows={1}
            style={{ maxHeight: '200px', overflowY: 'auto', resize: 'none' }}
            className={`flex-1 bg-transparent text-neutral-200 px-2 py-1.5 text-sm outline-none border-none placeholder:text-neutral-600 disabled:opacity-50 ${isRecording ? 'opacity-40' : ''}`}
          />
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isThinking || isTranscribing || !sessionId}
            className={`p-1.5 rounded-lg transition-all disabled:opacity-40 shrink-0 ${
              isRecording
                ? isSpeaking ? 'text-red-400 voice-wave' : 'text-red-400 ring-2 ring-red-500/50'
                : isTranscribing ? 'text-yellow-400 animate-pulse' : 'text-neutral-500 hover:text-neutral-300'
            }`}
            title={isRecording ? 'Stop recording' : isTranscribing ? 'Распознавание...' : 'Voice input'}
          >
            <Mic className="w-4 h-4" />
          </button>
          {!isRecording && (
            isThinking ? (
              <button
                type="button"
                onClick={handleAbort}
                className="w-8 h-8 shrink-0 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors"
                title="Stop"
              >
                <Square className="w-3 h-3" fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || !sessionId}
                className="w-8 h-8 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center disabled:opacity-40 transition-colors"
                title="Send"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )
          )}
        </div>
        {voiceError && (
          <div className="text-yellow-400 text-xs mt-1 px-1">{voiceError}</div>
        )}
      </form>
    </div>
  );
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (isToday) return time;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return `Вчера, ${time}`;
  return `${d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })}, ${time}`;
}

function PopoutBubble({ message, onEdit, onRetry }: { message: Message; onEdit: () => void; onRetry: () => void }) {
  const isUser = message.role === 'user';

  if (message.isNotification) {
    return (
      <div className="text-center py-0.5">
        <span className="text-xs text-orange-400 bg-orange-900/20 px-2 py-0.5 rounded-full">{message.content}</span>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end group/msg">
        <div className="max-w-[85%]">
          {message.filePaths && message.filePaths.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-1.5 items-end">
              {message.filePaths.map((f) => <FileAttachmentCard key={f} filePath={f} />)}
            </div>
          )}
          <div className="rounded-lg px-3 py-2 text-sm break-words bg-blue-600/20 text-blue-100 whitespace-pre-wrap">
            {message.content}
          </div>
          <div className="flex justify-end opacity-0 group-hover/msg:opacity-100 transition-opacity">
            <UserMessageActions content={message.content} onEdit={onEdit} timestamp={message.timestamp ? formatMessageTime(message.timestamp) : undefined} />
          </div>
        </div>
      </div>
    );
  }

  const { text: rawContent, wasInterrupted } = stripInterrupted(message.content);
  const { cleanContent, filePaths: botFiles } = parseBotFileLinks(rawContent);

  return (
    <div className="flex justify-start group/msg">
      <div className="max-w-[85%]">
        <div className="rounded-lg px-3 py-2 text-sm break-words bg-neutral-800 text-neutral-300">
          {message.engine && (
            <span className={`text-[10px] font-medium mr-1 ${message.engine === 'claude-code' ? 'text-orange-400' : 'text-neutral-500'}`}>
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
          <BotMessageActions content={rawContent} onRetry={onRetry} timestamp={message.timestamp ? formatMessageTime(message.timestamp) : undefined} />
        </div>
      </div>
    </div>
  );
}
