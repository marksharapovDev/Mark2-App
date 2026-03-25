import * as db from './db-service';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import os from 'os';
import {
  Document, Packer, Paragraph, TextRun,
  HeadingLevel, AlignmentType,
} from 'docx';

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    return JSON.stringify(err);
  }
  return String(err);
}

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// --- Latin → Cyrillic transliteration for student name matching ---

const LAT_TO_CYR: Record<string, string> = {
  'shch': 'щ', 'sch': 'щ',
  'yo': 'ё', 'zh': 'ж', 'ch': 'ч', 'sh': 'ш', 'kh': 'х',
  'yu': 'ю', 'ya': 'я', 'ts': 'ц', 'ey': 'ей',
  'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д',
  'e': 'е', 'z': 'з', 'i': 'и', 'y': 'ы',
  'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о',
  'p': 'п', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у',
  'f': 'ф', 'h': 'х', 'j': 'й', 'x': 'кс',
};

function transliterate(latin: string): string {
  let result = '';
  let i = 0;
  const lower = latin.toLowerCase();
  while (i < lower.length) {
    // Try 4, 3, 2, 1 char sequences
    let matched = false;
    for (const len of [4, 3, 2, 1]) {
      const chunk = lower.substring(i, i + len);
      if (LAT_TO_CYR[chunk]) {
        result += LAT_TO_CYR[chunk];
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      result += lower[i];
      i++;
    }
  }
  return result;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Cyrillic → Latin transliteration for subject slugs ---

const CYR_TO_LAT: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
};

function toSubjectSlug(name: string): string {
  return name
    .toLowerCase()
    .split('')
    .map((ch) => CYR_TO_LAT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function ensureSubjectFolders(subjectSlug: string): string {
  const home = os.homedir();
  const base = resolve(home, 'mark2', 'agents', 'study', 'context', 'subjects', subjectSlug);
  const subdirs = ['notes', 'summaries', 'assignments', 'materials', 'exams', 'templates'];
  for (const dir of subdirs) {
    mkdirSync(resolve(base, dir), { recursive: true });
  }
  return base;
}

/**
 * Try to extract a student name from a filename like "dz_liza_morozova_drobi.md"
 * and look them up in the DB.
 *
 * Strategy:
 * 1. Strip known prefixes (dz_, plan_, material_, test_) and extension
 * 2. Split by _ into words
 * 3. Try each consecutive pair as "firstName lastName"
 * 4. Search DB with both Latin and Cyrillic transliteration
 */
async function tryResolveStudentFromFilename(filename: string): Promise<{ id: string; name: string } | null> {
  // Strip extension
  let base = filename.replace(/\.[^.]+$/, '');
  // Strip common prefixes
  base = base.replace(/^(dz|plan|material|test|homework|lesson|notes|solution)_/i, '');
  const parts = base.split(/[_\-]+/).filter((p) => p.length >= 2);

  // Try consecutive pairs (most likely "firstname lastname")
  for (let i = 0; i < parts.length - 1; i++) {
    const latName = `${parts[i]} ${parts[i + 1]}`;
    const cyrName = `${capitalize(transliterate(parts[i]!))} ${capitalize(transliterate(parts[i + 1]!))}`;

    console.log(`[AI Tools] Trying student name: "${latName}" / "${cyrName}"`);

    // Try cyrillic first (more likely in DB)
    let student = await db.findStudentByName(cyrName);
    if (student) return { id: student.id, name: student.name };

    // Try latin (in case DB has latin names)
    student = await db.findStudentByName(latName);
    if (student) return { id: student.id, name: student.name };
  }

  // Fallback: try single words (maybe just first name is enough)
  for (const part of parts) {
    if (part.length < 3) continue;
    const cyrWord = capitalize(transliterate(part));
    console.log(`[AI Tools] Trying single name: "${cyrWord}"`);
    const student = await db.findStudentByName(cyrWord);
    if (student) return { id: student.id, name: student.name };
  }

  return null;
}

/**
 * Extract the topic portion from a homework filename.
 * "dz_liza_morozova_drobi_osnovnye_ponyatiya.docx" + studentName="Лиза Морозова" → "дроби основные понятия"
 *
 * Strategy:
 * 1. Strip extension and known prefixes (dz_, homework_, etc.)
 * 2. If student name is known, strip matching parts from the beginning
 * 3. Transliterate remaining parts to Cyrillic
 */
function extractTopicFromHomeworkFilename(filename: string, studentName?: string): string {
  // Strip extension
  let base = filename.replace(/\.[^.]+$/, '').toLowerCase();
  // Strip common prefixes
  base = base.replace(/^(dz|homework|plan|material|test|lesson|notes|solution)_/i, '');

  const parts = base.split(/[_\-]+/).filter((p) => p.length >= 2);
  if (parts.length === 0) return transliterate(base);

  let topicStartIdx = 0;

  if (studentName) {
    // Use known student name to determine how many leading parts to skip
    const nameWords = studentName.toLowerCase().split(/\s+/);
    // Check if first N parts match student name (transliterated)
    for (let n = Math.min(nameWords.length, parts.length); n >= 1; n--) {
      const candidateParts = parts.slice(0, n);
      const candidateCyr = candidateParts.map((p) => transliterate(p));
      const allMatch = candidateCyr.every((cp) =>
        nameWords.some((nw) => nw.includes(cp) || cp.includes(nw))
      );
      if (allMatch && parts.length > n) {
        topicStartIdx = n;
        break;
      }
    }
  }

  const topicParts = parts.slice(topicStartIdx);
  if (topicParts.length === 0) return parts.map((p) => transliterate(p)).join(' ');
  return topicParts.map((p) => transliterate(p)).join(' ');
}

// --- Topic matching helper ---

/** Match a lesson topic string to a learning path topic using multi-strategy matching */
function findMatchingLpTopic<T extends { id: string; title: string }>(
  lessonTopic: string,
  lpTopics: T[],
): T | undefined {
  const lessonLower = lessonTopic.toLowerCase();

  // 1. Exact match
  const exact = lpTopics.find((t) => t.title.toLowerCase() === lessonLower);
  if (exact) return exact;

  // 2. Substring inclusion (either direction)
  const substring = lpTopics.find((t) => {
    const tLower = t.title.toLowerCase();
    return tLower.includes(lessonLower) || lessonLower.includes(tLower);
  });
  if (substring) return substring;

  // 3. Keyword overlap >= 50%
  const lessonWords = lessonLower.split(/[\s,.:;—–\-/]+/).filter((w) => w.length > 2);
  if (lessonWords.length === 0) return undefined;

  let bestMatch: T | undefined;
  let bestScore = 0;

  for (const t of lpTopics) {
    const tWords = t.title.toLowerCase().split(/[\s,.:;—–\-/]+/).filter((w) => w.length > 2);
    if (tWords.length === 0) continue;
    const overlap = lessonWords.filter((w) => tWords.some((tw) => tw.includes(w) || w.includes(tw))).length;
    const score = overlap / Math.min(lessonWords.length, tWords.length);
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = t;
    }
  }

  return bestMatch;
}

// --- Student resolution helper ---

async function resolveStudentId(params: Record<string, unknown>): Promise<{ id: string; name: string } | string> {
  const studentId = params.studentId ? String(params.studentId) : '';
  if (studentId && isValidUuid(studentId)) {
    const students = await db.getStudents();
    const s = students.find((st) => st.id === studentId);
    return s ? { id: s.id, name: s.name } : 'Ученик не найден по ID';
  }
  const studentName = String(params.studentName ?? '');
  if (!studentName) return 'Нужен studentId или studentName';
  const found = await db.findStudentByName(studentName);
  if (!found) return `Ученик "${studentName}" не найден`;
  return { id: found.id, name: found.name };
}

// --- Markdown to DOCX converter ---

function markdownToDocxParagraphs(md: string): Paragraph[] {
  const lines = md.split('\n');
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line → spacing
    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: parseInlineFormatting(trimmed.slice(4)),
      }));
      continue;
    }
    if (trimmed.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: parseInlineFormatting(trimmed.slice(3)),
      }));
      continue;
    }
    if (trimmed.startsWith('# ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: parseInlineFormatting(trimmed.slice(2)),
        spacing: { after: 200 },
      }));
      continue;
    }

    // Numbered list (1. 2. 3.)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: `${numMatch[1]!}. `, bold: true }),
          ...parseInlineFormatting(numMatch[2]!),
        ],
        spacing: { after: 80 },
        indent: { left: 360 },
      }));
      continue;
    }

    // Bullet list (- or *)
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: '• ' }),
          ...parseInlineFormatting(bulletMatch[1]!),
        ],
        spacing: { after: 80 },
        indent: { left: 360 },
      }));
      continue;
    }

    // Horizontal rule
    if (/^[-_*]{3,}$/.test(trimmed)) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: '─'.repeat(50) })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      }));
      continue;
    }

    // Regular paragraph
    paragraphs.push(new Paragraph({
      children: parseInlineFormatting(trimmed),
      spacing: { after: 120 },
    }));
  }

  return paragraphs;
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Match **bold**, *italic*, `code`, and plain text
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      // **bold**
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else if (match[3]) {
      // *italic*
      runs.push(new TextRun({ text: match[3], italics: true }));
    } else if (match[4]) {
      // `code`
      runs.push(new TextRun({ text: match[4], font: 'Courier New', size: 20 }));
    } else if (match[5]) {
      // plain text
      runs.push(new TextRun({ text: match[5] }));
    }
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text }));
  }
  return runs;
}

async function saveAsDocx(fullPath: string, markdownContent: string): Promise<void> {
  const paragraphs = markdownToDocxParagraphs(markdownContent);
  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });
  const buffer = await Packer.toBuffer(doc);
  writeFileSync(fullPath, buffer);
}

interface ActionResult {
  success: boolean;
  message: string;
  entity: string;
  entities?: string[];
  data?: Record<string, unknown>;
}

type ActionHandler = (params: Record<string, unknown>) => Promise<ActionResult>;

const DESTRUCTIVE_ACTIONS = new Set(['delete_task', 'delete_event', 'delete_student', 'delete_learning_path_topic', 'delete_dev_task', 'delete_project', 'delete_assignment', 'delete_exam']);

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
    const input: Record<string, unknown> = {
      name: params.name,
      slug: String(params.name ?? '').toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, ''),
      status: 'active',
    };
    if (params.clientName) input.clientName = params.clientName;
    if (params.description) input.description = params.description;
    if (params.techStack) input.techStack = params.techStack;
    if (params.budget) input.budget = Number(params.budget);
    if (params.deadline) input.deadline = String(params.deadline);
    if (params.repoUrl) input.repoUrl = params.repoUrl;
    if (params.deployUrl) input.deployUrl = params.deployUrl;
    const result = await db.createProject(input);
    return { success: true, message: `Проект создан: ${params.name}`, entity: 'projects', data: result as unknown as Record<string, unknown> };
  },

  // Dev Tasks
  create_dev_task: async (params) => {
    let projectId = params.projectId ? String(params.projectId) : '';
    if (!projectId && params.projectName) {
      const found = await db.findProjectByName(String(params.projectName));
      if (!found) return { success: false, message: `Проект "${params.projectName}" не найден`, entity: '' };
      projectId = found.id;
    }
    if (!projectId) return { success: false, message: 'projectId или projectName обязателен', entity: '' };

    const input: Record<string, unknown> = {
      projectId,
      title: params.title,
      status: params.status ?? 'todo',
      priority: params.priority ?? 'medium',
    };
    if (params.description) input.description = params.description;
    if (params.prompt) input.prompt = params.prompt;
    if (params.deadline) input.deadline = String(params.deadline);
    if (params.timeEstimateMinutes) input.timeEstimateMinutes = Number(params.timeEstimateMinutes);

    const result = await db.createDevTask(input);
    return { success: true, message: `Задача создана: ${params.title}`, entity: 'dev-tasks', data: result as unknown as Record<string, unknown> };
  },

  update_task_status: async (params) => {
    const taskId = String(params.taskId ?? '');
    const status = String(params.status ?? '');
    if (!taskId) return { success: false, message: 'taskId обязателен', entity: '' };
    if (!['todo', 'in_progress', 'done', 'deferred'].includes(status)) {
      return { success: false, message: 'status должен быть: todo, in_progress, done, deferred', entity: '' };
    }
    await db.updateDevTask(taskId, { status });
    return { success: true, message: `Статус задачи обновлён: ${status}`, entity: 'dev-tasks' };
  },

  generate_task_prompt: async (params) => {
    const taskId = String(params.taskId ?? '');
    const description = String(params.description ?? '');
    if (!taskId) return { success: false, message: 'taskId обязателен', entity: '' };
    // The prompt is generated by the AI in its response and passed here
    const prompt = String(params.prompt ?? description);
    await db.updateDevTask(taskId, { prompt });
    return { success: true, message: 'Промпт для задачи сгенерирован и сохранён', entity: 'dev-tasks' };
  },

  log_time: async (params) => {
    const minutes = Number(params.minutes ?? 0);
    if (!minutes) return { success: false, message: 'minutes обязателен', entity: '' };

    let projectId = '';
    let taskId = '';

    if (params.projectName) {
      const found = await db.findProjectByName(String(params.projectName));
      if (found) projectId = found.id;
    }

    if (params.taskName && projectId) {
      const tasks = await db.getDevTasks(projectId);
      const match = tasks.find((t) => t.title.toLowerCase().includes(String(params.taskName).toLowerCase()));
      if (match) {
        taskId = match.id;
        // Update time_spent on the task
        await db.updateDevTask(match.id, { timeSpentMinutes: match.timeSpentMinutes + minutes });
      }
    }

    if (!projectId || !taskId) {
      return { success: false, message: 'Проект или задача не найдены', entity: '' };
    }

    const entry = await db.createDevTimeEntry({
      taskId,
      projectId,
      startedAt: new Date().toISOString(),
      durationMinutes: minutes,
      notes: params.notes ?? null,
    });

    return {
      success: true,
      message: `Залогировано ${minutes} мин`,
      entity: 'dev-time',
      entities: ['dev-time', 'dev-tasks'],
      data: entry as unknown as Record<string, unknown>,
    };
  },

  defer_task: async (params) => {
    const taskId = String(params.taskId ?? '');
    if (!taskId) return { success: false, message: 'taskId обязателен', entity: '' };
    await db.updateDevTask(taskId, { status: 'deferred' });
    return { success: true, message: 'Задача отложена', entity: 'dev-tasks' };
  },

  delete_dev_task: async (params) => {
    const id = String(params.id ?? params.taskId ?? '');
    if (!id) return { success: false, message: 'id обязателен', entity: '' };
    await db.deleteDevTask(id);
    return { success: true, message: 'Задача удалена', entity: 'dev-tasks' };
  },

  delete_project: async (params) => {
    const id = String(params.id ?? '');
    if (!id) return { success: false, message: 'id обязателен', entity: '' };
    await db.deleteProject(id);
    return { success: true, message: 'Проект удалён', entity: 'projects' };
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
    // Create folder structure for the subject
    const slug = toSubjectSlug(String(params.name ?? ''));
    if (slug) ensureSubjectFolders(slug);
    return { success: true, message: `Предмет добавлен: ${params.name}`, entity: 'subjects', data: result as unknown as Record<string, unknown> };
  },

  update_subject: async (params) => {
    const id = String(params.id ?? '');
    if (!id) return { success: false, message: 'id обязателен', entity: '' };
    const { id: _id, ...data } = params;
    const result = await db.updateSubject(id, data);
    return { success: true, message: `Предмет обновлён`, entity: 'subjects', data: result as unknown as Record<string, unknown> };
  },

  // Study Assignments
  create_assignment: async (params) => {
    let subjectId = params.subjectId ? String(params.subjectId) : '';
    if (!subjectId && params.subjectName) {
      const found = await db.findSubjectByName(String(params.subjectName));
      if (!found) return { success: false, message: `Предмет "${params.subjectName}" не найден`, entity: '' };
      subjectId = found.id;
    }
    if (!subjectId) return { success: false, message: 'subjectId или subjectName обязателен', entity: '' };

    const input: Record<string, unknown> = {
      subjectId,
      title: params.title,
    };
    if (params.type) input.type = params.type;
    if (params.deadline) input.deadline = params.deadline;
    if (params.description) input.description = params.description;
    if (params.status) input.status = params.status;

    const result = await db.createStudyAssignment(input);
    return { success: true, message: `Задание создано: ${params.title}`, entity: 'assignments', data: result as unknown as Record<string, unknown> };
  },

  update_assignment: async (params) => {
    const id = String(params.id ?? params.assignmentId ?? '');
    if (!id) return { success: false, message: 'id обязателен', entity: '' };
    const { id: _id, assignmentId: _aid, ...data } = params;
    const result = await db.updateStudyAssignment(id, data);
    return { success: true, message: `Задание обновлено`, entity: 'assignments', data: result as unknown as Record<string, unknown> };
  },

  delete_assignment: async (params) => {
    const id = String(params.id ?? '');
    if (!id) return { success: false, message: 'id обязателен', entity: '' };
    await db.deleteStudyAssignment(id);
    return { success: true, message: `Задание удалено`, entity: 'assignments' };
  },

  // Study Exams
  create_exam: async (params) => {
    let subjectId = params.subjectId ? String(params.subjectId) : '';
    if (!subjectId && params.subjectName) {
      const found = await db.findSubjectByName(String(params.subjectName));
      if (!found) return { success: false, message: `Предмет "${params.subjectName}" не найден`, entity: '' };
      subjectId = found.id;
    }
    if (!subjectId) return { success: false, message: 'subjectId или subjectName обязателен', entity: '' };

    const input: Record<string, unknown> = {
      subjectId,
      title: params.title,
    };
    if (params.type) input.type = params.type;
    if (params.date) input.date = params.date;
    if (params.notes) input.notes = params.notes;

    const result = await db.createStudyExam(input);
    return { success: true, message: `Экзамен добавлен: ${params.title}`, entity: 'exams', data: result as unknown as Record<string, unknown> };
  },

  update_exam: async (params) => {
    const id = String(params.id ?? '');
    if (!id) return { success: false, message: 'id обязателен', entity: '' };
    const { id: _id, ...data } = params;
    const result = await db.updateStudyExam(id, data);
    return { success: true, message: `Экзамен обновлён`, entity: 'exams', data: result as unknown as Record<string, unknown> };
  },

  delete_exam: async (params) => {
    const id = String(params.id ?? '');
    if (!id) return { success: false, message: 'id обязателен', entity: '' };
    await db.deleteStudyExam(id);
    return { success: true, message: `Экзамен удалён`, entity: 'exams' };
  },

  // Study Notes
  save_study_note: async (params) => {
    let subjectName = String(params.subjectName ?? '');
    if (!subjectName && params.subjectId) {
      const subjects = await db.getSubjects();
      const found = subjects.find((s) => s.id === String(params.subjectId));
      if (found) subjectName = found.name;
    }
    if (!subjectName) return { success: false, message: 'subjectName обязателен', entity: '' };

    const slug = toSubjectSlug(subjectName);
    const filename = String(params.filename ?? 'note.md');
    const content = String(params.content ?? '');
    if (!content) return { success: false, message: 'content обязателен', entity: '' };

    const base = ensureSubjectFolders(slug);
    const fullPath = resolve(base, 'notes', filename);
    writeFileSync(fullPath, content, 'utf-8');

    return { success: true, message: `Заметка сохранена: ${filename}`, entity: 'files', data: { path: fullPath } };
  },

  generate_summary: async (params) => {
    let subjectName = String(params.subjectName ?? '');
    if (!subjectName && params.subjectId) {
      const subjects = await db.getSubjects();
      const found = subjects.find((s) => s.id === String(params.subjectId));
      if (found) subjectName = found.name;
    }
    if (!subjectName) return { success: false, message: 'subjectName обязателен', entity: '' };

    const slug = toSubjectSlug(subjectName);
    const noteFilename = String(params.noteFilename ?? '');
    const summary = String(params.summary ?? '');
    if (!noteFilename || !summary) return { success: false, message: 'noteFilename и summary обязательны', entity: '' };

    const base = ensureSubjectFolders(slug);
    const summaryFilename = noteFilename.replace(/\.md$/, '') + '_summary.md';
    const fullPath = resolve(base, 'summaries', summaryFilename);
    writeFileSync(fullPath, summary, 'utf-8');

    return { success: true, message: `Конспект сохранён: ${summaryFilename}`, entity: 'files', data: { path: fullPath } };
  },

  // Transactions
  add_transaction: async (params) => {
    const txData: Record<string, unknown> = { ...params };

    // For tutoring income: auto-resolve student
    if (txData.type === 'income' && txData.category === 'tutoring' && !txData.studentId) {
      const studentName = String(txData.studentName ?? '');
      if (studentName) {
        const found = await db.findStudentByName(studentName);
        if (found) {
          txData.studentId = found.id;
          console.log('[AI Tools] Resolved student for transaction:', found.name, found.id);
        }
      }
      delete txData.studentName;
    }

    if (!txData.date) txData.date = new Date().toISOString().slice(0, 10);
    const result = await db.createTransaction(txData);
    return { success: true, message: `Транзакция записана: ${params.amount} ₽`, entity: 'transactions', data: result as unknown as Record<string, unknown> };
  },

  // Quick expense logging
  log_expense: async (params) => {
    const result = await db.createTransaction({
      type: 'expense',
      amount: params.amount,
      category: params.category ?? 'other',
      description: params.description ?? null,
      date: params.date ?? new Date().toISOString().slice(0, 10),
    });
    return { success: true, message: `Расход записан: ${params.amount} ₽ (${params.category ?? 'other'})`, entity: 'transactions', data: result as unknown as Record<string, unknown> };
  },

  // Create savings goal
  create_savings_goal: async (params) => {
    const name = String(params.name ?? '');
    const targetAmount = Number(params.targetAmount ?? 0);
    if (!name) return { success: false, message: 'name обязателен', entity: '' };

    const result = await db.createSavingsGoal({ name, targetAmount, currentAmount: 0, status: 'active' });
    console.log(`[AI Tools] Created savings goal: ${name} — ${targetAmount}₽`);
    return {
      success: true,
      message: `Создана цель накоплений "${name}" на ${targetAmount} ₽`,
      entity: 'savings',
      data: result as unknown as Record<string, unknown>,
    };
  },

  // Add to savings goal
  add_savings: async (params) => {
    const goalName = String(params.goalName ?? '');
    const amount = Number(params.amount ?? 0);
    if (!goalName || !amount) return { success: false, message: 'goalName и amount обязательны', entity: '' };

    const goals = await db.getSavingsGoals();
    let goal = goals.find((g) => g.name.toLowerCase().includes(goalName.toLowerCase()));

    // Auto-create goal if not found
    if (!goal) {
      goal = await db.createSavingsGoal({ name: goalName, targetAmount: 0, currentAmount: 0, status: 'active' });
      console.log(`[AI Tools] Auto-created savings goal: ${goalName}`);
    }

    const newAmount = goal.currentAmount + amount;
    await db.updateSavingsGoal(goal.id, { currentAmount: newAmount });

    // Also create a savings transaction
    await db.createTransaction({
      type: 'savings',
      amount,
      category: 'savings_deposit',
      description: `Пополнение: ${goal.name}`,
      date: new Date().toISOString().slice(0, 10),
    });

    return {
      success: true,
      message: `Пополнена цель "${goal.name}": +${amount} ₽ (итого: ${newAmount} ₽)`,
      entity: 'transactions',
      entities: ['transactions', 'savings'],
    };
  },

  // Record student payment (tutoring income + optional rate lookup)
  record_student_payment: async (params) => {
    const studentName = String(params.studentName ?? '');
    if (!studentName) return { success: false, message: 'studentName обязателен', entity: '' };

    const student = await db.findStudentByName(studentName);
    if (!student) return { success: false, message: `Ученик "${studentName}" не найден`, entity: '' };

    let amount = Number(params.amount ?? 0);
    const lessonsCount = Number(params.lessonsCount ?? 1);

    // If no amount, try to use rate
    const rate = await db.getStudentRate(student.id);
    if (!amount) {
      if (rate) {
        amount = rate.ratePerLesson * lessonsCount;
      } else {
        return { success: false, message: `Сумма не указана и ставка для ${student.name} не найдена. Укажи сумму или установи ставку.`, entity: '' };
      }
    }

    const rateInfo = rate ? `${rate.ratePerLesson}₽` : 'нет ставки';
    console.log(`[AI Tools] Student payment: ${student.name} — ${amount}₽ (${lessonsCount} уроков по ${rateInfo})`);

    const pluralLesson = lessonsCount === 1 ? 'урок' : lessonsCount < 5 ? 'урока' : 'уроков';
    const result = await db.createTransaction({
      type: 'income',
      amount,
      category: 'tutoring',
      description: `Оплата: ${student.name} (${lessonsCount} ${pluralLesson})`,
      studentId: student.id,
      date: params.date ?? new Date().toISOString().slice(0, 10),
    });

    return {
      success: true,
      message: `Оплата записана: ${student.name} — ${amount} ₽ (${lessonsCount} ${pluralLesson}${rate ? ` по ${rate.ratePerLesson}₽` : ''})`,
      entity: 'transactions',
      data: result as unknown as Record<string, unknown>,
    };
  },

  // Set student rate
  set_student_rate: async (params) => {
    const resolved = await resolveStudentId(params);
    if (typeof resolved === 'string') return { success: false, message: resolved, entity: '' };

    const rate = Number(params.rate ?? 0);
    if (!rate) return { success: false, message: 'rate обязателен', entity: '' };

    await db.setStudentRate(resolved.id, rate);
    console.log(`[AI Tools] Set rate for ${resolved.name}: ${rate}₽/урок`);
    return {
      success: true,
      message: `Ставка ${resolved.name}: ${rate} ₽/урок`,
      entity: 'finance',
    };
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
    const home = os.homedir();
    const fullPath = filePath.startsWith('/') ? filePath : resolve(home, 'mark2', filePath);
    mkdirSync(dirname(fullPath), { recursive: true });

    if (extname(fullPath).toLowerCase() === '.docx') {
      console.log('[AI Tools] Converting markdown to .docx:', basename(fullPath));
      await saveAsDocx(fullPath, content);
    } else {
      writeFileSync(fullPath, content, 'utf-8');
    }

    return { success: true, message: `Файл сохранён: ${basename(fullPath)}`, entity: 'files', data: { path: fullPath } };
  },

  // Learning Path
  create_learning_path: async (params) => {
    let studentId = params.studentId ? String(params.studentId) : '';

    // Auto-resolve by name if no valid UUID
    if (!studentId || !isValidUuid(studentId)) {
      const studentName = String(params.studentName ?? '');
      if (studentName) {
        const found = await db.findStudentByName(studentName);
        if (found) {
          studentId = found.id;
          console.log('[AI Tools] Resolved student for learning path:', found.name, found.id);
        } else {
          return { success: false, message: `Ученик "${studentName}" не найден`, entity: '' };
        }
      } else {
        return { success: false, message: 'Нужен studentId или studentName', entity: '' };
      }
    }

    const topics = params.topics as Array<{ title: string; description?: string }> | undefined;
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return { success: false, message: 'topics[] обязателен', entity: '' };
    }

    const created: unknown[] = [];
    for (let i = 0; i < topics.length; i++) {
      const t = topics[i]!;
      const result = await db.createLearningPathTopic({
        studentId,
        title: t.title,
        description: t.description ?? null,
        orderIndex: i,
        status: 'planned',
      });
      created.push(result);
    }

    return {
      success: true,
      message: `Создан путь обучения: ${topics.length} тем`,
      entity: 'learning-path',
      data: { count: topics.length, studentId },
    };
  },

  update_learning_path_topic: async (params) => {
    const topicId = String(params.topicId ?? '');
    if (!topicId) return { success: false, message: 'topicId обязателен', entity: '' };
    const { topicId: _id, ...data } = params;
    await db.updateLearningPathTopic(topicId, data);
    return { success: true, message: 'Тема обновлена', entity: 'learning-path' };
  },

  reorder_learning_path: async (params) => {
    const studentId = String(params.studentId ?? '');
    const topicIds = params.topicIds as string[] | undefined;
    if (!studentId || !topicIds) return { success: false, message: 'studentId и topicIds обязательны', entity: '' };
    await db.reorderLearningPathTopics(studentId, topicIds);
    return { success: true, message: 'Порядок тем обновлён', entity: 'learning-path' };
  },

  delete_learning_path_topic: async (params) => {
    const topicId = String(params.topicId ?? '');
    if (!topicId) return { success: false, message: 'topicId обязателен', entity: '' };

    // Get topic to know studentId before deleting
    const allStudents = await db.getStudents();
    let studentId = '';
    for (const s of allStudents) {
      const topics = await db.getLearningPath(s.id);
      if (topics.some((t) => t.id === topicId)) {
        studentId = s.id;
        break;
      }
    }

    await db.deleteLearningPathTopic(topicId);
    console.log('[AI Tools] Deleted learning path topic:', topicId);

    // Reorder remaining topics to keep order_index sequential
    if (studentId) {
      const remaining = await db.getLearningPath(studentId);
      const orderedIds = remaining.sort((a, b) => a.orderIndex - b.orderIndex).map((t) => t.id);
      await db.reorderLearningPathTopics(studentId, orderedIds);
    }

    return { success: true, message: `Тема удалена: ${topicId}`, entity: 'learning-path' };
  },

  // Lessons
  create_lesson: async (params) => {
    const resolved = await resolveStudentId(params);
    if (typeof resolved === 'string') return { success: false, message: resolved, entity: '' };

    const topic = String(params.topic ?? '');
    if (!topic) return { success: false, message: 'topic обязателен', entity: '' };

    const date = params.date ? String(params.date) : new Date().toISOString().slice(0, 10);
    const notes = params.notes ? String(params.notes) : '';
    const homeworkGiven = params.homeworkGiven ? String(params.homeworkGiven) : null;

    // Try to find matching learning path topic
    let topicId: string | null = null;
    try {
      const lpTopics = await db.getLearningPath(resolved.id);
      const match = findMatchingLpTopic(topic, lpTopics);
      if (match) {
        topicId = match.id;
        console.log(`[AI Tools] Matched lesson topic "${topic}" to learning path topic "${match.title}" (id: ${match.id})`);
      }
    } catch { /* ignore */ }

    const lesson = await db.createLesson({
      studentId: resolved.id,
      topic,
      date,
      notes,
      status: 'completed',
      homeworkGiven,
      ...(topicId ? { topicId } : {}),
    });

    console.log('[AI Tools] Created lesson:', topic, 'for', resolved.name);
    return {
      success: true,
      message: `Урок записан: ${topic} (${resolved.name})`,
      entity: 'lessons',
      data: lesson as unknown as Record<string, unknown>,
    };
  },

  complete_lesson_report: async (params) => {
    const resolved = await resolveStudentId(params);
    if (typeof resolved === 'string') return { success: false, message: resolved, entity: '' };

    const topicsCovered = Array.isArray(params.topicsCovered) ? params.topicsCovered as string[] : [];
    const topicsNotCovered = Array.isArray(params.topicsNotCovered) ? params.topicsNotCovered as string[] : [];
    const notes = params.notes ? String(params.notes) : '';
    const homeworkGiven = params.homeworkGiven ? String(params.homeworkGiven) : null;
    const date = params.date ? String(params.date) : new Date().toISOString().slice(0, 10);
    const lessonTopic = params.topic ? String(params.topic) : topicsCovered.join(', ') || 'Урок';

    // 1. Load learning path
    let lpTopics: Awaited<ReturnType<typeof db.getLearningPath>> = [];
    try {
      lpTopics = await db.getLearningPath(resolved.id);
    } catch { /* no learning path yet — that's ok */ }

    const findLpMatch = (name: string) => findMatchingLpTopic(name, lpTopics);

    // 2. Try to match first covered topic to learning path for topic_id
    let topicId: string | null = null;
    if (topicsCovered.length > 0) {
      const firstMatch = findLpMatch(topicsCovered[0]!);
      if (firstMatch) {
        topicId = firstMatch.id;
      } else {
        console.log('[AI Tools] Lesson topic not in learning path, creating without topic_id');
      }
    }

    // 3. Create lesson record
    const lesson = await db.createLesson({
      studentId: resolved.id,
      topic: lessonTopic,
      date,
      notes,
      status: 'completed',
      homeworkGiven,
      ...(topicId ? { topicId } : {}),
    });
    console.log('[AI Tools] Created lesson:', lessonTopic, 'for', resolved.name);

    // 4. Update learning path statuses (only if we have topics and a learning path)
    const updatedTopicIds: string[] = [];
    if (lpTopics.length > 0) {
      // Mark covered topics as 'completed'
      for (const covered of topicsCovered) {
        const match = findLpMatch(covered);
        if (match && match.status !== 'completed') {
          const dateNote = `Пройдено ${date}`;
          const newNotes = match.notes ? `${match.notes}; ${dateNote}` : dateNote;
          await db.updateLearningPathTopic(match.id, { status: 'completed', notes: newNotes });
          updatedTopicIds.push(match.id);
        }
      }

      // Mark first not-covered topic as 'in_progress'
      if (topicsNotCovered.length > 0) {
        const match = findLpMatch(topicsNotCovered[0]!);
        if (match && match.status === 'planned') {
          await db.updateLearningPathTopic(match.id, { status: 'in_progress' });
          updatedTopicIds.push(match.id);
        }
      }

      // Set next planned topic after last completed as 'in_progress'
      const refreshed = await db.getLearningPath(resolved.id);
      const sorted = refreshed.sort((a, b) => a.orderIndex - b.orderIndex);
      let lastCompletedIdx = -1;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i]!.status === 'completed') { lastCompletedIdx = i; break; }
      }
      if (lastCompletedIdx >= 0 && lastCompletedIdx < sorted.length - 1) {
        const next = sorted[lastCompletedIdx + 1]!;
        if (next.status === 'planned') {
          await db.updateLearningPathTopic(next.id, { status: 'in_progress' });
          updatedTopicIds.push(next.id);
        }
      }
    }

    const summary = [
      `Урок записан: ${lessonTopic}`,
      updatedTopicIds.length > 0 ? `Обновлено тем в плане: ${updatedTopicIds.length}` : null,
    ].filter(Boolean).join('. ');

    return {
      success: true,
      message: summary,
      entity: 'lessons',
      entities: updatedTopicIds.length > 0 ? ['lessons', 'learning-path'] : ['lessons'],
      data: { lessonId: lesson.id, updatedTopics: updatedTopicIds.length },
    };
  },

  attach_file: async (params) => {
    console.log('[AI Tools] attach_file params:', JSON.stringify(params));
    // Auto-resolve student ID from filename if missing
    let studentId = '';
    let studentName = '';
    if (params.entityType === 'student' && (!params.entityId || !isValidUuid(String(params.entityId)))) {
      const filename = String(params.filename ?? '');
      const resolved = await tryResolveStudentFromFilename(filename);
      if (resolved) {
        console.log('[AI Tools] Auto-resolved student:', resolved.name, resolved.id);
        params.entityId = resolved.id;
        studentId = resolved.id;
        studentName = resolved.name;
      } else {
        console.warn('[AI Tools] Could not auto-resolve student from filename:', filename);
      }
    } else if (params.entityType === 'student' && params.entityId) {
      studentId = String(params.entityId);
      // Look up student name for filename parsing
      try {
        const students = await db.getStudents();
        const found = students.find((s) => s.id === studentId);
        if (found) studentName = found.name;
      } catch { /* ignore */ }
    }

    // For homework files, try to match topic_id from learning path
    if (params.category === 'homework' && studentId && !params.topicId) {
      try {
        const lpTopics = await db.getLearningPath(studentId);
        const filename = String(params.filename ?? '').toLowerCase();
        const topicFromFilename = extractTopicFromHomeworkFilename(filename, studentName);
        console.log(`[AI Tools] attach_file extracted topic from filename: "${topicFromFilename}" (original: "${filename}", student: "${studentName}")`);
        const match = findMatchingLpTopic(topicFromFilename, lpTopics);
        if (match) {
          params.topicId = match.id;
          console.log(`[AI Tools] attach_file matched topic: "${match.title}" (id: ${match.id})`);
        } else {
          console.log(`[AI Tools] attach_file no matching topic for filename: ${filename}`);
        }
      } catch { /* ignore */ }
    }

    console.log(`[AI Tools] attach_file topic_id: ${params.topicId || 'none'}, entity: ${params.entityType}/${params.entityId}, category: ${params.category}`);
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

export async function executeAction(parsed: ParsedAction, opts?: { skipConfirmation?: boolean }): Promise<ActionExecution> {
  const handler = AI_TOOLS[parsed.action];
  if (!handler) {
    return {
      action: parsed.action,
      result: { success: false, message: `Неизвестное действие: ${parsed.action}`, entity: '' },
      needsConfirmation: false,
    };
  }

  if (isDestructive(parsed.action) && !opts?.skipConfirmation) {
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
    if (ex.result.success) {
      if (ex.result.entity) entities.add(ex.result.entity);
      if (ex.result.entities) {
        for (const e of ex.result.entities) entities.add(e);
      }
    }
  }
  return [...entities];
}
