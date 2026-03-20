import { z } from 'zod';

// --- Enums ---

export const sphereSchema = z.enum(['dev', 'teaching', 'study', 'health', 'finance']);

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done', 'cancelled']);

export const projectStatusSchema = z.enum(['active', 'paused', 'completed', 'archived']);

export const studentLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const transactionTypeSchema = z.enum(['income', 'expense']);

export const transactionSourceSchema = z.enum(['manual', 'screenshot', 'voice']);

export const workoutTypeSchema = z.enum(['gym', 'run', 'swim']);

export const recurrenceSchema = z.enum(['daily', 'weekly', 'none']);

export const noteSourceSchema = z.enum(['mobile', 'desktop']);

// --- Schemas ---

export const taskSchema = z.object({
  id: z.string().uuid(),
  sphere: sphereSchema,
  title: z.string().min(1),
  description: z.string().nullable(),
  status: taskStatusSchema,
  priority: z.number().int(),
  dueDate: z.coerce.date().nullable(),
  parentId: z.string().uuid().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createTaskSchema = taskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  status: true,
  priority: true,
  description: true,
  dueDate: true,
  parentId: true,
  metadata: true,
});

export const devProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  status: projectStatusSchema,
  stack: z.record(z.unknown()),
  repoUrl: z.string().url().nullable(),
  deployUrl: z.string().url().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createDevProjectSchema = devProjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  status: true,
  stack: true,
  repoUrl: true,
  deployUrl: true,
});

export const studentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  subject: z.string().nullable(),
  level: studentLevelSchema.nullable(),
  schedule: z.record(z.unknown()).nullable(),
  stats: z.record(z.unknown()),
  createdAt: z.coerce.date(),
});

export const createStudentSchema = studentSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  subject: true,
  level: true,
  schedule: true,
  stats: true,
});

export const subjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  semester: z.number().int().positive(),
  professor: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.coerce.date(),
});

export const createSubjectSchema = subjectSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  professor: true,
  metadata: true,
});

export const transactionSchema = z.object({
  id: z.string().uuid(),
  amount: z.number(),
  type: transactionTypeSchema,
  category: z.string().nullable(),
  description: z.string().nullable(),
  date: z.string(),
  source: transactionSourceSchema,
  createdAt: z.coerce.date(),
});

export const createTransactionSchema = transactionSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  category: true,
  description: true,
  date: true,
  source: true,
});

export const exerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().positive().nullable(),
  reps: z.number().int().positive().nullable(),
  weight: z.number().positive().nullable(),
});

export const workoutSchema = z.object({
  id: z.string().uuid(),
  type: workoutTypeSchema,
  exercises: z.array(exerciseSchema).nullable(),
  duration: z.number().int().positive().nullable(),
  date: z.string(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const createWorkoutSchema = workoutSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  exercises: true,
  duration: true,
  date: true,
  notes: true,
});

export const calendarEventSchema = z.object({
  id: z.string().uuid(),
  sphere: sphereSchema,
  title: z.string().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().nullable(),
  recurrence: recurrenceSchema.nullable(),
  reminder: z.number().int().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.coerce.date(),
});

export const createCalendarEventSchema = calendarEventSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  endAt: true,
  recurrence: true,
  reminder: true,
  metadata: true,
});

export const dailyNoteSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
  sorted: z.record(z.unknown()).nullable(),
  source: noteSourceSchema,
  createdAt: z.coerce.date(),
});

export const createDailyNoteSchema = dailyNoteSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  sorted: true,
  source: true,
});

// --- Chat ---

export const agentNameSchema = z.enum(['dev', 'teaching', 'study', 'health', 'finance', 'general']);

export const chatEngineSchema = z.enum(['api', 'claude-code']);

export const chatRoleSchema = z.enum(['user', 'assistant']);

export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  agent: agentNameSchema,
  role: chatRoleSchema,
  content: z.string().min(1),
  engine: chatEngineSchema,
  createdAt: z.coerce.date(),
});
