import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getSupabase } from './supabase-client';

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

function loadAgentSystemPrompt(agent: AgentName): string {
  const claudeMdPath = path.join(AGENTS_DIR, agent, 'CLAUDE.md');
  try {
    return fs.readFileSync(claudeMdPath, 'utf-8');
  } catch {
    return `You are the ${agent} agent for Mark2. Respond in Russian.`;
  }
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

export async function sendToApi(
  agent: AgentName,
  sessionId: string,
  message: string,
): Promise<string> {
  const model = process.env.CHAT_MODEL ?? 'anthropic/claude-haiku-4.5';
  const openai = getOpenAIClient();
  const systemPrompt = loadAgentSystemPrompt(agent);

  const history = await getSessionMessages(sessionId, 20);
  const historyMessages: OpenAI.ChatCompletionMessageParam[] = history.map((row) => ({
    role: row.role as 'user' | 'assistant',
    content: row.content,
  }));

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: message },
    ],
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content ?? '';
}
