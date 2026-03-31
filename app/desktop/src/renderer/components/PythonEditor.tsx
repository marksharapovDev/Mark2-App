import { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Save, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

interface PythonEditorProps {
  filePath: string;
  fileName: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
}

export function PythonEditor({ filePath, fileName, initialContent, onSave }: PythonEditorProps) {
  const [code, setCode] = useState(initialContent);
  const [saved, setSaved] = useState(true);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<Array<{ type: 'stdout' | 'stderr' | 'info'; text: string }>>([]);
  const [stdinInput, setStdinInput] = useState('');
  const [showStdin, setShowStdin] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Sync when file changes
  useEffect(() => {
    setCode(initialContent);
    setSaved(true);
  }, [initialContent, filePath]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const lineCount = code.split('\n').length;

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newCode);
      setSaved(false);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      });
    }
    // Cmd/Ctrl+S to save
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    // Cmd/Ctrl+Enter to run
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleRun();
    }
  }, [code]);

  const handleSave = useCallback(async () => {
    await onSave(code);
    setSaved(true);
  }, [code, onSave]);

  const handleRun = useCallback(async () => {
    // Save first
    await onSave(code);
    setSaved(true);

    setRunning(true);
    setOutput((prev) => [...prev, { type: 'info', text: `▶ Запуск ${fileName}...` }]);

    try {
      const result = await window.python.runFile(filePath, stdinInput || undefined);

      if (result.stdout) {
        setOutput((prev) => [...prev, { type: 'stdout', text: result.stdout }]);
      }
      if (result.stderr) {
        setOutput((prev) => [...prev, { type: 'stderr', text: result.stderr }]);
      }

      const exitInfo = result.exitCode === null
        ? '⏱ Превышено время выполнения (30с)'
        : result.exitCode === 0
          ? '✓ Завершено успешно'
          : `✗ Код выхода: ${result.exitCode}`;

      setOutput((prev) => [...prev, {
        type: result.exitCode === 0 ? 'info' : 'stderr',
        text: exitInfo,
      }]);
    } catch (err) {
      setOutput((prev) => [...prev, {
        type: 'stderr',
        text: `Ошибка: ${err instanceof Error ? err.message : String(err)}`,
      }]);
    } finally {
      setRunning(false);
    }
  }, [code, filePath, fileName, stdinInput, onSave]);

  const clearOutput = useCallback(() => setOutput([]), []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-900/50 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-sm font-mono">🐍</span>
          <span className="text-sm text-neutral-300 font-mono">{fileName}</span>
          {!saved && <span className="text-[10px] text-yellow-500">● не сохранён</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            title="Сохранить (⌘S)"
          >
            <Save size={12} />
            Сохранить
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white transition-colors"
            title="Запустить (⌘Enter)"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {running ? 'Запуск...' : 'Запустить'}
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 flex bg-gray-950 overflow-hidden">
          {/* Line numbers */}
          <div className="py-2 px-2 text-right select-none border-r border-neutral-800 bg-gray-950 overflow-hidden shrink-0">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className="text-[11px] leading-[20px] text-neutral-600 font-mono">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => { setCode(e.target.value); setSaved(false); }}
            onKeyDown={handleKeyDown}
            className="flex-1 py-2 px-3 bg-gray-950 text-green-400 font-mono text-sm leading-[20px] resize-none focus:outline-none overflow-auto"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
          />
        </div>

        {/* Stdin input (collapsible) */}
        <div className="border-t border-neutral-800 shrink-0">
          <button
            onClick={() => setShowStdin(!showStdin)}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            {showStdin ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            Входные данные (stdin)
            {stdinInput && <span className="text-yellow-500/70 text-[10px]">есть данные</span>}
          </button>
          {showStdin && (
            <textarea
              value={stdinInput}
              onChange={(e) => setStdinInput(e.target.value)}
              placeholder="Данные для input()..."
              className="w-full px-3 pb-2 bg-neutral-950 text-neutral-300 font-mono text-xs resize-none focus:outline-none h-16"
              spellCheck={false}
            />
          )}
        </div>

        {/* Output panel */}
        <div className="border-t border-neutral-800 shrink-0 flex flex-col max-h-[40%]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900/50 shrink-0">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Вывод</span>
            <button
              onClick={clearOutput}
              className="flex items-center gap-1 text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              <Trash2 size={10} />
              Очистить
            </button>
          </div>
          <div
            ref={outputRef}
            className="flex-1 min-h-[80px] max-h-[200px] overflow-y-auto bg-black px-3 py-2 font-mono text-xs"
          >
            {output.length === 0 && (
              <div className="text-neutral-700">Нажмите ▶ Запустить или ⌘Enter</div>
            )}
            {output.map((line, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap ${
                  line.type === 'stderr' ? 'text-red-400'
                    : line.type === 'info' ? 'text-neutral-500 italic'
                      : 'text-neutral-200'
                }`}
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
