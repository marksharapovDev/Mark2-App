import { getSupabase } from './supabase-client';
import type {
  Task,
  CalendarEvent,
  DevProject,
  Student,
  Subject,
  Transaction,
  Workout,
  DailyNote,
  Sphere,
} from '@mark2/shared';

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
  const sb = getSupabase();
  const { data, error } = await sb.from('tasks').insert(toDbFields(input)).select().single();
  if (error) throw error;
  return mapRow<Task>(data);
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
  const sb = getSupabase();
  const { data, error } = await sb.from('calendar_events').insert(toDbFields(input)).select().single();
  if (error) throw error;
  return mapRow<CalendarEvent>(data);
}

export async function updateCalendarEvent(id: string, input: Record<string, unknown>): Promise<CalendarEvent> {
  const sb = getSupabase();
  const { data, error } = await sb.from('calendar_events').update(toDbFields(input)).eq('id', id).select().single();
  if (error) throw error;
  return mapRow<CalendarEvent>(data);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('calendar_events').delete().eq('id', id);
  if (error) throw error;
}

// --- Dev Projects ---

export async function getProjects(): Promise<DevProject[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('dev_projects').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return mapRows<DevProject>(data);
}

export async function createProject(input: Record<string, unknown>): Promise<DevProject> {
  const sb = getSupabase();
  const { data, error } = await sb.from('dev_projects').insert(toDbFields(input)).select().single();
  if (error) throw error;
  return mapRow<DevProject>(data);
}

export async function updateProject(id: string, input: Record<string, unknown>): Promise<DevProject> {
  const sb = getSupabase();
  const fields = toDbFields(input);
  fields.updated_at = new Date().toISOString();
  const { data, error } = await sb.from('dev_projects').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return mapRow<DevProject>(data);
}

// --- Students ---

export async function getStudents(): Promise<Student[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from('students').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return mapRows<Student>(data);
}

export async function createStudent(input: Record<string, unknown>): Promise<Student> {
  const sb = getSupabase();
  const { data, error } = await sb.from('students').insert(toDbFields(input)).select().single();
  if (error) throw error;
  return mapRow<Student>(data);
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

// --- Transactions ---

export async function getTransactions(month?: string): Promise<Transaction[]> {
  const sb = getSupabase();
  let query = sb.from('transactions').select('*').order('date', { ascending: false });
  if (month) {
    // month format: "2026-03"
    const start = `${month}-01`;
    const parts = month.split('-').map(Number);
    const y = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    const end = `${nextMonth}-01`;
    query = query.gte('date', start).lt('date', end);
  }
  const { data, error } = await query;
  if (error) throw error;
  return mapRows<Transaction>(data);
}

export async function createTransaction(input: Record<string, unknown>): Promise<Transaction> {
  const sb = getSupabase();
  const { data, error } = await sb.from('transactions').insert(toDbFields(input)).select().single();
  if (error) throw error;
  return mapRow<Transaction>(data);
}

export async function deleteTransaction(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

// --- Workouts ---

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

// --- Daily Notes ---

export async function createDailyNote(input: Record<string, unknown>): Promise<DailyNote> {
  const sb = getSupabase();
  const { data, error } = await sb.from('daily_notes').insert(toDbFields(input)).select().single();
  if (error) throw error;
  return mapRow<DailyNote>(data);
}
