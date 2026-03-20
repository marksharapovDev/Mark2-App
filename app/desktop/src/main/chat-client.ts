import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getSupabase } from './supabase-client';

export type AgentName = 'dev' | 'teaching' | 'study' | 'health' | 'finance' | 'general';

interface ChatHistoryRow {
  id: string;
  agent: string;
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

export async function loadHistory(agent: AgentName, limit = 20): Promise<ChatHistoryRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('agent', agent)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[ChatClient] loadHistory error:', error);
    return [];
  }

  return (data ?? []).reverse();
}

export async function saveMessage(
  agent: AgentName,
  role: 'user' | 'assistant',
  content: string,
  engine: 'api' | 'claude-code',
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('chat_messages')
    .insert({ agent, role, content, engine });

  if (error) {
    console.error('[ChatClient] saveMessage error:', error);
  }
}

export async function clearHistory(agent: AgentName): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('agent', agent);

  if (error) {
    console.error('[ChatClient] clearHistory error:', error);
  }
}

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

export async function sendToApi(agent: AgentName, message: string): Promise<string> {
  const model = process.env.CHAT_MODEL ?? 'anthropic/claude-haiku-4.5';
  const openai = getOpenAIClient();
  const systemPrompt = loadAgentSystemPrompt(agent);

  // Load recent history for context
  const history = await loadHistory(agent);
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
