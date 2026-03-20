import { sendToApi, classifyMessage, saveMessage, loadHistory, clearHistory } from './chat-client';
import { claude } from './claude-bridge';
import type { AgentName } from './claude-bridge';

export type { AgentName };

const EXECUTE_MARKER = '[EXECUTE_TASK]';

// --- Level 1: keyword check (fast, free) ---

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

// --- Confirmation words (user confirming a previous proposal) ---

const CONFIRM_WORDS = new Set([
  'делай', 'да', 'давай', 'запускай', 'ок', 'ok',
  'го', 'поехали', 'выполняй', 'начинай', 'да, делай',
]);

function isConfirmation(message: string): boolean {
  const trimmed = message.trim().toLowerCase().replace(/[.!,?]+$/, '');
  return CONFIRM_WORDS.has(trimmed);
}

// Track whether last assistant message proposed a task
const pendingTask = new Map<AgentName, string>();

export interface HybridResponse {
  content: string;
  engine: 'api' | 'claude-code';
  notification?: string;
}

async function executeViaClaudeCode(
  agent: AgentName,
  prompt: string,
): Promise<HybridResponse> {
  const result = await claude.run({ agent, prompt });
  const content = result.trim();
  await saveMessage(agent, 'assistant', content, 'claude-code');
  return {
    content,
    engine: 'claude-code',
    notification: 'Выполняю задачу через Claude Code...',
  };
}

export async function sendMessage(agent: AgentName, message: string): Promise<HybridResponse> {
  // Save user message
  await saveMessage(agent, 'user', message, 'api');

  // Check if user is confirming a pending task from previous Haiku response
  const pending = pendingTask.get(agent);
  if (pending && isConfirmation(message)) {
    pendingTask.delete(agent);
    return executeViaClaudeCode(agent, pending);
  }
  pendingTask.delete(agent);

  // Level 1: quick keyword check
  if (maybeHeavyTask(message)) {
    // Level 2: ask Haiku to classify (~0.001$, ~0.5s)
    const classification = await classifyMessage(message);

    if (classification === 'TASK') {
      return executeViaClaudeCode(agent, message);
    }
  }

  // Default: send to API (Haiku)
  const apiResponse = await sendToApi(agent, message);

  // If API response contains execute marker — delegate to Claude Code
  if (apiResponse.includes(EXECUTE_MARKER)) {
    const taskDescription = apiResponse.replace(EXECUTE_MARKER, '').trim();
    const prompt = taskDescription || message;
    return executeViaClaudeCode(agent, prompt);
  }

  // Check if Haiku proposed creating something — save as pending
  if (proposesTask(apiResponse)) {
    pendingTask.set(agent, message);
  }

  await saveMessage(agent, 'assistant', apiResponse, 'api');
  return { content: apiResponse, engine: 'api' };
}

/** Detect if Haiku's response proposes creating files/code/documents */
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

export async function getHistory(agent: AgentName) {
  const rows = await loadHistory(agent, 50);
  return rows.map((row) => ({
    id: row.id,
    agent: row.agent,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    engine: row.engine as 'api' | 'claude-code',
    createdAt: row.created_at,
  }));
}

export async function clearChat(agent: AgentName): Promise<void> {
  pendingTask.delete(agent);
  await clearHistory(agent);
}
