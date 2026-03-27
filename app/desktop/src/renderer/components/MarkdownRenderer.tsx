import React, { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Split content into code blocks and regular text blocks
function splitBlocks(text: string): Array<{ type: 'code' | 'text'; content: string; lang?: string }> {
  const blocks: Array<{ type: 'code' | 'text'; content: string; lang?: string }> = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    blocks.push({ type: 'code', content: match[2] ?? '', lang: match[1] || undefined });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    blocks.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return blocks;
}

// Parse inline markdown elements
function parseInline(text: string): Array<string | React.ReactElement> {
  const elements: Array<string | React.ReactElement> = [];
  // Match: bold, italic, inline code, links
  const inlineRegex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold **text**
      elements.push(<strong key={key++} className="font-semibold text-neutral-100">{match[2]}</strong>);
    } else if (match[4]) {
      // Italic *text*
      elements.push(<em key={key++} className="italic">{match[4]}</em>);
    } else if (match[6]) {
      // Inline code `code`
      elements.push(
        <code key={key++} className="bg-neutral-700 text-orange-300 font-mono text-[0.85em] px-1 py-0.5 rounded">
          {match[6]}
        </code>,
      );
    } else if (match[8] && match[9]) {
      // Link [text](url)
      elements.push(
        <a key={key++} href={match[9]} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
          {match[8]}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}

// Parse a text block into lines with markdown formatting
function parseTextBlock(text: string): React.ReactElement[] {
  const lines = text.split('\n');
  const elements: React.ReactElement[] = [];
  let listItems: Array<{ ordered: boolean; content: string }> = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const isOrdered = listItems[0]?.ordered ?? false;
    const Tag = isOrdered ? 'ol' : 'ul';
    const listClass = isOrdered
      ? 'list-decimal list-inside space-y-0.5 ml-2 my-1'
      : 'list-disc list-inside space-y-0.5 ml-2 my-1';
    elements.push(
      <Tag key={key++} className={listClass}>
        {listItems.map((item, i) => (
          <li key={i}>{parseInline(item.content)}</li>
        ))}
      </Tag>,
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      flushList();
      elements.push(<hr key={key++} className="border-neutral-700 my-2" />);
      continue;
    }

    // Headers
    const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headerMatch) {
      flushList();
      const level = headerMatch[1]!.length;
      const content = headerMatch[2]!;
      const sizes = ['text-base font-medium', 'text-[15px] font-medium', 'text-sm font-medium'];
      elements.push(
        <div key={key++} className={`${sizes[level - 1]} text-neutral-100 mt-2 mb-1`}>
          {parseInline(content)}
        </div>,
      );
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (ulMatch) {
      if (listItems.length > 0 && listItems[0]?.ordered) flushList();
      listItems.push({ ordered: false, content: ulMatch[1]! });
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (olMatch) {
      if (listItems.length > 0 && !listItems[0]?.ordered) flushList();
      listItems.push({ ordered: true, content: olMatch[1]! });
      continue;
    }

    flushList();

    // Empty line
    if (trimmed === '') {
      elements.push(<div key={key++} className="h-1" />);
      continue;
    }

    // Regular text
    elements.push(<div key={key++}>{parseInline(trimmed)}</div>);
  }

  flushList();
  return elements;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const rendered = useMemo(() => {
    const blocks = splitBlocks(content);

    return blocks.map((block, i) => {
      if (block.type === 'code') {
        return (
          <pre
            key={i}
            className="bg-neutral-900 border border-neutral-700 rounded-md px-3 py-2 my-1.5 overflow-x-auto"
          >
            {block.lang && (
              <div className="text-[9px] text-neutral-500 mb-1 uppercase">{block.lang}</div>
            )}
            <code className="font-mono text-[0.85em] text-green-300 whitespace-pre">
              {block.content}
            </code>
          </pre>
        );
      }

      return <div key={i}>{parseTextBlock(block.content)}</div>;
    });
  }, [content]);

  return <div className={className}>{rendered}</div>;
}
