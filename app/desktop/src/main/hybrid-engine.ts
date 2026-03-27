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
import * as db from './db-service';
import type { ProcessedFiles } from './file-processor';

export type { AgentName };

// --- Interaction mode detection ---

export type InteractionMode = 'execute' | 'consult' | 'auto';

const EXECUTE_PHRASES = [
  'делай сразу', 'сделай сразу', 'без вопросов', 'не спрашивай',
  'just do it', 'do it now',
];

const CONSULT_PHRASES = [
  'задай вопросы', 'уточни', 'посоветуйся', 'спроси меня',
  'ask me', 'ask questions',
];

const ALL_MARKER_PHRASES = [...EXECUTE_PHRASES, ...CONSULT_PHRASES];

export function detectInteractionMode(message: string): InteractionMode {
  const lower = message.toLowerCase();
  if (EXECUTE_PHRASES.some((p) => lower.includes(p))) {
    const matched = EXECUTE_PHRASES.find((p) => lower.includes(p));
    console.log(`[HybridEngine] Interaction mode: execute (marker: "${matched}")`);
    return 'execute';
  }
  if (CONSULT_PHRASES.some((p) => lower.includes(p))) {
    const matched = CONSULT_PHRASES.find((p) => lower.includes(p));
    console.log(`[HybridEngine] Interaction mode: consult (marker: "${matched}")`);
    return 'consult';
  }
  console.log('[HybridEngine] Interaction mode: auto (no marker found)');
  return 'auto';
}

export function stripInteractionMarkers(message: string): string {
  let result = message;
  for (const phrase of ALL_MARKER_PHRASES) {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    result = result.replace(regex, '');
  }
  // Clean up leftover punctuation/whitespace: ". ." → ".", double spaces, trailing dots
  result = result.replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
  return result;
}

const MODE_PROMPTS: Record<InteractionMode, string> = {
  execute:
    'РЕЖИМ: Выполняй задачу сразу. Не задавай уточняющих вопросов. Если чего-то не хватает — прими разумное решение сам и сообщи что решил.',
  consult:
    'РЕЖИМ УТОЧНЕНИЯ: ТЫ ОБЯЗАН задать уточняющие вопросы перед выполнением. НЕ ВЫПОЛНЯЙ задачу в этом сообщении. Сначала задай 2-3 вопроса чтобы уточнить детали. НЕ используй ACTION теги в этом ответе. Только вопросы.',
  auto:
    'РЕЖИМ: Оцени задачу сам. Если задача простая и понятная — выполняй сразу. Если не хватает важной информации или задача сложная и неоднозначная — задай уточняющие вопросы перед выполнением.',
};

const CONSULT_EXECUTE_PROMPT =
  'Пользователь ответил на твои вопросы. Теперь ВЫПОЛНЯЙ задачу. Не задавай больше вопросов.';

export function getModePrompt(mode: InteractionMode, questionRound = 0): string {
  if (mode === 'consult' && questionRound >= 1) {
    return CONSULT_EXECUTE_PROMPT;
  }
  return MODE_PROMPTS[mode];
}

interface ActiveModeState {
  mode: InteractionMode;
  questionRound: number;
}

const EXECUTE_MARKER = '[EXECUTE_TASK]';

// --- Level 1: keyword check ---

// Data mutation verbs → skip Level 2, go straight to Claude Code
const DATA_ACTION_KEYWORDS = [
  // CRUD verbs
  'добавь', 'добавить', 'создай', 'создать',
  'удали', 'удалить', 'убери', 'убрать',
  'измени', 'изменить', 'обнови', 'обновить',
  'отметь', 'отметить', 'выполни', 'выполнить',
  'запланируй', 'запланировать',
  'оплати', 'оплатить', 'переведи', 'перевести',
  'запиши', 'записать', 'внеси', 'внести',
  // Specific entity phrases
  'добавь ученика', 'создай задачу', 'добавь событие',
  'добавь тренировку', 'добавь транзакцию', 'добавь предмет',
  'создай проект', 'создай событие', 'создай урок',
  // Implicit data creation (no verb, but implies creating entities)
  'новый ученик', 'новый студент', 'new student',
  'новая ученица', 'новый клиент',
  'провёл урок', 'провел урок', 'прошли тему', 'прошли урок',
  'план обучения', 'путь обучения',
  'запланируй урок', 'следующий урок',
  'у меня новый', 'у меня новая',
];

// Heavy tasks that need Level 2 classification
const TASK_KEYWORDS = [
  'сделай', 'сгенерируй', 'напиши', 'построй',
  'разработай', 'верстай', 'деплой', 'реализуй', 'запусти',
  'настрой', 'установи', 'отрефактори', 'исправь',
  'презентация', 'документ', 'файл', 'таблица',
  'курсовая', 'эссе', 'домашка', 'расчёт', 'реферат',
  'лабораторная', 'план урока', 'тест для',
];

function isDataAction(message: string): boolean {
  const lower = message.toLowerCase();
  return DATA_ACTION_KEYWORDS.some((kw) => lower.includes(kw));
}

function maybeHeavyTask(message: string): boolean {
  const lower = message.toLowerCase();
  return TASK_KEYWORDS.some((kw) => lower.includes(kw));
}

// --- Confirmation ---

const CONFIRM_WORDS = new Set([
  'делай', 'да', 'давай', 'запускай', 'ок', 'ok',
  'го', 'поехали', 'выполняй', 'начинай', 'да, делай',
]);

const CONFIRM_PREFIXES = [
  'да,', 'да ', 'ок,', 'ок ', 'давай,', 'давай ',
];

function isConfirmation(message: string): boolean {
  const trimmed = message.trim().toLowerCase().replace(/[.!,?]+$/, '');
  if (CONFIRM_WORDS.has(trimmed)) return true;
  // Match phrases like "да, удали", "да удаляй", "ок, делай"
  return CONFIRM_PREFIXES.some((p) => trimmed.startsWith(p));
}

const pendingTask = new Map<string, string>(); // sessionId -> prompt
const pendingConfirmations = new Map<string, PendingConfirmation>(); // sessionId -> pending destructive action
const activeMode = new Map<string, ActiveModeState>(); // sessionId -> persisted mode + question round

// --- Session context (per-session metadata from UI) ---

export interface SessionContext {
  studentId?: string;
}

const sessionContext = new Map<string, SessionContext>(); // sessionId -> context
const agentContext = new Map<string, SessionContext>(); // agent -> context

export function setSessionContext(sessionId: string, ctx: SessionContext): void {
  sessionContext.set(sessionId, ctx);
  console.log(`[HybridEngine] Session context set for ${sessionId}:`, ctx);
}

export function setAgentContext(agent: AgentName, ctx: SessionContext): void {
  agentContext.set(agent, ctx);
  console.log(`[HybridEngine] Agent context set for ${agent}:`, ctx);
}

async function buildTeachingContext(sessionId: string, agent: AgentName): Promise<string> {
  // Session-level context takes priority, then agent-level
  const ctx = sessionContext.get(sessionId) ?? agentContext.get(agent);
  if (!ctx?.studentId) return '';

  try {
    const students = await db.getStudents();
    const student = students.find((s) => s.id === ctx.studentId);
    if (!student) return '';

    const topics = await db.getLearningPath(ctx.studentId);
    if (topics.length === 0) {
      return `## Текущий ученик: ${student.name}\n\nПлан обучения пока не создан.\n`;
    }

    const lines = topics.map((t, i) => {
      let line = `${i + 1}. [id:${t.id}] ${t.title} — ${t.status}`;
      if (t.description) {
        line += `\n   Описание: ${t.description}`;
      }
      return line;
    });
    return `## Текущий план обучения: ${student.name}\n\n${lines.join('\n')}\n`;
  } catch (err) {
    console.error('[HybridEngine] Failed to load teaching context:', err);
    return '';
  }
}

async function processActions(text: string, opts?: { mode?: InteractionMode }): Promise<{
  cleanContent: string;
  actionSummary: string;
  changedEntities: string[];
  actionsCount: number;
  pendingConfirmation?: PendingConfirmation;
}> {
  const parsed = parseActions(text);
  if (parsed.length === 0) {
    return { cleanContent: text, actionSummary: '', changedEntities: [], actionsCount: 0 };
  }

  const skipConfirmation = opts?.mode === 'execute';
  const executions: ActionExecution[] = [];
  const summaryParts: string[] = [];
  let confirmation: PendingConfirmation | undefined;

  for (const p of parsed) {
    const exec = await executeAction(p, { skipConfirmation });
    executions.push(exec);

    if (exec.needsConfirmation) {
      // Build a human-readable description for the confirmation
      const desc = p.action === 'delete_task' ? `задачу`
        : p.action === 'delete_event' ? `событие`
        : p.action === 'delete_student' ? `ученика`
        : p.action === 'delete_learning_path_topic' ? `тему из плана обучения`
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

  return { cleanContent, actionSummary, changedEntities, actionsCount: parsed.length, pendingConfirmation: confirmation };
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
  mode: InteractionMode = 'auto',
  questionRound = 0,
  onChunk?: (accumulated: string) => void,
  files?: ProcessedFiles,
  signal?: AbortSignal,
): Promise<HybridResponse> {
  // Prepend cross-context + append mode instruction
  const modeInstruction = getModePrompt(mode, questionRound);
  // For Claude Code CLI: inject file content as text (no vision support)
  let fileContext = '';
  if (files) {
    const parts: string[] = [];
    if (files.textContent) parts.push(files.textContent);
    if (files.images.length > 0) {
      parts.push(`[${files.images.length} изображение(й) прикреплено — содержимое доступно только через API, не через CLI]`);
    }
    if (parts.length > 0) fileContext = parts.join('\n\n') + '\n\n---\n\n';
  }
  const fullPrompt = crossContext
    ? `${crossContext}\n\n---\n\n${fileContext}${prompt}\n\n${modeInstruction}`
    : `${fileContext}${prompt}\n\n${modeInstruction}`;
  const result = onChunk
    ? await claude.runStream({ agent, prompt: fullPrompt }, onChunk, signal)
    : await claude.run({ agent, prompt: fullPrompt });
  const content = result.trim();

  // In consult round 0: ignore any ACTION tags — this is the questions-only phase
  const skipActions = mode === 'consult' && questionRound === 0;

  const { cleanContent, actionSummary, changedEntities, pendingConfirmation } =
    skipActions
      ? { cleanContent: stripActions(content), actionSummary: '', changedEntities: [] as string[], pendingConfirmation: undefined }
      : await processActions(content, { mode });

  if (pendingConfirmation) {
    pendingConfirmations.set(sessionId, pendingConfirmation);
  }

  // Reset persisted mode after task completion (actions were executed)
  if (changedEntities.length > 0) {
    activeMode.delete(sessionId);
    console.log('[HybridEngine] Active mode reset after task completion');
  }

  const finalContent = actionSummary
    ? `${cleanContent}\n\n${actionSummary}`
    : cleanContent;

  await saveMessage(agent, sessionId, 'assistant', finalContent, 'claude-code');
  return {
    content: finalContent,
    engine: 'claude-code',
    notification: 'Executing via Claude Code...',
    changedEntities: changedEntities.length > 0 ? changedEntities : undefined,
    pendingConfirmation,
  };
}

function proposesTask(response: string): boolean {
  const lower = response.toLowerCase();
  const proposals = [
    'могу создать', 'могу сделать', 'могу написать', 'могу сгенерировать',
    'давай создам', 'давай сделаю', 'давай напишу',
    'хочешь, я создам', 'хочешь, я сделаю',
    'готов создать', 'готов сделать', 'готов написать',
    // Action plan phrases (Haiku proposing what it will do)
    'добавлю', 'создам', 'установлю', 'запишу', 'обновлю',
    'удалю', 'изменю', 'запланирую', 'отмечу', 'сохраню',
    'я добавлю', 'я создам', 'я запишу', 'я обновлю',
    'сейчас создам', 'сейчас добавлю', 'сейчас запишу',
  ];
  return proposals.some((p) => lower.includes(p));
}

// Active abort controllers per session
const abortControllers = new Map<string, AbortController>();

export function abortSession(sessionId: string): void {
  const controller = abortControllers.get(sessionId);
  if (controller) {
    controller.abort();
    abortControllers.delete(sessionId);
    console.log(`[HybridEngine] Aborted session ${sessionId}`);
  }
}

export async function sendMessage(
  agent: AgentName,
  sessionId: string,
  message: string,
  onChunk?: (accumulated: string) => void,
  files?: ProcessedFiles,
): Promise<HybridResponse> {
  // Create abort controller for this request
  const controller = new AbortController();
  abortControllers.set(sessionId, controller);
  const { signal } = controller;
  // Detect interaction mode before anything else
  const detectedMode = detectInteractionMode(message);
  const cleanMessage = stripInteractionMarkers(message);

  // Resolve effective mode: explicit marker overrides, otherwise persist from previous message
  let mode: InteractionMode;
  let questionRound = 0;
  if (detectedMode !== 'auto') {
    // Explicit marker in this message → set/overwrite active mode, reset round
    mode = detectedMode;
    activeMode.set(sessionId, { mode, questionRound: 0 });
  } else if (activeMode.has(sessionId)) {
    // No marker, but we have a persisted mode from a previous message in this chain
    const state = activeMode.get(sessionId)!;
    mode = state.mode;
    // Increment question round (user is replying to agent's questions)
    questionRound = state.questionRound + 1;
    activeMode.set(sessionId, { mode, questionRound });
    console.log(`[HybridEngine] Active mode persisted: ${mode} (questionRound: ${questionRound})`);
  } else {
    mode = 'auto';
  }

  await saveMessage(agent, sessionId, 'user', cleanMessage, 'api');

  // Build cross-context from other sessions/agents
  let crossContext = await buildCrossContext(agent);

  // Inject teaching-specific context (learning path of selected student)
  if (agent === 'teaching') {
    const teachingCtx = await buildTeachingContext(sessionId, agent);
    if (teachingCtx) {
      crossContext = crossContext
        ? `${teachingCtx}\n\n${crossContext}`
        : teachingCtx;
    }
  }

  console.log(`[HybridEngine] crossContext for ${agent}: ${crossContext.length} chars`);
  if (crossContext.length > 0) {
    console.log(`[HybridEngine] crossContext preview:\n${crossContext.slice(0, 300)}`);
  }

  // Check if user is confirming a destructive action
  const pendingConf = pendingConfirmations.get(sessionId);
  if (pendingConf && isConfirmation(cleanMessage)) {
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
  if (pending && isConfirmation(cleanMessage)) {
    pendingTask.delete(sessionId);
    return executeViaClaudeCode(agent, sessionId, pending, crossContext, mode, questionRound, onChunk, files, signal);
  }
  pendingTask.delete(sessionId);

  // Explicit mode (execute/consult) → always Claude Code
  // Claude Code is smart enough to ask questions in consult mode and execute in execute mode
  if (mode !== 'auto') {
    console.log(`[HybridEngine] Explicit mode "${mode}", routing to Claude Code`);
    return executeViaClaudeCode(agent, sessionId, cleanMessage, crossContext, mode, questionRound, onChunk, files, signal);
  }

  // Data action → straight to Claude Code (no Level 2 classification)
  if (isDataAction(cleanMessage)) {
    console.log('[HybridEngine] Data action detected, routing to Claude Code');
    return executeViaClaudeCode(agent, sessionId, cleanMessage, crossContext, mode, questionRound, onChunk, files, signal);
  }

  // Level 1 + 2: heavy tasks that need classification
  if (maybeHeavyTask(cleanMessage)) {
    const classification = await classifyMessage(cleanMessage);
    if (classification === 'TASK') {
      return executeViaClaudeCode(agent, sessionId, cleanMessage, crossContext, mode, questionRound, onChunk, files, signal);
    }
  }

  const apiResponse = await sendToApi(agent, sessionId, cleanMessage, crossContext, getModePrompt(mode, questionRound), onChunk, files, signal);

  console.log('[HybridEngine] Raw API response:', apiResponse.substring(0, 500));
  console.log('[HybridEngine] Contains ACTION tags:', apiResponse.includes('[ACTION:'));

  if (apiResponse.includes(EXECUTE_MARKER)) {
    const taskDescription = apiResponse.replace(EXECUTE_MARKER, '').trim();
    return executeViaClaudeCode(agent, sessionId, taskDescription || cleanMessage, crossContext, mode, questionRound, onChunk, files, signal);
  }

  // Process AI actions in the response
  const { cleanContent, actionSummary, changedEntities, actionsCount, pendingConfirmation } =
    await processActions(apiResponse, { mode });

  console.log('[HybridEngine] Actions found:', actionsCount);
  if (changedEntities.length > 0) {
    console.log('[HybridEngine] Changed entities:', changedEntities);
  }

  // Store pending confirmation for next message
  if (pendingConfirmation) {
    pendingConfirmations.set(sessionId, pendingConfirmation);
  }

  // Build final content
  const finalContent = actionSummary
    ? `${cleanContent}\n\n${actionSummary}`
    : cleanContent;

  if (proposesTask(finalContent)) {
    pendingTask.set(sessionId, cleanMessage);
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

  abortControllers.delete(sessionId);
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
  activeMode.delete(sessionId);
  sessionContext.delete(sessionId);
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
