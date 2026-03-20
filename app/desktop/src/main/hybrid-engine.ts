import {
  sendToApi, classifyMessage, saveMessage,
  getSessionMessages, generateTitle, generateSummary,
  updateSessionTitle, updateSessionSummary,
  createSession, getSessions, deleteSession,
  type ChatSessionRow, type ChatMessageRow,
} from './chat-client';
import { claude } from './claude-bridge';
import type { AgentName } from './claude-bridge';

export type { AgentName };

const EXECUTE_MARKER = '[EXECUTE_TASK]';

// --- Level 1: keyword check ---

const TASK_KEYWORDS = [
  'создай', 'сделай', 'сгенерируй', 'напиши', 'построй',
  'разработай', 'верстай', 'деплой', 'реализуй', 'запусти',
  'настрой', 'установи', 'отрефактори', 'исправь',
  'презентация', 'документ', 'файл', 'таблица',
  'курсовая', 'эссе', 'домашка', 'расчёт', 'реферат',
  'лабораторная', 'план урока', 'тест для',
];

function maybeHeavyTask(message: string): boolean {
  const lower = message.toLowerCase();
  return TASK_KEYWORDS.some((kw) => lower.includes(kw));
}

// --- Confirmation ---

const CONFIRM_WORDS = new Set([
  'делай', 'да', 'давай', 'запускай', 'ок', 'ok',
  'го', 'поехали', 'выполняй', 'начинай', 'да, делай',
]);

function isConfirmation(message: string): boolean {
  const trimmed = message.trim().toLowerCase().replace(/[.!,?]+$/, '');
  return CONFIRM_WORDS.has(trimmed);
}

const pendingTask = new Map<string, string>(); // sessionId -> prompt

export interface HybridResponse {
  content: string;
  engine: 'api' | 'claude-code';
  notification?: string;
  sessionTitle?: string;
}

async function executeViaClaudeCode(
  agent: AgentName,
  sessionId: string,
  prompt: string,
): Promise<HybridResponse> {
  const result = await claude.run({ agent, prompt });
  const content = result.trim();
  await saveMessage(agent, sessionId, 'assistant', content, 'claude-code');
  return {
    content,
    engine: 'claude-code',
    notification: 'Executing via Claude Code...',
  };
}

function proposesTask(response: string): boolean {
  const lower = response.toLowerCase();
  const proposals = [
    'могу создать', 'могу сделать', 'могу написать', 'могу сгенерировать',
    'давай создам', 'давай сделаю', 'давай напишу',
    'хочешь, я создам', 'хочешь, я сделаю',
    'готов создать', 'готов сделать', 'готов написать',
  ];
  return proposals.some((p) => lower.includes(p));
}

export async function sendMessage(
  agent: AgentName,
  sessionId: string,
  message: string,
): Promise<HybridResponse> {
  await saveMessage(agent, sessionId, 'user', message, 'api');

  // Check confirmation
  const pending = pendingTask.get(sessionId);
  if (pending && isConfirmation(message)) {
    pendingTask.delete(sessionId);
    return executeViaClaudeCode(agent, sessionId, pending);
  }
  pendingTask.delete(sessionId);

  // Level 1 + 2
  if (maybeHeavyTask(message)) {
    const classification = await classifyMessage(message);
    if (classification === 'TASK') {
      return executeViaClaudeCode(agent, sessionId, message);
    }
  }

  const apiResponse = await sendToApi(agent, sessionId, message);

  if (apiResponse.includes(EXECUTE_MARKER)) {
    const taskDescription = apiResponse.replace(EXECUTE_MARKER, '').trim();
    return executeViaClaudeCode(agent, sessionId, taskDescription || message);
  }

  if (proposesTask(apiResponse)) {
    pendingTask.set(sessionId, message);
  }

  await saveMessage(agent, sessionId, 'assistant', apiResponse, 'api');

  // Auto-title after 2nd message (4 rows = 2 user + 2 assistant)
  const result: HybridResponse = { content: apiResponse, engine: 'api' };
  const msgs = await getSessionMessages(sessionId, 6);
  if (msgs.length === 4) {
    const title = await generateTitle(msgs);
    await updateSessionTitle(sessionId, title);
    result.sessionTitle = title;
  }

  return result;
}

// === Session management ===

export async function handleCreateSession(agent: AgentName): Promise<ChatSessionRow> {
  return createSession(agent);
}

export async function handleGetSessions(agent: AgentName): Promise<ChatSessionRow[]> {
  return getSessions(agent);
}

export async function handleDeleteSession(sessionId: string): Promise<void> {
  pendingTask.delete(sessionId);
  await deleteSession(sessionId);
}

export async function handleSwitchSession(
  fromSessionId: string | null,
  toSessionId: string,
): Promise<ChatMessageRow[]> {
  // Generate summary for old session before switching
  if (fromSessionId) {
    const oldMsgs = await getSessionMessages(fromSessionId, 50);
    if (oldMsgs.length >= 4) {
      const summary = await generateSummary(oldMsgs);
      await updateSessionSummary(fromSessionId, summary);
    }
  }

  return getSessionMessages(toSessionId, 50);
}

export async function handleGetSessionMessages(sessionId: string): Promise<ChatMessageRow[]> {
  return getSessionMessages(sessionId, 50);
}
