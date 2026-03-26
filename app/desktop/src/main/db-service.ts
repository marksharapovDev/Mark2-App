import { getSupabase, resetSupabase } from './supabase-client';
import type {
  Task,
  CalendarEvent,
  DevProjectV2,
  DevTask,
  DevTimeEntry,
  Student,
  Subject,
  StudyAssignment,
  StudyExam,
  Transaction,
  Workout,
  DailyNote,
  Sphere,
  AttachedFile,
  Lesson,
  LearningPathTopic,
  SavingsGoal,
  StudentRate,
  FinanceSummary,
  WorkoutV2,
  WorkoutExercise,
  HealthLog,
  HealthGoal,
  TrainingProgram,
  TrainingProgramDay,
  MealPlan,
  Meal,
  DailyChecklist,
  Reminder,
} from '@mark2/shared';

// --- Retry wrapper for EPIPE/fetch errors ---

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes('fetch failed') || msg.includes('EPIPE') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT');
      if (isTransient && attempt < maxAttempts) {
        console.warn(`[DB] Retry attempt ${attempt}/${maxAttempts}: ${msg}`);
        resetSupabase();
        await sleep(2000 * attempt);
        continue;
      }
      throw err;
    }
  }
  throw new Error('withRetry: unreachable');
}

// --- Helpers: snake_case ↔ camelCase mapping ---

function snakeToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

function camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

function mapRow<T>(row: Record<string, unknown>): T {
  return snakeToCamel(row) as T;
}

function mapRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => mapRow<T>(r));
}

function toDbFields(data: Record<string, unknown>): Record<string, unknown> {
  return camelToSnake(data);
}

/**
 * Ensure a datetime string is a proper ISO with timezone offset.
 * Naive strings like "2026-03-28T20:00:00" are treated as LOCAL time
 * and get the local timezone offset appended.
 */
function ensureLocalTimezone(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  // Already has timezone info (+XX:XX, -XX:XX, or Z)
  if (/[Zz]$/.test(value) || /[+-]\d{2}:\d{2}$/.test(value)) return value;
  // Naive datetime — interpret as local, convert to ISO with offset
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toISOString();
}

// --- Tasks ---

export async function getTasks(sphere?: Sphere): Promise<Task[]> {
  const sb = getSupabase();
  let query = sb.from('tasks').select('*').order('created_at', { ascending: false });
  if (sphere) {
    query = query.eq('sphere', sphere);
  }
  const { data, error } = await query;
  if (error) throw error;
  return mapRows<Task>(data);
}

export async function getTask(id: string): Promise<Task> {
  const sb = getSupabase();
  const { data, error } = await sb.from('tasks').select('*').eq('id', id).single();
  if (error) throw error;
  return mapRow<Task>(data);
}

export async function createTask(input: Record<string, unknown>): Promise<Task> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('tasks').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<Task>(data);
  });
}

export async function updateTask(id: string, input: Record<string, unknown>): Promise<Task> {
  const sb = getSupabase();
  const fields = toDbFields(input);
  fields.updated_at = new Date().toISOString();
  const { data, error } = await sb.from('tasks').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return mapRow<Task>(data);
}

export async function deleteTask(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

// --- Calendar Events ---

export async function getCalendarEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('calendar_events')
    .select('*')
    .gte('start_at', startDate)
    .lte('start_at', endDate)
    .order('start_at', { ascending: true });
  if (error) throw error;
  return mapRows<CalendarEvent>(data);
}

export async function createCalendarEvent(input: Record<string, unknown>): Promise<CalendarEvent> {
  return withRetry(async () => {
    const sb = getSupabase();
    const fixed = { ...input };
    if (fixed.startAt) fixed.startAt = ensureLocalTimezone(fixed.startAt);
    if (fixed.endAt) fixed.endAt = ensureLocalTimezone(fixed.endAt);
    const { data, error } = await sb.from('calendar_events').insert(toDbFields(fixed)).select().single();
    if (error) throw error;
    return mapRow<CalendarEvent>(data);
  });
}

export async function updateCalendarEvent(id: string, input: Record<string, unknown>): Promise<CalendarEvent> {
  const sb = getSupabase();
  const fixed = { ...input };
  if (fixed.startAt) fixed.startAt = ensureLocalTimezone(fixed.startAt);
  if (fixed.endAt) fixed.endAt = ensureLocalTimezone(fixed.endAt);
  const { data, error } = await sb.from('calendar_events').update(toDbFields(fixed)).eq('id', id).select().single();
  if (error) throw error;
  return mapRow<CalendarEvent>(data);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('calendar_events').delete().eq('id', id);
  if (error) throw error;
}

// --- Dev Projects ---

export async function getProjects(filters?: { status?: string }): Promise<DevProjectV2[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    let query = sb.from('dev_projects').select('*').order('created_at', { ascending: false });
    if (filters?.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return mapRows<DevProjectV2>(data);
  });
}

export async function createProject(input: Record<string, unknown>): Promise<DevProjectV2> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('dev_projects').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<DevProjectV2>(data);
  });
}

export async function updateProject(id: string, input: Record<string, unknown>): Promise<DevProjectV2> {
  return withRetry(async () => {
    const sb = getSupabase();
    const fields = toDbFields(input);
    fields.updated_at = new Date().toISOString();
    const { data, error } = await sb.from('dev_projects').update(fields).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<DevProjectV2>(data);
  });
}

export async function deleteProject(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('dev_projects').delete().eq('id', id);
    if (error) throw error;
  });
}

export async function findProjectByName(name: string): Promise<DevProjectV2 | null> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('dev_projects').select('*').ilike('name', `%${name}%`).limit(1).maybeSingle();
    if (error) throw error;
    return data ? mapRow<DevProjectV2>(data) : null;
  });
}

// --- Dev Tasks ---

export async function getDevTasks(projectId: string, status?: string): Promise<DevTask[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    let query = sb.from('dev_tasks').select('*').eq('project_id', projectId).order('order_index', { ascending: true });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return mapRows<DevTask>(data);
  });
}

export async function createDevTask(input: Record<string, unknown>): Promise<DevTask> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('dev_tasks').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<DevTask>(data);
  });
}

export async function updateDevTask(id: string, input: Record<string, unknown>): Promise<DevTask> {
  return withRetry(async () => {
    const sb = getSupabase();
    const fields = toDbFields(input);
    fields.updated_at = new Date().toISOString();
    const { data, error } = await sb.from('dev_tasks').update(fields).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<DevTask>(data);
  });
}

export async function deleteDevTask(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('dev_tasks').delete().eq('id', id);
    if (error) throw error;
  });
}

export async function reorderDevTasks(projectId: string, taskIds: string[]): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    for (let i = 0; i < taskIds.length; i++) {
      const { error } = await sb
        .from('dev_tasks')
        .update({ order_index: i, updated_at: new Date().toISOString() })
        .eq('id', taskIds[i])
        .eq('project_id', projectId);
      if (error) throw error;
    }
  });
}

// --- Dev Time Entries ---

export async function getDevTimeEntries(taskId?: string, projectId?: string): Promise<DevTimeEntry[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    let query = sb.from('dev_time_entries').select('*').order('started_at', { ascending: false });
    if (taskId) query = query.eq('task_id', taskId);
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) throw error;
    return mapRows<DevTimeEntry>(data);
  });
}

export async function createDevTimeEntry(input: Record<string, unknown>): Promise<DevTimeEntry> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('dev_time_entries').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<DevTimeEntry>(data);
  });
}

export async function updateDevTimeEntry(id: string, input: Record<string, unknown>): Promise<DevTimeEntry> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('dev_time_entries').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<DevTimeEntry>(data);
  });
}

// --- Students ---

export async function getStudents(): Promise<Student[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('students').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return mapRows<Student>(data);
}

export async function findStudentByName(name: string): Promise<Student | null> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('students').select('*').ilike('name', `%${name}%`).limit(1).maybeSingle();
    if (error) throw error;
    return data ? mapRow<Student>(data) : null;
  });
}

export async function createStudent(input: Record<string, unknown>): Promise<Student> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('students').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<Student>(data);
  });
}

export async function updateStudent(id: string, input: Record<string, unknown>): Promise<Student> {
  const sb = getSupabase();
  const { data, error } = await sb.from('students').update(toDbFields(input)).eq('id', id).select().single();
  if (error) throw error;
  return mapRow<Student>(data);
}

export async function deleteStudent(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('students').delete().eq('id', id);
  if (error) throw error;
}

// --- Subjects ---

export async function getSubjects(semester?: number): Promise<Subject[]> {
  const sb = getSupabase();
  let query = sb.from('subjects').select('*').order('created_at', { ascending: false });
  if (semester !== undefined) {
    query = query.eq('semester', semester);
  }
  const { data, error } = await query;
  if (error) throw error;
  return mapRows<Subject>(data);
}

export async function createSubject(input: Record<string, unknown>): Promise<Subject> {
  const sb = getSupabase();
  const { data, error } = await sb.from('subjects').insert(toDbFields(input)).select().single();
  if (error) throw error;
  return mapRow<Subject>(data);
}

export async function updateSubject(id: string, input: Record<string, unknown>): Promise<Subject> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('subjects').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<Subject>(data);
  });
}

export async function deleteSubject(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('subjects').delete().eq('id', id);
    if (error) throw error;
  });
}

export async function findSubjectByName(name: string): Promise<Subject | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from('subjects').select('*');
  if (error) throw error;
  const rows = mapRows<Subject>(data);
  const lower = name.toLowerCase();
  return rows.find((s) => s.name.toLowerCase().includes(lower)) ?? null;
}

// --- Study Assignments ---

export async function getStudyAssignments(subjectId?: string): Promise<StudyAssignment[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    let query = sb.from('study_assignments').select('*').order('created_at', { ascending: false });
    if (subjectId) query = query.eq('subject_id', subjectId);
    const { data, error } = await query;
    if (error) throw error;
    return mapRows<StudyAssignment>(data);
  });
}

export async function createStudyAssignment(input: Record<string, unknown>): Promise<StudyAssignment> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('study_assignments').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<StudyAssignment>(data);
  });
}

export async function updateStudyAssignment(id: string, input: Record<string, unknown>): Promise<StudyAssignment> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('study_assignments').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<StudyAssignment>(data);
  });
}

export async function deleteStudyAssignment(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('study_assignments').delete().eq('id', id);
    if (error) throw error;
  });
}

// --- Study Exams ---

export async function getStudyExams(subjectId?: string): Promise<StudyExam[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    let query = sb.from('study_exams').select('*').order('date', { ascending: true });
    if (subjectId) query = query.eq('subject_id', subjectId);
    const { data, error } = await query;
    if (error) throw error;
    return mapRows<StudyExam>(data);
  });
}

export async function createStudyExam(input: Record<string, unknown>): Promise<StudyExam> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('study_exams').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<StudyExam>(data);
  });
}

export async function updateStudyExam(id: string, input: Record<string, unknown>): Promise<StudyExam> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('study_exams').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<StudyExam>(data);
  });
}

export async function deleteStudyExam(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('study_exams').delete().eq('id', id);
    if (error) throw error;
  });
}

// --- Transactions ---

export async function getTransactions(filters?: {
  type?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  studentId?: string;
  month?: string;
}): Promise<Transaction[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    let query = sb.from('transactions').select('*').order('date', { ascending: false });
    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.studentId) query = query.eq('student_id', filters.studentId);
    if (filters?.dateFrom) query = query.gte('date', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('date', filters.dateTo);
    if (filters?.month) {
      const start = `${filters.month}-01`;
      const parts = filters.month.split('-').map(Number);
      const y = parts[0] ?? 0;
      const m = parts[1] ?? 0;
      const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      query = query.gte('date', start).lt('date', `${nextMonth}-01`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return mapRows<Transaction>(data);
  });
}

export async function createTransaction(input: Record<string, unknown>): Promise<Transaction> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('transactions').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<Transaction>(data);
  });
}

export async function updateTransaction(id: string, input: Record<string, unknown>): Promise<Transaction> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('transactions').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<Transaction>(data);
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('transactions').delete().eq('id', id);
    if (error) throw error;
  });
}

export async function getFinanceSummary(dateFrom?: string, dateTo?: string): Promise<FinanceSummary> {
  return withRetry(async () => {
    const sb = getSupabase();
    let query = sb.from('transactions').select('type, amount');
    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);
    const { data, error } = await query;
    if (error) throw error;

    let totalIncome = 0;
    let totalExpense = 0;
    let totalSavings = 0;
    let taxReserve = 0;

    for (const row of data) {
      const amount = Number(row.amount) || 0;
      switch (row.type) {
        case 'income': totalIncome += amount; break;
        case 'expense': totalExpense += amount; break;
        case 'savings': totalSavings += amount; break;
        case 'tax': taxReserve += amount; break;
      }
    }

    const period = dateFrom && dateTo ? `${dateFrom} — ${dateTo}` : 'all';
    return {
      totalIncome,
      totalExpense,
      totalSavings,
      taxReserve,
      netBalance: totalIncome - totalExpense - totalSavings - taxReserve,
      period,
    };
  });
}

// --- Savings Goals ---

export async function getSavingsGoals(): Promise<SavingsGoal[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('savings_goals').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return mapRows<SavingsGoal>(data);
  });
}

export async function createSavingsGoal(input: Record<string, unknown>): Promise<SavingsGoal> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('savings_goals').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<SavingsGoal>(data);
  });
}

export async function updateSavingsGoal(id: string, input: Record<string, unknown>): Promise<SavingsGoal> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('savings_goals').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<SavingsGoal>(data);
  });
}

// --- Student Rates ---

export async function getStudentRate(studentId: string): Promise<StudentRate | null> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('student_rates').select('*').eq('student_id', studentId).maybeSingle();
    if (error) throw error;
    return data ? mapRow<StudentRate>(data) : null;
  });
}

export async function setStudentRate(studentId: string, ratePerLesson: number, currency = 'RUB', notes?: string): Promise<StudentRate> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('student_rates')
      .upsert({ student_id: studentId, rate_per_lesson: ratePerLesson, currency, notes: notes ?? null }, { onConflict: 'student_id' })
      .select().single();
    if (error) throw error;
    return mapRow<StudentRate>(data);
  });
}

// --- Workouts (legacy) ---

export async function getWorkouts(): Promise<Workout[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('workouts').select('*').order('date', { ascending: false });
  if (error) throw error;
  return mapRows<Workout>(data);
}

export async function createWorkout(input: Record<string, unknown>): Promise<Workout> {
  const sb = getSupabase();
  const { data, error } = await sb.from('workouts').insert(toDbFields(input)).select().single();
  if (error) throw error;
  return mapRow<Workout>(data);
}

// --- Workouts V2 ---

export async function getWorkoutsV2(dateFrom?: string, dateTo?: string): Promise<WorkoutV2[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    let query = sb.from('workouts').select('*').order('date', { ascending: false });
    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);
    const { data, error } = await query;
    if (error) throw error;
    return mapRows<WorkoutV2>(data);
  });
}

export async function createWorkoutV2(input: Record<string, unknown>): Promise<WorkoutV2> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('workouts').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<WorkoutV2>(data);
  });
}

export async function updateWorkoutV2(id: string, input: Record<string, unknown>): Promise<WorkoutV2> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('workouts').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<WorkoutV2>(data);
  });
}

export async function deleteWorkoutV2(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('workouts').delete().eq('id', id);
    if (error) throw error;
  });
}

// --- Workout Exercises ---

export async function getWorkoutExercises(workoutId: string): Promise<WorkoutExercise[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('workout_exercises').select('*')
      .eq('workout_id', workoutId).order('order_index', { ascending: true });
    if (error) throw error;
    return mapRows<WorkoutExercise>(data);
  });
}

export async function createWorkoutExercise(input: Record<string, unknown>): Promise<WorkoutExercise> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('workout_exercises').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<WorkoutExercise>(data);
  });
}

export async function updateWorkoutExercise(id: string, input: Record<string, unknown>): Promise<WorkoutExercise> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('workout_exercises').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<WorkoutExercise>(data);
  });
}

export async function deleteWorkoutExercise(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('workout_exercises').delete().eq('id', id);
    if (error) throw error;
  });
}

// --- Health Logs ---

export async function getHealthLogs(type?: string, dateFrom?: string, dateTo?: string): Promise<HealthLog[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    let query = sb.from('health_logs').select('*').order('date', { ascending: false });
    if (type) query = query.eq('type', type);
    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);
    const { data, error } = await query;
    if (error) throw error;
    return mapRows<HealthLog>(data);
  });
}

export async function createHealthLog(input: Record<string, unknown>): Promise<HealthLog> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('health_logs').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<HealthLog>(data);
  });
}

export async function updateHealthLog(id: string, input: Record<string, unknown>): Promise<HealthLog> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('health_logs').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<HealthLog>(data);
  });
}

export async function deleteHealthLog(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('health_logs').delete().eq('id', id);
    if (error) throw error;
  });
}

// --- Health Goals ---

export async function getHealthGoals(): Promise<HealthGoal[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('health_goals').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return mapRows<HealthGoal>(data);
  });
}

export async function createHealthGoal(input: Record<string, unknown>): Promise<HealthGoal> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('health_goals').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<HealthGoal>(data);
  });
}

export async function updateHealthGoal(id: string, input: Record<string, unknown>): Promise<HealthGoal> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('health_goals').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<HealthGoal>(data);
  });
}

// --- Training Programs ---

export async function getTrainingPrograms(): Promise<TrainingProgram[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('training_programs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return mapRows<TrainingProgram>(data);
  });
}

export async function createTrainingProgram(input: Record<string, unknown>): Promise<TrainingProgram> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('training_programs').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<TrainingProgram>(data);
  });
}

export async function updateTrainingProgram(id: string, input: Record<string, unknown>): Promise<TrainingProgram> {
  return withRetry(async () => {
    const sb = getSupabase();
    const fields = toDbFields(input);
    fields.updated_at = new Date().toISOString();
    const { data, error } = await sb.from('training_programs').update(fields).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<TrainingProgram>(data);
  });
}

export async function deleteTrainingProgram(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('training_programs').delete().eq('id', id);
    if (error) throw error;
  });
}

// --- Training Program Days ---

export async function getTrainingProgramDays(programId: string): Promise<TrainingProgramDay[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('training_program_days').select('*')
      .eq('program_id', programId).order('order_index', { ascending: true });
    if (error) throw error;
    return mapRows<TrainingProgramDay>(data);
  });
}

export async function createTrainingProgramDay(input: Record<string, unknown>): Promise<TrainingProgramDay> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('training_program_days').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<TrainingProgramDay>(data);
  });
}

export async function updateTrainingProgramDay(id: string, input: Record<string, unknown>): Promise<TrainingProgramDay> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('training_program_days').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<TrainingProgramDay>(data);
  });
}

export async function deleteTrainingProgramDay(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('training_program_days').delete().eq('id', id);
    if (error) throw error;
  });
}

// --- Meal Plans ---

export async function getMealPlans(): Promise<MealPlan[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('meal_plans').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return mapRows<MealPlan>(data);
  });
}

export async function createMealPlan(input: Record<string, unknown>): Promise<MealPlan> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('meal_plans').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<MealPlan>(data);
  });
}

export async function updateMealPlan(id: string, input: Record<string, unknown>): Promise<MealPlan> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('meal_plans').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<MealPlan>(data);
  });
}

// --- Meals ---

export async function getMeals(date?: string, dateFrom?: string, dateTo?: string): Promise<Meal[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    let query = sb.from('meals').select('*').order('created_at', { ascending: true });
    if (date) query = query.eq('date', date);
    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);
    const { data, error } = await query;
    if (error) throw error;
    return mapRows<Meal>(data);
  });
}

export async function createMeal(input: Record<string, unknown>): Promise<Meal> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('meals').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<Meal>(data);
  });
}

export async function updateMeal(id: string, input: Record<string, unknown>): Promise<Meal> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('meals').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<Meal>(data);
  });
}

export async function deleteMeal(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('meals').delete().eq('id', id);
    if (error) throw error;
  });
}

// --- Daily Checklist ---

export async function getDailyChecklist(date: string): Promise<DailyChecklist | null> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('daily_checklist').select('*').eq('date', date).maybeSingle();
    if (error) throw error;
    return data ? mapRow<DailyChecklist>(data) : null;
  });
}

export async function upsertDailyChecklist(date: string, updates: Record<string, unknown>): Promise<DailyChecklist> {
  return withRetry(async () => {
    const sb = getSupabase();
    const dbFields = toDbFields(updates);
    dbFields.date = date;
    dbFields.updated_at = new Date().toISOString();
    // Compute completed_count from the boolean fields
    const bools = ['workout', 'weight_logged', 'sleep_logged', 'water_goal', 'meals_logged'];
    let count = 0;
    for (const b of bools) {
      if (dbFields[b] === true) count++;
    }
    // Only set completed_count if we have all fields; otherwise merge with existing
    if (bools.every((b) => b in dbFields)) {
      dbFields.completed_count = count;
    }
    const { data, error } = await sb.from('daily_checklist')
      .upsert(dbFields, { onConflict: 'date' })
      .select().single();
    if (error) throw error;
    return mapRow<DailyChecklist>(data);
  });
}

/**
 * Re-compute the full checklist state for a given date by querying actual data,
 * then upsert it. Called after any health log/workout/meal action.
 */
export async function refreshDailyChecklist(date: string): Promise<DailyChecklist> {
  return withRetry(async () => {
    const sb = getSupabase();

    // Check workouts
    const { data: wData } = await sb.from('workouts').select('id').eq('date', date).limit(1);
    const hasWorkout = (wData?.length ?? 0) > 0;

    // Check health logs
    const { data: logData } = await sb.from('health_logs').select('type, value').eq('date', date);
    const logs = logData ?? [];
    const hasWeight = logs.some((l) => l.type === 'weight');
    const hasSleep = logs.some((l) => l.type === 'sleep');
    const waterLog = logs.find((l) => l.type === 'water');
    const waterGoal = waterLog != null && (Number(waterLog.value) >= 2);

    // Check meals — all 3 main meals required (breakfast, lunch, dinner)
    const { data: mData } = await sb.from('meals').select('type').eq('date', date);
    const mealTypes = new Set((mData ?? []).map((m) => m.type));
    const hasMeals = mealTypes.has('breakfast') && mealTypes.has('lunch') && mealTypes.has('dinner');

    const completed = [hasWorkout, hasWeight, hasSleep, waterGoal, hasMeals].filter(Boolean).length;

    return upsertDailyChecklist(date, {
      workout: hasWorkout,
      weightLogged: hasWeight,
      sleepLogged: hasSleep,
      waterGoal,
      mealsLogged: hasMeals,
      completedCount: completed,
    });
  });
}

// --- Daily Notes ---

export async function createDailyNote(input: Record<string, unknown>): Promise<DailyNote> {
  const sb = getSupabase();
  const { data, error } = await sb.from('daily_notes').insert(toDbFields(input)).select().single();
  if (error) throw error;
  return mapRow<DailyNote>(data);
}

// --- Attached Files ---

export async function getAttachedFiles(entityType: string, entityId?: string): Promise<AttachedFile[]> {
  const sb = getSupabase();
  let query = sb.from('attached_files').select('*').eq('entity_type', entityType).order('created_at', { ascending: false });
  if (entityId) {
    query = query.eq('entity_id', entityId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return mapRows<AttachedFile>(data);
}

export async function getHomeworkFiles(topicId?: string | null, studentId?: string | null): Promise<AttachedFile[]> {
  const sb = getSupabase();
  if (topicId) {
    // Strict: only return files for this specific topic
    const { data, error } = await sb.from('attached_files').select('*')
      .eq('category', 'homework').eq('topic_id', topicId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return mapRows<AttachedFile>(data);
  }
  // No topic_id provided — return all homework files for this student
  if (studentId) {
    const { data, error } = await sb.from('attached_files').select('*')
      .eq('category', 'homework').eq('entity_type', 'student').eq('entity_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return mapRows<AttachedFile>(data);
  }
  return [];
}

export async function createAttachedFile(input: Record<string, unknown>): Promise<AttachedFile> {
  return withRetry(async () => {
    const sb = getSupabase();
    const clean: Record<string, unknown> = { ...input };
    // entity_id must be a valid UUID or null
    if (clean.entityId && typeof clean.entityId === 'string' && !/^[0-9a-f-]{36}$/i.test(clean.entityId)) {
      console.warn('[DB] Invalid entityId (not UUID), setting to null:', clean.entityId);
      clean.entityId = null;
    }
    const dbFields = toDbFields(clean);
    console.log('[DB] Creating attached file:', JSON.stringify(dbFields));
    const { data, error } = await sb.from('attached_files').insert(dbFields).select().single();
    if (error) {
      console.error('[DB] createAttachedFile error:', JSON.stringify(error));
      throw error;
    }
    return mapRow<AttachedFile>(data);
  });
}

export async function updateAttachedFile(id: string, input: Record<string, unknown>): Promise<AttachedFile> {
  const sb = getSupabase();
  const dbFields = toDbFields(input);
  const { data, error } = await sb.from('attached_files').update(dbFields).eq('id', id).select().single();
  if (error) throw error;
  return mapRow<AttachedFile>(data);
}

// --- Lessons ---

export async function getLessons(studentId?: string): Promise<Lesson[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    let query = sb.from('lessons').select('*').order('date', { ascending: false });
    if (studentId) {
      query = query.eq('student_id', studentId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return mapRows<Lesson>(data);
  });
}

export async function createLesson(input: Record<string, unknown>): Promise<Lesson> {
  return withRetry(async () => {
    const sb = getSupabase();
    const dbFields = toDbFields(input);
    const { data, error } = await sb.from('lessons').insert(dbFields).select().single();
    if (error) throw error;
    return mapRow<Lesson>(data);
  });
}

export async function updateLesson(id: string, input: Record<string, unknown>): Promise<Lesson> {
  return withRetry(async () => {
    const sb = getSupabase();
    const dbFields = toDbFields(input);
    const { data, error } = await sb.from('lessons').update(dbFields).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<Lesson>(data);
  });
}

export async function deleteLesson(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('lessons').delete().eq('id', id);
    if (error) throw error;
  });
}

// --- Learning Path Topics ---

export async function getLearningPath(studentId: string): Promise<LearningPathTopic[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('learning_path_topics')
      .select('*')
      .eq('student_id', studentId)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return mapRows<LearningPathTopic>(data);
  });
}

export async function createLearningPathTopic(input: Record<string, unknown>): Promise<LearningPathTopic> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('learning_path_topics').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<LearningPathTopic>(data);
  });
}

export async function updateLearningPathTopic(id: string, input: Record<string, unknown>): Promise<LearningPathTopic> {
  return withRetry(async () => {
    const sb = getSupabase();
    const fields = toDbFields(input);
    fields.updated_at = new Date().toISOString();
    const { data, error } = await sb.from('learning_path_topics').update(fields).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<LearningPathTopic>(data);
  });
}

export async function deleteLearningPathTopic(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('learning_path_topics').delete().eq('id', id);
    if (error) throw error;
  });
}

export async function reorderLearningPathTopics(studentId: string, topicIds: string[]): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    for (let i = 0; i < topicIds.length; i++) {
      const { error } = await sb
        .from('learning_path_topics')
        .update({ order_index: i, updated_at: new Date().toISOString() })
        .eq('id', topicIds[i])
        .eq('student_id', studentId);
      if (error) throw error;
    }
  });
}

// --- Reminders ---

export async function getReminders(filters?: {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  sphere?: string;
}): Promise<Reminder[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    let query = sb.from('reminders').select('*').order('date', { ascending: true });
    if (filters?.dateFrom) query = query.gte('date', filters.dateFrom);
    if (filters?.dateTo) query = query.lte('date', filters.dateTo);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.sphere) query = query.eq('sphere', filters.sphere);
    const { data, error } = await query;
    if (error) throw error;
    return mapRows<Reminder>(data);
  });
}

export async function createReminder(input: Record<string, unknown>): Promise<Reminder> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('reminders').insert(toDbFields(input)).select().single();
    if (error) throw error;
    return mapRow<Reminder>(data);
  });
}

export async function updateReminder(id: string, input: Record<string, unknown>): Promise<Reminder> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('reminders').update(toDbFields(input)).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<Reminder>(data);
  });
}

export async function deleteReminder(id: string): Promise<void> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { error } = await sb.from('reminders').delete().eq('id', id);
    if (error) throw error;
  });
}

export async function completeReminder(id: string): Promise<Reminder> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('reminders').update({ status: 'done' }).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<Reminder>(data);
  });
}

export async function uncompleteReminder(id: string): Promise<Reminder> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('reminders').update({ status: 'pending' }).eq('id', id).select().single();
    if (error) throw error;
    return mapRow<Reminder>(data);
  });
}

export async function getRecurringReminders(): Promise<Reminder[]> {
  return withRetry(async () => {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('reminders')
      .select('*')
      .eq('is_recurring', true)
      .neq('status', 'done')
      .order('date', { ascending: true });
    if (error) throw error;
    return mapRows<Reminder>(data);
  });
}
