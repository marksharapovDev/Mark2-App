import {
  sendToApi, classifyMessage, saveMessage,
  getSessionMessages, generateTitle, generateSummary,
  updateSessionTitle, updateSessionSummary,
  createSession, getSessions, deleteSession,
  buildCrossContext, generateSummaryForActiveSession,
  backfillAllSummaries,
  type ChatSessionRow, type ChatMessageRow,
} from './chat-client';
import { claude } from './claude-bridge';
import type { AgentName } from './claude-bridge';
import {
  parseActions, executeAction, executeConfirmedAction,
  stripActions, getChangedEntities,
  type ActionExecution,
} from './ai-tools';

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
const pendingConfirmations = new Map<string, PendingConfirmation>(); // sessionId -> pending destructive action

async function processActions(text: string): Promise<{
  cleanContent: string;
  actionSummary: string;
  changedEntities: string[];
  pendingConfirmation?: PendingConfirmation;
}> {
  const parsed = parseActions(text);
  if (parsed.length === 0) {
    return { cleanContent: text, actionSummary: '', changedEntities: [] };
  }

  const executions: ActionExecution[] = [];
  const summaryParts: string[] = [];
  let confirmation: PendingConfirmation | undefined;

  for (const p of parsed) {
    const exec = await executeAction(p);
    executions.push(exec);

    if (exec.needsConfirmation) {
      // Build a human-readable description for the confirmation
      const desc = p.action === 'delete_task' ? `задачу`
        : p.action === 'delete_event' ? `событие`
        : p.action === 'delete_student' ? `ученика`
        : `объект`;
      confirmation = {
        action: p.action,
        params: p.params,
        description: `Удалить ${desc}?`,
      };
      summaryParts.push(`⏳ Требуется подтверждение: ${confirmation.description}`);
    } else if (exec.result.success) {
      summaryParts.push(`✅ ${exec.result.message}`);
    } else {
      summaryParts.push(`❌ ${exec.result.message}`);
    }
  }

  const cleanContent = stripActions(text);
  const actionSummary = summaryParts.join('\n');
  const changedEntities = getChangedEntities(executions);

  return { cleanContent, actionSummary, changedEntities, pendingConfirmation: confirmation };
}

export interface PendingConfirmation {
  action: string;
  params: Record<string, unknown>;
  description: string;
}

export interface HybridResponse {
  content: string;
  engine: 'api' | 'claude-code';
  notification?: string;
  sessionTitle?: string;
  changedEntities?: string[];
  pendingConfirmation?: PendingConfirmation;
}

async function executeViaClaudeCode(
  agent: AgentName,
  sessionId: string,
  prompt: string,
  crossContext?: string,
): Promise<HybridResponse> {
  // Prepend cross-context before the main task prompt
  const fullPrompt = crossContext
    ? `${crossContext}\n\n---\n\n${prompt}`
    : prompt;
  const result = await claude.run({ agent, prompt: fullPrompt });
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

  // Build cross-context from other sessions/agents
  const crossContext = await buildCrossContext(agent);
  console.log(`[HybridEngine] crossContext for ${agent}: ${crossContext.length} chars`);
  if (crossContext.length > 0) {
    console.log(`[HybridEngine] crossContext preview:\n${crossContext.slice(0, 300)}`);
  }

  // Check if user is confirming a destructive action
  const pendingConf = pendingConfirmations.get(sessionId);
  if (pendingConf && isConfirmation(message)) {
    pendingConfirmations.delete(sessionId);
    const actionResult = await executeConfirmedAction(pendingConf.action, pendingConf.params);
    const confirmContent = actionResult.success
      ? `✅ ${actionResult.message}`
      : `❌ ${actionResult.message}`;
    await saveMessage(agent, sessionId, 'assistant', confirmContent, 'api');
    return {
      content: confirmContent,
      engine: 'api',
      changedEntities: actionResult.success && actionResult.entity ? [actionResult.entity] : [],
    };
  }
  if (pendingConf) {
    // User said something other than confirm — cancel the action
    pendingConfirmations.delete(sessionId);
  }

  // Check task confirmation
  const pending = pendingTask.get(sessionId);
  if (pending && isConfirmation(message)) {
    pendingTask.delete(sessionId);
    return executeViaClaudeCode(agent, sessionId, pending, crossContext);
  }
  pendingTask.delete(sessionId);

  // Level 1 + 2
  if (maybeHeavyTask(message)) {
    const classification = await classifyMessage(message);
    if (classification === 'TASK') {
      return executeViaClaudeCode(agent, sessionId, message, crossContext);
    }
  }

  const apiResponse = await sendToApi(agent, sessionId, message, crossContext);

  if (apiResponse.includes(EXECUTE_MARKER)) {
    const taskDescription = apiResponse.replace(EXECUTE_MARKER, '').trim();
    return executeViaClaudeCode(agent, sessionId, taskDescription || message, crossContext);
  }

  // Process AI actions in the response
  const { cleanContent, actionSummary, changedEntities, pendingConfirmation } =
    await processActions(apiResponse);

  // Store pending confirmation for next message
  if (pendingConfirmation) {
    pendingConfirmations.set(sessionId, pendingConfirmation);
  }

  // Build final content
  const finalContent = actionSummary
    ? `${cleanContent}\n\n${actionSummary}`
    : cleanContent;

  if (proposesTask(finalContent)) {
    pendingTask.set(sessionId, message);
  }

  await saveMessage(agent, sessionId, 'assistant', finalContent, 'api');

  // Auto-title after 2nd message (4 rows = 2 user + 2 assistant)
  const result: HybridResponse = {
    content: finalContent,
    engine: 'api',
    changedEntities: changedEntities.length > 0 ? changedEntities : undefined,
    pendingConfirmation,
  };
  const msgs = await getSessionMessages(sessionId, 50);
  if (msgs.length === 4) {
    const title = await generateTitle(msgs);
    await updateSessionTitle(sessionId, title);
    result.sessionTitle = title;
  }

  // Auto-summary every 10 messages (5 user + 5 assistant)
  if (msgs.length > 0 && msgs.length % 10 === 0) {
    const summary = await generateSummary(msgs);
    await updateSessionSummary(sessionId, summary);
    console.log(`[HybridEngine] auto-summary for session ${sessionId}: ${summary.slice(0, 80)}...`);
  }

  return result;
}

// === Session management ===

export async function handleCreateSession(agent: AgentName, fromSessionId?: string): Promise<ChatSessionRow> {
  // Generate summary for the previous active session before creating a new one
  if (fromSessionId) {
    const oldMsgs = await getSessionMessages(fromSessionId, 50);
    if (oldMsgs.length >= 2) {
      const summary = await generateSummary(oldMsgs);
      await updateSessionSummary(fromSessionId, summary);
      console.log(`[HybridEngine] summary on new-chat for session ${fromSessionId}: ${summary.slice(0, 80)}...`);
    }
  }
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

/**
 * Called when user switches tabs (agents) in the header.
 * Generates summary for the active session of the previous agent
 * so cross-context is always up to date.
 */
export async function handleAgentSwitch(fromAgent: AgentName): Promise<void> {
  await generateSummaryForActiveSession(fromAgent);
}

export async function handleBackfillSummaries(): Promise<number> {
  return backfillAllSummaries();
}
