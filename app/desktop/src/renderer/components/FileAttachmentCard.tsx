import React, { useState, useEffect } from 'react';
import { FileText, Image, Code, File, ExternalLink } from 'lucide-react';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.html', '.css', '.json', '.yml', '.yaml', '.sh', '.sql', '.rs', '.go', '.java', '.c', '.cpp', '.rb']);
const PDF_EXTS = new Set(['.pdf']);
const WORD_EXTS = new Set(['.docx', '.doc']);
const EXCEL_EXTS = new Set(['.xlsx', '.xls', '.csv']);
const PPT_EXTS = new Set(['.pptx', '.ppt']);

function getFileTypeInfo(ext: string): { icon: React.ReactElement; label: string; bgColor: string } {
  if (IMAGE_EXTS.has(ext)) return {
    icon: <Image className="w-5 h-5 text-white" />,
    label: ext.replace('.', '').toUpperCase(),
    bgColor: 'bg-purple-600',
  };
  if (PDF_EXTS.has(ext)) return {
    icon: <FileText className="w-5 h-5 text-white" />,
    label: 'PDF',
    bgColor: 'bg-red-600',
  };
  if (WORD_EXTS.has(ext)) return {
    icon: <FileText className="w-5 h-5 text-white" />,
    label: 'Document',
    bgColor: 'bg-blue-600',
  };
  if (PPT_EXTS.has(ext)) return {
    icon: <FileText className="w-5 h-5 text-white" />,
    label: 'Presentation',
    bgColor: 'bg-orange-600',
  };
  if (EXCEL_EXTS.has(ext)) return {
    icon: <FileText className="w-5 h-5 text-white" />,
    label: 'Spreadsheet',
    bgColor: 'bg-green-600',
  };
  if (CODE_EXTS.has(ext)) return {
    icon: <Code className="w-5 h-5 text-white" />,
    label: ext.replace('.', '').toUpperCase(),
    bgColor: 'bg-emerald-600',
  };
  if (ext === '.md') return {
    icon: <FileText className="w-5 h-5 text-white" />,
    label: 'Markdown',
    bgColor: 'bg-neutral-600',
  };
  if (ext === '.txt') return {
    icon: <FileText className="w-5 h-5 text-white" />,
    label: 'Text',
    bgColor: 'bg-neutral-600',
  };
  return {
    icon: <File className="w-5 h-5 text-white" />,
    label: ext ? ext.replace('.', '').toUpperCase() : 'File',
    bgColor: 'bg-neutral-600',
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileAttachmentCardProps {
  filePath: string;
  onRemove?: (path: string) => void;
}

export function FileAttachmentCard({ filePath, onRemove }: FileAttachmentCardProps) {
  const fileName = filePath.split('/').pop() ?? filePath;
  const ext = ('.' + (fileName.split('.').pop() ?? '')).toLowerCase();
  const { icon, label, bgColor } = getFileTypeInfo(ext);
  const isImage = IMAGE_EXTS.has(ext);

  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);

  useEffect(() => {
    // Get file size via IPC
    window.electronAPI.getFileInfo(filePath).then((info) => {
      if (info) setFileSize(formatSize(info.size));
    }).catch(() => {});

    // Load image thumbnail
    if (isImage) {
      window.electronAPI.readFileBase64(filePath).then((data) => {
        if (data) setThumbnail(`data:image/${ext.replace('.', '')};base64,${data}`);
      }).catch(() => {});
    }
  }, [filePath, ext, isImage]);

  return (
    <div
      className="flex items-center gap-2.5 bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 w-[280px] cursor-pointer hover:bg-neutral-750 hover:border-neutral-600 transition-colors group"
      onClick={() => window.electronAPI.openFile(filePath)}
    >
      {/* Icon or thumbnail */}
      {thumbnail ? (
        <img src={thumbnail} alt={fileName} className="w-10 h-10 rounded-lg object-cover shrink-0" />
      ) : (
        <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
      )}

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-neutral-200 truncate">{fileName}</div>
        <div className="text-xs text-neutral-500">
          {label}{fileSize ? ` \u00B7 ${fileSize}` : ''}
        </div>
      </div>

      {/* Actions */}
      {onRemove ? (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(filePath); }}
          className="shrink-0 text-neutral-600 hover:text-neutral-300 transition-colors p-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      ) : (
        <ExternalLink className="w-3.5 h-3.5 shrink-0 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
      )}
    </div>
  );
}

/** Extracts file paths from user display content like "text\n\n📎 file1.txt, file2.pdf" */
export function parseUserAttachments(content: string): { text: string; filePaths: string[] } {
  const clipMatch = content.match(/\n\n📎\s*(.+)$/);
  if (!clipMatch) return { text: content, filePaths: [] };

  const text = content.slice(0, content.indexOf('\n\n📎')).trim();
  // These are just display names, not full paths - we can't reconstruct full paths
  // So we return the names for display purposes
  return { text, filePaths: [] };
}

/** Extracts file paths from bot text like "✅ Файл сохранён: /path/to/file.ext" */
export function parseBotFileLinks(content: string): { cleanContent: string; filePaths: string[] } {
  const FILE_SAVED_RE = /✅\s*(?:Файл\s+(?:сохранён|прикреплён|создан)|File\s+saved):\s*(.+?)(?:\n|$)/g;
  const filePaths: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = FILE_SAVED_RE.exec(content)) !== null) {
    const p = (match[1] ?? '').trim();
    if (p) filePaths.push(p);
  }

  let cleanContent = content.replace(FILE_SAVED_RE, '');
  // Strip inline absolute paths and agents/... paths (already shown as file cards)
  cleanContent = cleanContent
    .replace(/`\/Users\/[^`]+`/g, '')
    .replace(/`agents\/[^`]+`/g, '')
    .replace(/(?:\/Users\/\S+\/mark2\/)(agents\/\S+)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { cleanContent, filePaths };
}
