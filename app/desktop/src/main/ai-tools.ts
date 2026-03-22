import * as db from './db-service';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import os from 'os';

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    return JSON.stringify(err);
  }
  return String(err);
}

interface ActionResult {
  success: boolean;
  message: string;
  entity: string;
  data?: Record<string, unknown>;
}

type ActionHandler = (params: Record<string, unknown>) => Promise<ActionResult>;

const DESTRUCTIVE_ACTIONS = new Set(['delete_task', 'delete_event', 'delete_student']);

function isDestructive(action: string): boolean {
  return DESTRUCTIVE_ACTIONS.has(action);
}

const AI_TOOLS: Record<string, ActionHandler> = {
  // Tasks
  create_task: async (params) => {
    const result = await db.createTask(params);
    return { success: true, message: `Задача создана: ${params.title}`, entity: 'tasks', data: result as unknown as Record<string, unknown> };
  },
  complete_task: async (params) => {
    const id = String(params.id);
    await db.updateTask(id, { status: 'done' });
    return { success: true, message: `Задача завершена`, entity: 'tasks' };
  },
  delete_task: async (params) => {
    const id = String(params.id);
    await db.deleteTask(id);
    return { success: true, message: `Задача удалена`, entity: 'tasks' };
  },

  // Calendar
  create_event: async (params) => {
    const result = await db.createCalendarEvent(params);
    return { success: true, message: `Событие создано: ${params.title}`, entity: 'events', data: result as unknown as Record<string, unknown> };
  },
  update_event: async (params) => {
    const id = String(params.id);
    const { id: _id, ...data } = params;
    await db.updateCalendarEvent(id, data);
    return { success: true, message: `Событие обновлено`, entity: 'events' };
  },
  delete_event: async (params) => {
    const id = String(params.id);
    await db.deleteCalendarEvent(id);
    return { success: true, message: `Событие удалено`, entity: 'events' };
  },

  // Projects
  create_project: async (params) => {
    const result = await db.createProject(params);
    return { success: true, message: `Проект создан: ${params.name}`, entity: 'projects', data: result as unknown as Record<string, unknown> };
  },

  // Students
  create_student: async (params) => {
    const result = await db.createStudent(params);
    return { success: true, message: `Ученик добавлен: ${params.name}`, entity: 'students', data: result as unknown as Record<string, unknown> };
  },
  update_student: async (params) => {
    const id = String(params.id);
    const { id: _id, ...data } = params;
    await db.updateStudent(id, data);
    return { success: true, message: `Данные ученика обновлены`, entity: 'students' };
  },
  delete_student: async (params) => {
    const id = String(params.id);
    await db.deleteStudent(id);
    return { success: true, message: `Ученик удалён`, entity: 'students' };
  },

  // Find student by name
  find_student: async (params) => {
    const name = String(params.name ?? '');
    const result = await db.findStudentByName(name);
    if (!result) {
      return { success: false, message: `Ученик "${name}" не найден`, entity: '' };
    }
    return { success: true, message: `Найден: ${result.name} (ID: ${result.id})`, entity: '', data: { id: result.id, name: result.name } };
  },

  // Subjects
  create_subject: async (params) => {
    const result = await db.createSubject(params);
    return { success: true, message: `Предмет добавлен: ${params.name}`, entity: 'subjects', data: result as unknown as Record<string, unknown> };
  },

  // Transactions
  add_transaction: async (params) => {
    const result = await db.createTransaction(params);
    return { success: true, message: `Транзакция записана: ${params.amount} ₽`, entity: 'transactions', data: result as unknown as Record<string, unknown> };
  },

  // Workouts
  add_workout: async (params) => {
    const result = await db.createWorkout(params);
    return { success: true, message: `Тренировка добавлена`, entity: 'workouts', data: result as unknown as Record<string, unknown> };
  },

  // Files
  save_file: async (params) => {
    const filePath = String(params.path ?? '');
    const content = String(params.content ?? '');
    if (!filePath) throw new Error('path is required');
    // Resolve relative to ~/mark2/
    const home = os.homedir();
    const fullPath = filePath.startsWith('/') ? filePath : resolve(home, 'mark2', filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
    return { success: true, message: `Файл сохранён: ${basename(fullPath)}`, entity: 'files', data: { path: fullPath } };
  },

  attach_file: async (params) => {
    console.log('[AI Tools] attach_file params:', JSON.stringify(params));
    const result = await db.createAttachedFile(params);
    return { success: true, message: `Файл прикреплён: ${params.filename}`, entity: 'files', data: result as unknown as Record<string, unknown> };
  },
};

const ACTION_REGEX = /\[ACTION:(\w+)\]([\s\S]*?)\[\/ACTION\]/g;

export interface ParsedAction {
  action: string;
  params: Record<string, unknown>;
  raw: string;
}

export interface ActionExecution {
  action: string;
  result: ActionResult;
  needsConfirmation: boolean;
}

export function parseActions(text: string): ParsedAction[] {
  const actions: ParsedAction[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(ACTION_REGEX.source, ACTION_REGEX.flags);
  while ((match = regex.exec(text)) !== null) {
    const action = match[1] ?? '';
    const jsonStr = match[2] ?? '{}';
    try {
      const params = JSON.parse(jsonStr) as Record<string, unknown>;
      actions.push({ action, params, raw: match[0] });
    } catch {
      // skip malformed JSON
    }
  }
  return actions;
}

export async function executeAction(parsed: ParsedAction): Promise<ActionExecution> {
  const handler = AI_TOOLS[parsed.action];
  if (!handler) {
    return {
      action: parsed.action,
      result: { success: false, message: `Неизвестное действие: ${parsed.action}`, entity: '' },
      needsConfirmation: false,
    };
  }

  if (isDestructive(parsed.action)) {
    return {
      action: parsed.action,
      result: { success: false, message: '', entity: '' },
      needsConfirmation: true,
    };
  }

  try {
    const result = await handler(parsed.params);
    return { action: parsed.action, result, needsConfirmation: false };
  } catch (err: unknown) {
    console.error('[AI Tools] Action failed:', parsed.action, err);
    const msg = formatError(err);
    return {
      action: parsed.action,
      result: { success: false, message: `Ошибка: ${msg}`, entity: '' },
      needsConfirmation: false,
    };
  }
}

export async function executeConfirmedAction(action: string, params: Record<string, unknown>): Promise<ActionResult> {
  const handler = AI_TOOLS[action];
  if (!handler) {
    return { success: false, message: `Неизвестное действие: ${action}`, entity: '' };
  }
  try {
    return await handler(params);
  } catch (err: unknown) {
    console.error('[AI Tools] Confirmed action failed:', action, err);
    const msg = formatError(err);
    return { success: false, message: `Ошибка: ${msg}`, entity: '' };
  }
}

export function stripActions(text: string): string {
  return text
    .replace(ACTION_REGEX, '')
    .replace(/```\s*```/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getChangedEntities(executions: ActionExecution[]): string[] {
  const entities = new Set<string>();
  for (const ex of executions) {
    if (ex.result.success && ex.result.entity) {
      entities.add(ex.result.entity);
    }
  }
  return [...entities];
}
