import { ipcMain, BrowserWindow, shell, dialog } from 'electron';
import { ChildProcess, exec } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { claude, AgentName } from './claude-bridge';
import {
  sendMessage,
  abortSession,
  isSessionActive,
  handleCreateSession,
  handleGetSessions,
  handleDeleteSession,
  handleSwitchSession,
  handleGetSessionMessages,
  handleAgentSwitch,
  handleBackfillSummaries,
  setSessionContext,
  setAgentContext,
} from './hybrid-engine';
import { transcribeAudio } from './chat-client';
import { processAttachedFiles } from './file-processor';
import * as db from './db-service';
import { getAggregatedTasks } from './task-aggregator';
import type { Sphere } from '@mark2/shared';

const VALID_AGENTS = new Set<string>(['dev', 'teaching', 'study', 'health', 'finance', 'general']);

const cliSessions = new Map<string, ChildProcess>();

function isValidAgent(agent: string): agent is AgentName {
  return VALID_AGENTS.has(agent);
}

function getWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows[0] ?? null;
}

function sendToRenderer(channel: string, ...args: unknown[]): void {
  const win = getWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args);
  }
}

function parseStreamStatus(text: string): string {
  // Check last ~500 chars for status indicators
  const tail = text.slice(-500);
  if (/\[ACTION:/i.test(tail)) return 'Выполняет действие...';
  if (/(?:Read|Reading) file/i.test(tail)) return 'Читает файл...';
  if (/(?:Writ|Writing|Wrote|Saving) file/i.test(tail)) return 'Создаёт файл...';
  if (/(?:Running|Executing|Execute)/i.test(tail)) return 'Выполняет команду...';
  if (/(?:Search|Searching|Looking|Finding)/i.test(tail)) return 'Ищет...';
  return 'Думает...';
}

export function registerIpcHandlers(): void {
  // === Chat sessions ===

  ipcMain.handle('chat:create-session', async (_event, agent: string, fromSessionId?: string) => {
    if (!isValidAgent(agent)) throw new Error(`Invalid agent: ${agent}`);
    return handleCreateSession(agent, fromSessionId);
  });

  ipcMain.handle('chat:get-sessions', async (_event, agent: string) => {
    if (!isValidAgent(agent)) throw new Error(`Invalid agent: ${agent}`);
    return handleGetSessions(agent);
  });

  ipcMain.handle('chat:delete-session', async (_event, sessionId: string) => {
    await handleDeleteSession(sessionId);
  });

  ipcMain.handle('chat:switch-session', async (_event, fromSessionId: string | null, toSessionId: string) => {
    return handleSwitchSession(fromSessionId, toSessionId);
  });

  ipcMain.handle('chat:get-session-messages', async (_event, sessionId: string) => {
    return handleGetSessionMessages(sessionId);
  });

  ipcMain.handle('chat:agent-switch', async (_event, fromAgent: string) => {
    if (!isValidAgent(fromAgent)) throw new Error(`Invalid agent: ${fromAgent}`);
    await handleAgentSwitch(fromAgent);
  });

  ipcMain.handle('chat:backfill-summaries', async () => {
    return handleBackfillSummaries();
  });

  // === Hybrid chat (send message within a session) ===

  ipcMain.handle('chat:send', async (_event, agent: string, sessionId: string, message: string, filePaths?: string[]) => {
    if (!isValidAgent(agent)) throw new Error(`Invalid agent: ${agent}`);

    console.log('[IPC chat:send] filePaths received:', filePaths);

    // Process attached files if any
    const files = filePaths && filePaths.length > 0
      ? await processAttachedFiles(filePaths)
      : undefined;

    if (files) {
      console.log('[IPC chat:send] Processed files — textContent length:', files.textContent.length, ', images:', files.images.length, ', unsupported:', files.unsupported);
    }

    sendToRenderer('chat:stream-start', sessionId);
    sendToRenderer('chat:status-update', sessionId, 'Обрабатывает запрос...');

    let lastStatus = '';
    const onChunk = (accumulated: string) => {
      sendToRenderer('chat:stream-update', sessionId, accumulated);
      // Parse status from latest output
      const status = parseStreamStatus(accumulated);
      if (status !== lastStatus) {
        lastStatus = status;
        sendToRenderer('chat:status-update', sessionId, status);
      }
    };

    try {
      const result = await sendMessage(agent, sessionId, message, onChunk, files);
      sendToRenderer('chat:stream-end', sessionId);
      sendToRenderer('chat:status-update', sessionId, '');
      return result;
    } catch (err) {
      sendToRenderer('chat:stream-end', sessionId);
      sendToRenderer('chat:status-update', sessionId, '');
      throw err;
    }
  });

  ipcMain.handle('chat:abort', (_event, sessionId: string) => {
    abortSession(sessionId);
  });

  ipcMain.handle('chat:is-thinking', (_event, sessionId: string) => {
    return isSessionActive(sessionId);
  });

  ipcMain.handle('chat:set-context', (_event, sessionId: string, ctx: Record<string, unknown>) => {
    setSessionContext(sessionId, ctx);
  });

  ipcMain.handle('chat:set-agent-context', (_event, agent: string, ctx: Record<string, unknown>) => {
    if (!isValidAgent(agent)) throw new Error(`Invalid agent: ${agent}`);
    setAgentContext(agent, ctx);
  });

  ipcMain.handle('chat:transcribe-audio', async (_event, audioData: ArrayBuffer) => {
    console.log('[IPC transcribe] Received audio buffer, size:', audioData.byteLength);
    try {
      const result = await transcribeAudio(Buffer.from(audioData));
      console.log('[IPC transcribe] Result:', JSON.stringify(result));
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[IPC transcribe] Error:', msg);
      return { text: '', error: msg };
    }
  });

  // === Claude Code direct ===

  ipcMain.handle('claude:run', async (_event, agent: string, prompt: string) => {
    if (!isValidAgent(agent)) throw new Error(`Invalid agent: ${agent}`);
    return claude.run({ agent, prompt });
  });

  ipcMain.handle('claude:start-session', (_event, agent: string) => {
    if (!isValidAgent(agent)) throw new Error(`Invalid agent: ${agent}`);

    const sessionId = crypto.randomUUID();
    const proc = claude.startSession(agent);
    cliSessions.set(sessionId, proc);

    proc.stdout?.on('data', (data: Buffer) => {
      sendToRenderer('claude:stream', sessionId, data.toString());
    });

    proc.stderr?.on('data', (data: Buffer) => {
      sendToRenderer('claude:session-error', sessionId, data.toString());
    });

    proc.on('close', () => {
      cliSessions.delete(sessionId);
      sendToRenderer('claude:session-end', sessionId);
    });

    return sessionId;
  });

  ipcMain.handle('claude:send-message', (_event, sessionId: string, message: string) => {
    const proc = cliSessions.get(sessionId);
    if (!proc) throw new Error(`Session ${sessionId} not found`);
    if (!proc.stdin || !proc.stdin.writable) throw new Error(`Session ${sessionId} stdin not writable`);
    proc.stdin.write(message + '\n');
  });

  // === Database CRUD ===

  // Tasks
  ipcMain.handle('db:tasks:list', async (_event, sphere?: Sphere) => {
    return db.getTasks(sphere);
  });

  ipcMain.handle('db:tasks:get', async (_event, id: string) => {
    return db.getTask(id);
  });

  ipcMain.handle('db:tasks:create', async (_event, data: Record<string, unknown>) => {
    return db.createTask(data);
  });

  ipcMain.handle('db:tasks:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateTask(id, data);
  });

  ipcMain.handle('db:tasks:delete', async (_event, id: string) => {
    return db.deleteTask(id);
  });

  // Calendar Events
  ipcMain.handle('db:events:list', async (_event, startDate: string, endDate: string) => {
    return db.getCalendarEvents(startDate, endDate);
  });

  ipcMain.handle('db:events:create', async (_event, data: Record<string, unknown>) => {
    return db.createCalendarEvent(data);
  });

  ipcMain.handle('db:events:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateCalendarEvent(id, data);
  });

  ipcMain.handle('db:events:delete', async (_event, id: string) => {
    return db.deleteCalendarEvent(id);
  });

  // Dev Projects
  ipcMain.handle('db:projects:list', async (_event, filters?: Record<string, unknown>) => {
    return db.getProjects(filters as Parameters<typeof db.getProjects>[0]);
  });

  ipcMain.handle('db:projects:create', async (_event, data: Record<string, unknown>) => {
    return db.createProject(data);
  });

  ipcMain.handle('db:projects:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateProject(id, data);
  });

  ipcMain.handle('db:projects:delete', async (_event, id: string) => {
    return db.deleteProject(id);
  });

  // Dev Tasks
  ipcMain.handle('db:dev:tasks:list', async (_event, projectId: string, status?: string) => {
    return db.getDevTasks(projectId, status);
  });

  ipcMain.handle('db:dev:tasks:create', async (_event, data: Record<string, unknown>) => {
    return db.createDevTask(data);
  });

  ipcMain.handle('db:dev:tasks:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateDevTask(id, data);
  });

  ipcMain.handle('db:dev:tasks:delete', async (_event, id: string) => {
    return db.deleteDevTask(id);
  });

  ipcMain.handle('db:dev:tasks:reorder', async (_event, projectId: string, taskIds: string[]) => {
    return db.reorderDevTasks(projectId, taskIds);
  });

  // Dev Time Entries
  ipcMain.handle('db:dev:time:list', async (_event, taskId?: string, projectId?: string) => {
    return db.getDevTimeEntries(taskId, projectId);
  });

  ipcMain.handle('db:dev:time:create', async (_event, data: Record<string, unknown>) => {
    return db.createDevTimeEntry(data);
  });

  ipcMain.handle('db:dev:time:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateDevTimeEntry(id, data);
  });

  // Students
  ipcMain.handle('db:students:list', async () => {
    return db.getStudents();
  });

  ipcMain.handle('db:students:create', async (_event, data: Record<string, unknown>) => {
    return db.createStudent(data);
  });

  ipcMain.handle('db:students:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateStudent(id, data);
  });

  ipcMain.handle('db:students:delete', async (_event, id: string) => {
    return db.deleteStudent(id);
  });

  // Subjects
  ipcMain.handle('db:subjects:list', async (_event, semester?: number) => {
    return db.getSubjects(semester);
  });

  ipcMain.handle('db:subjects:create', async (_event, data: Record<string, unknown>) => {
    return db.createSubject(data);
  });

  // Subjects (update/delete)
  ipcMain.handle('db:subjects:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateSubject(id, data);
  });

  ipcMain.handle('db:subjects:delete', async (_event, id: string) => {
    return db.deleteSubject(id);
  });

  // Study Assignments
  ipcMain.handle('db:assignments:list', async (_event, subjectId?: string) => {
    return db.getStudyAssignments(subjectId);
  });

  ipcMain.handle('db:assignments:create', async (_event, data: Record<string, unknown>) => {
    return db.createStudyAssignment(data);
  });

  ipcMain.handle('db:assignments:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateStudyAssignment(id, data);
  });

  ipcMain.handle('db:assignments:delete', async (_event, id: string) => {
    return db.deleteStudyAssignment(id);
  });

  // Study Exams
  ipcMain.handle('db:exams:list', async (_event, subjectId?: string) => {
    return db.getStudyExams(subjectId);
  });

  ipcMain.handle('db:exams:create', async (_event, data: Record<string, unknown>) => {
    return db.createStudyExam(data);
  });

  ipcMain.handle('db:exams:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateStudyExam(id, data);
  });

  ipcMain.handle('db:exams:delete', async (_event, id: string) => {
    return db.deleteStudyExam(id);
  });

  // Transactions
  ipcMain.handle('db:transactions:list', async (_event, filters?: Record<string, unknown>) => {
    return db.getTransactions(filters as Parameters<typeof db.getTransactions>[0]);
  });

  ipcMain.handle('db:transactions:create', async (_event, data: Record<string, unknown>) => {
    return db.createTransaction(data);
  });

  ipcMain.handle('db:transactions:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateTransaction(id, data);
  });

  ipcMain.handle('db:transactions:delete', async (_event, id: string) => {
    return db.deleteTransaction(id);
  });

  // Finance Summary
  ipcMain.handle('db:finance:summary', async (_event, dateFrom?: string, dateTo?: string) => {
    return db.getFinanceSummary(dateFrom, dateTo);
  });

  // Savings Goals
  ipcMain.handle('db:finance:savings:list', async () => {
    return db.getSavingsGoals();
  });

  ipcMain.handle('db:finance:savings:create', async (_event, data: Record<string, unknown>) => {
    return db.createSavingsGoal(data);
  });

  ipcMain.handle('db:finance:savings:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateSavingsGoal(id, data);
  });

  // Student Rates
  ipcMain.handle('db:finance:rates:get', async (_event, studentId: string) => {
    return db.getStudentRate(studentId);
  });

  ipcMain.handle('db:finance:rates:set', async (_event, studentId: string, rate: number, currency?: string, notes?: string) => {
    return db.setStudentRate(studentId, rate, currency, notes);
  });

  // Workouts (legacy)
  ipcMain.handle('db:workouts:list', async () => {
    return db.getWorkouts();
  });

  ipcMain.handle('db:workouts:create', async (_event, data: Record<string, unknown>) => {
    return db.createWorkout(data);
  });

  // Health: Workouts V2
  ipcMain.handle('db:health:workouts:list', async (_event, dateFrom?: string, dateTo?: string) => {
    return db.getWorkoutsV2(dateFrom, dateTo);
  });

  ipcMain.handle('db:health:workouts:create', async (_event, data: Record<string, unknown>) => {
    return db.createWorkoutV2(data);
  });

  ipcMain.handle('db:health:workouts:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateWorkoutV2(id, data);
  });

  ipcMain.handle('db:health:workouts:delete', async (_event, id: string) => {
    return db.deleteWorkoutV2(id);
  });

  // Health: Exercises
  ipcMain.handle('db:health:exercises:list', async (_event, workoutId: string) => {
    return db.getWorkoutExercises(workoutId);
  });

  ipcMain.handle('db:health:exercises:create', async (_event, data: Record<string, unknown>) => {
    return db.createWorkoutExercise(data);
  });

  ipcMain.handle('db:health:exercises:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateWorkoutExercise(id, data);
  });

  ipcMain.handle('db:health:exercises:delete', async (_event, id: string) => {
    return db.deleteWorkoutExercise(id);
  });

  // Health: Logs
  ipcMain.handle('db:health:logs:list', async (_event, type?: string, dateFrom?: string, dateTo?: string) => {
    return db.getHealthLogs(type, dateFrom, dateTo);
  });

  ipcMain.handle('db:health:logs:create', async (_event, data: Record<string, unknown>) => {
    return db.createHealthLog(data);
  });

  ipcMain.handle('db:health:logs:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateHealthLog(id, data);
  });

  ipcMain.handle('db:health:logs:delete', async (_event, id: string) => {
    return db.deleteHealthLog(id);
  });

  // Health: Goals
  ipcMain.handle('db:health:goals:list', async () => {
    return db.getHealthGoals();
  });

  ipcMain.handle('db:health:goals:create', async (_event, data: Record<string, unknown>) => {
    return db.createHealthGoal(data);
  });

  ipcMain.handle('db:health:goals:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateHealthGoal(id, data);
  });

  // Health: Training Programs
  ipcMain.handle('db:health:programs:list', async () => {
    return db.getTrainingPrograms();
  });

  ipcMain.handle('db:health:programs:create', async (_event, data: Record<string, unknown>) => {
    return db.createTrainingProgram(data);
  });

  ipcMain.handle('db:health:programs:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateTrainingProgram(id, data);
  });

  ipcMain.handle('db:health:programs:delete', async (_event, id: string) => {
    return db.deleteTrainingProgram(id);
  });

  // Health: Training Program Days
  ipcMain.handle('db:health:program-days:list', async (_event, programId: string) => {
    return db.getTrainingProgramDays(programId);
  });

  ipcMain.handle('db:health:program-days:create', async (_event, data: Record<string, unknown>) => {
    return db.createTrainingProgramDay(data);
  });

  ipcMain.handle('db:health:program-days:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateTrainingProgramDay(id, data);
  });

  ipcMain.handle('db:health:program-days:delete', async (_event, id: string) => {
    return db.deleteTrainingProgramDay(id);
  });

  // Health: Meal Plans
  ipcMain.handle('db:health:meal-plans:list', async () => {
    return db.getMealPlans();
  });

  ipcMain.handle('db:health:meal-plans:create', async (_event, data: Record<string, unknown>) => {
    return db.createMealPlan(data);
  });

  ipcMain.handle('db:health:meal-plans:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateMealPlan(id, data);
  });

  // Health: Meals
  ipcMain.handle('db:health:meals:list', async (_event, date?: string, dateFrom?: string, dateTo?: string) => {
    return db.getMeals(date, dateFrom, dateTo);
  });

  ipcMain.handle('db:health:meals:create', async (_event, data: Record<string, unknown>) => {
    return db.createMeal(data);
  });

  ipcMain.handle('db:health:meals:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateMeal(id, data);
  });

  ipcMain.handle('db:health:meals:delete', async (_event, id: string) => {
    return db.deleteMeal(id);
  });

  // Health: Daily Checklist
  ipcMain.handle('db:health:checklist:get', async (_event, date: string) => {
    return db.getDailyChecklist(date);
  });

  ipcMain.handle('db:health:checklist:upsert', async (_event, date: string, data: Record<string, unknown>) => {
    return db.upsertDailyChecklist(date, data);
  });

  ipcMain.handle('db:health:checklist:refresh', async (_event, date: string) => {
    return db.refreshDailyChecklist(date);
  });

  // Daily Notes
  ipcMain.handle('db:notes:create', async (_event, data: Record<string, unknown>) => {
    return db.createDailyNote(data);
  });

  // Attached Files
  ipcMain.handle('db:files:list', async (_event, entityType: string, entityId?: string) => {
    return db.getAttachedFiles(entityType, entityId);
  });

  ipcMain.handle('db:files:homework', async (_event, topicId?: string | null, studentId?: string | null) => {
    return db.getHomeworkFiles(topicId, studentId);
  });

  ipcMain.handle('db:files:create', async (_event, data: Record<string, unknown>) => {
    return db.createAttachedFile(data);
  });

  ipcMain.handle('db:files:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateAttachedFile(id, data);
  });

  // Lessons
  ipcMain.handle('db:lessons:list', async (_event, studentId?: string) => {
    return db.getLessons(studentId);
  });

  ipcMain.handle('db:lessons:create', async (_event, data: Record<string, unknown>) => {
    return db.createLesson(data);
  });

  ipcMain.handle('db:lessons:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateLesson(id, data);
  });

  ipcMain.handle('db:lessons:delete', async (_event, id: string) => {
    return db.deleteLesson(id);
  });

  // Learning Path
  ipcMain.handle('db:learning-path:list', async (_event, studentId: string) => {
    return db.getLearningPath(studentId);
  });

  ipcMain.handle('db:learning-path:create', async (_event, data: Record<string, unknown>) => {
    return db.createLearningPathTopic(data);
  });

  ipcMain.handle('db:learning-path:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateLearningPathTopic(id, data);
  });

  ipcMain.handle('db:learning-path:delete', async (_event, id: string) => {
    return db.deleteLearningPathTopic(id);
  });

  ipcMain.handle('db:learning-path:reorder', async (_event, studentId: string, topicIds: string[]) => {
    return db.reorderLearningPathTopics(studentId, topicIds);
  });

  // Reminders
  ipcMain.handle('db:reminders:list', async (_event, filters?: Record<string, unknown>) => {
    return db.getReminders(filters as Parameters<typeof db.getReminders>[0]);
  });

  ipcMain.handle('db:reminders:create', async (_event, data: Record<string, unknown>) => {
    return db.createReminder(data);
  });

  ipcMain.handle('db:reminders:update', async (_event, id: string, data: Record<string, unknown>) => {
    return db.updateReminder(id, data);
  });

  ipcMain.handle('db:reminders:delete', async (_event, id: string) => {
    return db.deleteReminder(id);
  });

  ipcMain.handle('db:reminders:complete', async (_event, id: string) => {
    return db.completeReminder(id);
  });

  ipcMain.handle('db:reminders:uncomplete', async (_event, id: string) => {
    return db.uncompleteReminder(id);
  });

  // Aggregated Tasks
  ipcMain.handle('tasks:aggregated:get', async (_event, dateStr: string) => {
    return getAggregatedTasks(new Date(dateStr));
  });

  // === File operations ===

  ipcMain.handle('file:open', async (_event, filePath: string) => {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(os.homedir(), 'mark2', filePath);
    console.log('[File] Opening:', resolved, '(original:', filePath, ')');
    return shell.openPath(resolved);
  });

  ipcMain.handle('file:get-info', async (_event, filePath: string) => {
    try {
      const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(os.homedir(), 'mark2', filePath);
      const stats = fs.statSync(resolved);
      return { size: stats.size, isFile: stats.isFile() };
    } catch { return null; }
  });

  ipcMain.handle('file:read-base64', async (_event, filePath: string) => {
    try {
      const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(os.homedir(), 'mark2', filePath);
      const buf = fs.readFileSync(resolved);
      return buf.toString('base64');
    } catch { return null; }
  });

  ipcMain.handle('dialog:open-files', async () => {
    const win = getWindow();
    if (!win) return [];
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('dialog:open-directory', async () => {
    const win = getWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  // === Dev file operations ===

  const DEV_IGNORED_DIRS = new Set([
    'node_modules', '.git', '.next', 'dist', 'build', '.cache',
    '.turbo', '.vercel', '__pycache__', '.svelte-kit', '.nuxt',
    'coverage', '.output', '.parcel-cache',
  ]);

  const DEV_IGNORED_FILES = new Set(['.env', '.env.local', '.env.production', '.DS_Store']);

  function buildDevTree(dirPath: string): FileTreeNode[] {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => {
          if (e.name.startsWith('.') && e.isDirectory()) return false;
          if (e.isDirectory() && DEV_IGNORED_DIRS.has(e.name)) return false;
          if (e.isFile() && DEV_IGNORED_FILES.has(e.name)) return false;
          return true;
        })
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        })
        .map((e) => {
          const fullPath = path.resolve(dirPath, e.name);
          if (e.isDirectory()) {
            return { name: e.name, path: fullPath, isDir: true, children: buildDevTree(fullPath) };
          }
          return { name: e.name, path: fullPath, isDir: false };
        });
    } catch {
      return [];
    }
  }

  ipcMain.handle('dev:files:tree', async (_event, localPath: string) => {
    if (!localPath || !fs.existsSync(localPath)) return [];
    return buildDevTree(localPath);
  });

  ipcMain.handle('dev:files:read', async (_event, filePath: string) => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return '';
    }
  });

  ipcMain.handle('dev:files:write', async (_event, filePath: string, content: string) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
  });

  ipcMain.handle('dev:files:open-in-editor', async (_event, filePath: string) => {
    exec(`code ${JSON.stringify(filePath)}`);
  });

  ipcMain.handle('dev:files:show-in-finder', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  // Dev file watcher
  const devFsWatchers = new Map<string, fs.FSWatcher>();

  ipcMain.handle('dev:files:watch-start', async (_event, localPath: string) => {
    if (devFsWatchers.has(localPath)) return;
    if (!fs.existsSync(localPath)) return;
    try {
      const watcher = fs.watch(localPath, { recursive: true }, () => {
        const win = getWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('dev:files:watch-update', localPath);
        }
      });
      devFsWatchers.set(localPath, watcher);
    } catch { /* fs.watch not supported or dir missing */ }
  });

  ipcMain.handle('dev:files:watch-stop', async (_event, localPath: string) => {
    const watcher = devFsWatchers.get(localPath);
    if (watcher) {
      watcher.close();
      devFsWatchers.delete(localPath);
    }
  });

  // === Study file operations ===

  const studyBasePath = path.resolve(os.homedir(), 'mark2', 'agents', 'study', 'context', 'subjects');

  ipcMain.handle('study:files:list', async (_event, subjectSlug: string, folder: string) => {
    const dirPath = path.resolve(studyBasePath, subjectSlug, folder);
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile())
        .map((e) => ({ name: e.name, path: path.resolve(dirPath, e.name) }));
    } catch {
      return [];
    }
  });

  ipcMain.handle('study:files:read', async (_event, filePath: string) => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return '';
    }
  });

  ipcMain.handle('study:files:write', async (_event, filePath: string, content: string) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
  });

  ipcMain.handle('study:files:create', async (_event, subjectSlug: string, folder: string, filename: string) => {
    const dirPath = path.resolve(studyBasePath, subjectSlug, folder);
    fs.mkdirSync(dirPath, { recursive: true });
    const filePath = path.resolve(dirPath, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '', 'utf-8');
    }
    return { name: filename, path: filePath };
  });

  ipcMain.handle('study:files:delete', async (_event, filePath: string) => {
    try {
      fs.unlinkSync(filePath);
    } catch { /* ignore */ }
  });

  // Recursive file tree for a subject
  interface FileTreeNode {
    name: string;
    path: string;
    isDir: boolean;
    children?: FileTreeNode[];
  }

  function buildTree(dirPath: string): FileTreeNode[] {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => !e.name.startsWith('.'))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        })
        .map((e) => {
          const fullPath = path.resolve(dirPath, e.name);
          if (e.isDirectory()) {
            return { name: e.name, path: fullPath, isDir: true, children: buildTree(fullPath) };
          }
          return { name: e.name, path: fullPath, isDir: false };
        });
    } catch {
      return [];
    }
  }

  ipcMain.handle('study:files:tree', async (_event, subjectSlug: string) => {
    const dirPath = path.resolve(studyBasePath, subjectSlug);
    return buildTree(dirPath);
  });

  ipcMain.handle('study:files:all-tree', async () => {
    try {
      fs.mkdirSync(studyBasePath, { recursive: true });
      const entries = fs.readdirSync(studyBasePath, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((e) => ({
          name: e.name,
          path: path.resolve(studyBasePath, e.name),
          isDir: true,
          children: buildTree(path.resolve(studyBasePath, e.name)),
        }));
    } catch {
      return [];
    }
  });

  ipcMain.handle('study:files:rename', async (_event, oldPath: string, newPath: string) => {
    fs.renameSync(oldPath, newPath);
  });

  ipcMain.handle('study:files:copy', async (_event, sourcePath: string, destFolder: string) => {
    const fileName = path.basename(sourcePath);
    const destPath = path.resolve(destFolder, fileName);
    fs.mkdirSync(destFolder, { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
    return { name: fileName, path: destPath };
  });

  // File system watcher
  const fsWatchers = new Map<string, fs.FSWatcher>();

  ipcMain.handle('study:files:watch-start', async (_event, subjectSlug: string) => {
    const key = subjectSlug;
    if (fsWatchers.has(key)) return;
    const dirPath = path.resolve(studyBasePath, subjectSlug);
    fs.mkdirSync(dirPath, { recursive: true });
    try {
      const watcher = fs.watch(dirPath, { recursive: true }, () => {
        const win = getWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('study:files:watch-update', subjectSlug);
        }
      });
      fsWatchers.set(key, watcher);
    } catch { /* fs.watch not supported or dir missing */ }
  });

  ipcMain.handle('study:files:watch-stop', async (_event, subjectSlug: string) => {
    const watcher = fsWatchers.get(subjectSlug);
    if (watcher) {
      watcher.close();
      fsWatchers.delete(subjectSlug);
    }
  });

  ipcMain.handle('claude:stop-session', (_event, sessionId: string) => {
    const proc = cliSessions.get(sessionId);
    if (proc) {
      proc.kill();
      cliSessions.delete(sessionId);
    }
  });

  // === Timer control (from AI actions) ===
  ipcMain.handle('timer:start', (_event, params: Record<string, unknown>) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('timer:control', 'start', params);
      }
    }
  });

  ipcMain.handle('timer:stop', () => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('timer:control', 'stop', {});
      }
    }
  });
}

export function cleanupSessions(): void {
  for (const [id, proc] of cliSessions) {
    proc.kill();
    cliSessions.delete(id);
  }
}
