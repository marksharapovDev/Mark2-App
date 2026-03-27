import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getSupabase } from './supabase-client';
import { stripActions } from './ai-tools';

export type AgentName = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'general';

export interface ChatSessionRow {
  id: string;
  agent: string;
  title: string;
  summary: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  agent: string;
  session_id: string | null;
  role: string;
  content: string;
  engine: string;
  created_at: string;
}

const HOME = os.homedir();
const AGENTS_DIR = path.join(HOME, 'mark2', 'agents');

const HAIKU_BOUNDARY_INSTRUCTION =
  '\n\nВАЖНО: Ты НЕ выполняешь действия. Если пользователь просит создать, изменить, удалить что-то — ' +
  'скажи что передаёшь задачу основному агенту. Никогда не генерируй [ACTION:...] теги или function_calls.';

function loadAgentSystemPrompt(agent: AgentName): string {
  const claudeMdPath = path.join(AGENTS_DIR, agent, 'CLAUDE.md');
  let prompt: string;
  try {
    prompt = fs.readFileSync(claudeMdPath, 'utf-8');
  } catch {
    prompt = `You are the ${agent} agent for Mark2. Respond in Russian.`;
  }
  return prompt + HAIKU_BOUNDARY_INSTRUCTION;
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.CHAT_API_KEY;
  const baseURL = process.env.CHAT_API_URL;

  if (!apiKey) {
    throw new Error('CHAT_API_KEY must be set in .env');
  }

  return new OpenAI({
    apiKey,
    baseURL: baseURL || undefined,
  });
}

// === Sessions ===

export async function createSession(agent: AgentName): Promise<ChatSessionRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({ agent })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create session: ${error?.message}`);
  }

  return data as ChatSessionRow;
}

export async function getSessions(agent: AgentName): Promise<ChatSessionRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('agent', agent)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[ChatClient] getSessions error:', error);
    return [];
  }

  return (data ?? []) as ChatSessionRow[];
}

export async function deleteSession(sessionId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    console.error('[ChatClient] deleteSession error:', error);
  }
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('chat_sessions')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) {
    console.error('[ChatClient] updateSessionTitle error:', error);
  }
}

export async function updateSessionSummary(sessionId: string, summary: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('chat_sessions')
    .update({ summary, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) {
    console.error('[ChatClient] updateSessionSummary error:', error);
  }
}

// === Messages ===

export async function getSessionMessages(sessionId: string, limit = 50): Promise<ChatMessageRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[ChatClient] getSessionMessages error:', error);
    return [];
  }

  return ((data ?? []) as ChatMessageRow[]).reverse();
}

export async function saveMessage(
  agent: AgentName,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  engine: 'api' | 'claude-code',
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('chat_messages')
    .insert({ agent, session_id: sessionId, role, content, engine });

  if (error) {
    console.error('[ChatClient] saveMessage error:', error);
  }

  // Touch session updated_at
  await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);
}

// === AI helpers ===

export async function classifyMessage(message: string): Promise<'CHAT' | 'TASK'> {
  const model = process.env.CHAT_MODEL ?? 'anthropic/claude-haiku-4.5';
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'Определи: это простой вопрос/обсуждение или задача, ' +
          'требующая создания файлов/кода/документов/презентаций? ' +
          'Ответь ОДНИМ словом: CHAT или TASK',
      },
      { role: 'user', content: message },
    ],
    max_tokens: 10,
  });

  const answer = (response.choices[0]?.message?.content ?? '').trim().toUpperCase();
  return answer.includes('TASK') ? 'TASK' : 'CHAT';
}

export async function generateTitle(messages: ChatMessageRow[]): Promise<string> {
  const model = process.env.CHAT_MODEL ?? 'anthropic/claude-haiku-4.5';
  const openai = getOpenAIClient();

  const snippet = messages
    .slice(0, 4)
    .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'Дай короткое название (3-6 слов, без кавычек) для этого чата на основе диалога. Отвечай ТОЛЬКО название.',
      },
      { role: 'user', content: snippet },
    ],
    max_tokens: 30,
  });

  return (response.choices[0]?.message?.content ?? 'Chat').trim();
}

export async function generateSummary(messages: ChatMessageRow[]): Promise<string> {
  const model = process.env.CHAT_MODEL ?? 'anthropic/claude-haiku-4.5';
  const openai = getOpenAIClient();

  const snippet = messages
    .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'Сделай краткую сводку этого чата в 2-3 предложения на русском. Только ключевые моменты.',
      },
      { role: 'user', content: snippet },
    ],
    max_tokens: 200,
  });

  return (response.choices[0]?.message?.content ?? '').trim();
}

// === Cross-context ===

const ALL_AGENTS: AgentName[] = ['dev', 'teaching', 'study', 'health', 'finance', 'general'];

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'сегодня';
  if (diffDays === 1) return 'вчера';
  if (diffDays < 7) return `${diffDays} дн. назад`;
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

/**
 * Build a fallback snippet from the last 3 messages of a session.
 */
async function buildMessageFallback(sessionId: string): Promise<string> {
  const msgs = await getSessionMessages(sessionId, 3);
  if (msgs.length === 0) return '';
  return msgs
    .map((m) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 150)}`)
    .join(' | ');
}

export async function buildCrossContext(agent: AgentName): Promise<string> {
  const supabase = getSupabase();
  const parts: string[] = ['## Контекст из предыдущих чатов\n'];

  // 1. Last 5 sessions of CURRENT agent (with fallback)
  const { data: ownSessions } = await supabase
    .from('chat_sessions')
    .select('id, title, summary, updated_at')
    .eq('agent', agent)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (ownSessions && ownSessions.length > 0) {
    const ownLines: string[] = [];
    for (const s of ownSessions) {
      const date = formatRelativeDate(s.updated_at);
      const raw = s.summary ?? await buildMessageFallback(s.id);
      const text = raw ? stripActions(raw) : '';
      if (text) {
        ownLines.push(`- [${date}] ${text}`);
      }
    }
    if (ownLines.length > 0) {
      parts.push(`### Твой раздел (${agent}):`);
      parts.push(...ownLines);
      parts.push('');
    }
  }

  // 2. Last 3 sessions from EACH other agent (with fallback)
  const otherAgents = ALL_AGENTS.filter((a) => a !== agent);
  const otherParts: string[] = [];

  for (const other of otherAgents) {
    const { data: otherSessions } = await supabase
      .from('chat_sessions')
      .select('id, title, summary, updated_at')
      .eq('agent', other)
      .order('updated_at', { ascending: false })
      .limit(3);

    if (otherSessions && otherSessions.length > 0) {
      for (const s of otherSessions) {
        const date = formatRelativeDate(s.updated_at);
        const raw = s.summary ?? await buildMessageFallback(s.id);
        const text = raw ? stripActions(raw) : '';
        if (text) {
          otherParts.push(`- [${other}] [${date}] ${text}`);
        }
      }
    }
  }

  if (otherParts.length > 0) {
    parts.push('### Другие разделы:');
    parts.push(...otherParts);
    parts.push('');
  }

  // Return empty string if no context available
  if (parts.length <= 1) return '';

  return parts.join('\n');
}

/**
 * Generate summary for the active session of a given agent.
 * Called when user switches tabs (agents).
 */
export async function generateSummaryForActiveSession(agent: AgentName): Promise<void> {
  const supabase = getSupabase();

  // Find the most recent session for this agent
  const { data: sessions } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('agent', agent)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (!sessions || sessions.length === 0) return;

  const sessionId = sessions[0]!.id;
  const msgs = await getSessionMessages(sessionId, 50);

  if (msgs.length >= 4) {
    const summary = await generateSummary(msgs);
    await updateSessionSummary(sessionId, summary);
  }
}

/**
 * Backfill summaries for all sessions that have messages but no summary.
 * Returns number of sessions updated.
 */
export async function backfillAllSummaries(): Promise<number> {
  const supabase = getSupabase();

  const { data: sessions } = await supabase
    .from('chat_sessions')
    .select('id')
    .is('summary', null)
    .order('updated_at', { ascending: false });

  if (!sessions || sessions.length === 0) return 0;

  let count = 0;
  for (const session of sessions) {
    const msgs = await getSessionMessages(session.id, 50);
    if (msgs.length >= 2) {
      const summary = await generateSummary(msgs);
      await updateSessionSummary(session.id, summary);
      count++;
      console.log(`[ChatClient] backfill summary for ${session.id}: ${summary.slice(0, 60)}...`);
    }
  }

  return count;
}

interface FileAttachments {
  textContent: string;
  images: Array<{ base64: string; mediaType: string }>;
}

export async function sendToApi(
  agent: AgentName,
  sessionId: string,
  message: string,
  crossContext?: string,
  modePrompt?: string,
  onChunk?: (accumulated: string) => void,
  files?: FileAttachments,
  signal?: AbortSignal,
): Promise<string> {
  const model = process.env.CHAT_MODEL ?? 'anthropic/claude-haiku-4.5';
  const openai = getOpenAIClient();
  const systemPrompt = loadAgentSystemPrompt(agent);

  // Build system prompt: agent CLAUDE.md + cross-context + interaction mode
  let fullSystemPrompt = crossContext
    ? `${systemPrompt}\n\n${crossContext}`
    : systemPrompt;
  if (modePrompt) {
    fullSystemPrompt += `\n\n${modePrompt}`;
  }

  const history = await getSessionMessages(sessionId, 20);
  const historyMessages: OpenAI.ChatCompletionMessageParam[] = history.map((row) => ({
    role: row.role as 'user' | 'assistant',
    content: row.content,
  }));

  // Build user message: text + file content + images (multimodal)
  console.log('[sendToApi] files param:', files ? `textContent=${files.textContent.length}chars, images=${files.images.length}` : 'none');

  let userText = message;
  if (files?.textContent) {
    userText += '\n\n' + files.textContent;
  }

  let userContent: OpenAI.ChatCompletionUserMessageParam['content'];
  if (files?.images && files.images.length > 0) {
    // Multimodal message with images
    const parts: OpenAI.ChatCompletionContentPart[] = [];
    for (const img of files.images) {
      parts.push({
        type: 'image_url',
        image_url: {
          url: `data:${img.mediaType};base64,${img.base64}`,
        },
      });
    }
    parts.push({ type: 'text', text: userText });
    userContent = parts;
  } else {
    userContent = userText;
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: fullSystemPrompt },
    ...historyMessages,
    { role: 'user', content: userContent },
  ];

  // Use streaming if onChunk callback is provided
  if (onChunk) {
    const stream = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: 4096,
      stream: true,
    });

    let accumulated = '';
    try {
      for await (const chunk of stream) {
        if (signal?.aborted) break;
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
          onChunk(accumulated);
        }
      }
    } catch (err) {
      if (!signal?.aborted) throw err;
    }
    if (signal?.aborted) return accumulated + '\n\n(прервано)';
    return accumulated;
  }

  const response = await openai.chat.completions.create({
    model,
    messages,
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content ?? '';
}

// === Audio transcription (Whisper) ===

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const sttUrl = process.env.STT_API_URL || process.env.CHAT_API_URL;
  const sttKey = process.env.STT_API_KEY || process.env.CHAT_API_KEY;
  const sttModel = process.env.STT_MODEL || 'whisper-1';

  if (!sttKey) {
    throw new Error('No API key for transcription (STT_API_KEY or CHAT_API_KEY)');
  }

  const openai = new OpenAI({
    apiKey: sttKey,
    baseURL: sttUrl || undefined,
  });

  // Write buffer to temp file (OpenAI SDK expects a file)
  const tmpPath = path.join(os.tmpdir(), `mark2-audio-${Date.now()}.webm`);
  fs.writeFileSync(tmpPath, audioBuffer);

  try {
    const transcription = await openai.audio.transcriptions.create({
      model: sttModel,
      file: fs.createReadStream(tmpPath),
      language: 'ru',
    });
    return transcription.text;
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}
