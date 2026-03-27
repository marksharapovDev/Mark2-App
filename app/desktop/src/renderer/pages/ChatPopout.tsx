import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Mic, Paperclip, ArrowUp, Square } from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { FileAttachmentCard, parseBotFileLinks } from '../components/FileAttachmentCard';

type AgentName = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'general';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  engine?: 'api' | 'claude-code';
  isNotification?: boolean;
  filePaths?: string[];
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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Listen for streaming events
  useEffect(() => {
    const unsubStart = window.chat.onStreamStart((sid) => {
      if (sid === sessionId) setStreamingText('');
    });
    const unsubUpdate = window.chat.onStreamUpdate((sid, text) => {
      if (sid === sessionId) setStreamingText(text);
    });
    const unsubEnd = window.chat.onStreamEnd((sid) => {
      if (sid === sessionId) setStreamingText(null);
    });
    return () => { unsubStart(); unsubUpdate(); unsubEnd(); };
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

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    const filesToSend = attachedFiles.length > 0 ? [...attachedFiles] : undefined;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: trimmed, filePaths: filesToSend }]);
    setInput('');
    setAttachedFiles([]);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsThinking(true);

    try {
      const response = await window.chat.send(agent, sessionId, trimmed, filesToSend);
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
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) return;
        setIsTranscribing(true);
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const text = await window.chat.transcribeAudio(arrayBuffer);
          if (text) setInput((prev) => (prev ? prev + ' ' + text : text));
        } catch (err) {
          console.error('[Voice] Transcription failed:', err);
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
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
        {messages.map((msg) => <PopoutBubble key={msg.id} message={msg} />)}
        {isThinking && streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm break-words bg-neutral-800 text-neutral-300">
              <MarkdownRenderer content={streamingText} />
              <span className="inline-block w-1.5 h-3.5 bg-neutral-400 animate-pulse ml-0.5 align-middle" />
            </div>
          </div>
        )}
        {isThinking && !streamingText && <div className="text-neutral-500 text-sm py-1"><span className="animate-pulse">Thinking...</span></div>}
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
        <div className="flex gap-1.5 items-end">
          <button
            type="button"
            onClick={handleAttachFiles}
            disabled={isThinking || !sessionId}
            className="p-2 rounded text-neutral-500 hover:text-neutral-300 disabled:opacity-40 transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isTranscribing ? 'Transcribing...' : 'Message...'}
            disabled={isThinking || isTranscribing || !sessionId}
            rows={1}
            style={{ maxHeight: '200px', overflowY: 'auto', resize: 'none' }}
            className="flex-1 bg-neutral-900 text-neutral-200 rounded-lg px-3 py-2 text-sm border border-neutral-700 focus:outline-none focus:border-neutral-500 placeholder:text-neutral-600 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isThinking || isTranscribing || !sessionId}
            className={`p-2 rounded transition-colors disabled:opacity-40 ${
              isRecording ? 'text-red-400 animate-pulse' : isTranscribing ? 'text-yellow-400 animate-pulse' : 'text-neutral-500 hover:text-neutral-300'
            }`}
            title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Voice input'}
          >
            <Mic className="w-4 h-4" />
          </button>
          {isThinking ? (
            <button
              type="button"
              onClick={handleAbort}
              className="w-9 h-9 shrink-0 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors"
              title="Stop"
            >
              <Square className="w-3.5 h-3.5" fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !sessionId}
              className="w-9 h-9 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center disabled:opacity-40 transition-colors"
              title="Send"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function PopoutBubble({ message }: { message: Message }) {
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
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          {message.filePaths && message.filePaths.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-1.5 items-end">
              {message.filePaths.map((f) => (
                <FileAttachmentCard key={f} filePath={f} />
              ))}
            </div>
          )}
          <div className="rounded-lg px-3 py-2 text-sm break-words bg-blue-600/20 text-blue-100 whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  const { cleanContent, filePaths: botFiles } = parseBotFileLinks(message.content);

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <div className="rounded-lg px-3 py-2 text-sm break-words bg-neutral-800 text-neutral-300">
          {message.engine && (
            <span className={`text-[10px] font-medium mr-1 ${message.engine === 'claude-code' ? 'text-orange-400' : 'text-neutral-500'}`}>
              {message.engine === 'claude-code' ? 'CC' : 'API'}
            </span>
          )}
          <MarkdownRenderer content={cleanContent} />
        </div>
        {botFiles.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1.5">
            {botFiles.map((f) => (
              <FileAttachmentCard key={f} filePath={f} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
