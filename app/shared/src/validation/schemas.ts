import { z } from 'zod';

// --- Enums ---

export const sphereSchema = z.enum(['dev', 'teaching', 'study', 'health', 'finance']);

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done', 'cancelled']);

export const projectStatusSchema = z.enum(['active', 'paused', 'completed', 'cancelled']);

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
  schedule: z.string().nullable(),
  type: z.string().nullable(),
  status: z.string().nullable(),
  color: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.coerce.date(),
});

export const createSubjectSchema = subjectSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  professor: true,
  schedule: true,
  type: true,
  status: true,
  color: true,
  metadata: true,
});

// --- Study Assignments ---

export const assignmentTypeSchema = z.enum(['homework', 'lab_report', 'essay', 'project', 'presentation', 'typical_calc', 'coursework', 'report', 'other']);
export const assignmentStatusSchema = z.enum(['pending', 'in_progress', 'submitted', 'graded']);

export const studyAssignmentSchema = z.object({
  id: z.string().uuid(),
  subjectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  type: assignmentTypeSchema,
  status: assignmentStatusSchema,
  deadline: z.string().nullable(),
  grade: z.string().nullable(),
  filePath: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const createStudyAssignmentSchema = studyAssignmentSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  description: true,
  type: true,
  status: true,
  deadline: true,
  grade: true,
  filePath: true,
});

// --- Study Exams ---

export const examTypeSchema = z.enum(['exam', 'credit', 'test', 'midterm']);
export const examStatusSchema = z.enum(['upcoming', 'passed', 'failed']);

export const studyExamSchema = z.object({
  id: z.string().uuid(),
  subjectId: z.string().uuid(),
  title: z.string().min(1),
  type: examTypeSchema,
  date: z.string().nullable(),
  status: examStatusSchema,
  grade: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const createStudyExamSchema = studyExamSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  type: true,
  date: true,
  status: true,
  grade: true,
  notes: true,
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

// --- Health v2 ---

export const workoutTypeV2Schema = z.enum(['gym', 'running', 'cycling', 'swimming', 'calisthenics', 'stretching', 'other']);
export const workoutMoodSchema = z.enum(['great', 'good', 'normal', 'tired', 'bad']);

export const workoutV2Schema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  type: workoutTypeV2Schema,
  title: z.string().nullable(),
  durationMinutes: z.number().int().nullable(),
  notes: z.string().nullable(),
  mood: workoutMoodSchema.nullable(),
  createdAt: z.coerce.date(),
});

export const createWorkoutV2Schema = workoutV2Schema.omit({
  id: true,
  createdAt: true,
}).partial({
  date: true,
  title: true,
  durationMinutes: true,
  notes: true,
  mood: true,
});

export const workoutExerciseSchema = z.object({
  id: z.string().uuid(),
  workoutId: z.string().uuid(),
  name: z.string().min(1),
  sets: z.number().int().nullable(),
  reps: z.string().nullable(),
  weightKg: z.number().nullable(),
  durationMinutes: z.number().int().nullable(),
  distanceKm: z.number().nullable(),
  orderIndex: z.number().int(),
  notes: z.string().nullable(),
});

export const createWorkoutExerciseSchema = workoutExerciseSchema.omit({
  id: true,
}).partial({
  sets: true,
  reps: true,
  weightKg: true,
  durationMinutes: true,
  distanceKm: true,
  orderIndex: true,
  notes: true,
});

export const healthLogTypeSchema = z.enum(['weight', 'sleep', 'water', 'mood', 'measurement']);

export const healthLogSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  type: healthLogTypeSchema,
  value: z.number().nullable(),
  data: z.record(z.unknown()).nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const createHealthLogSchema = healthLogSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  date: true,
  value: true,
  data: true,
  notes: true,
});

export const healthGoalTypeSchema = z.enum(['weight', 'strength', 'cardio', 'habit', 'other']);
export const healthGoalStatusSchema = z.enum(['active', 'completed', 'paused']);

export const healthGoalSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  type: healthGoalTypeSchema.nullable(),
  targetValue: z.number().nullable(),
  currentValue: z.number().nullable(),
  unit: z.string().nullable(),
  deadline: z.string().nullable(),
  status: healthGoalStatusSchema,
  createdAt: z.coerce.date(),
});

export const createHealthGoalSchema = healthGoalSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  type: true,
  targetValue: true,
  currentValue: true,
  unit: true,
  deadline: true,
  status: true,
});

// --- Training Programs ---

export const trainingProgramStatusSchema = z.enum(['active', 'completed', 'paused']);

export const trainingProgramSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  status: trainingProgramStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createTrainingProgramSchema = trainingProgramSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  description: true,
  status: true,
});

const trainingProgramDayExerciseSchema = z.object({
  name: z.string(),
  sets: z.number().int().optional(),
  reps: z.string().optional(),
  weightKg: z.number().optional(),
  notes: z.string().optional(),
});

export const trainingProgramDaySchema = z.object({
  id: z.string().uuid(),
  programId: z.string().uuid(),
  dayName: z.string().min(1),
  orderIndex: z.number().int(),
  exercises: z.array(trainingProgramDayExerciseSchema),
  notes: z.string().nullable(),
});

export const createTrainingProgramDaySchema = trainingProgramDaySchema.omit({
  id: true,
}).partial({
  orderIndex: true,
  exercises: true,
  notes: true,
});

// --- Nutrition ---

export const mealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export const mealPlanStatusSchema = z.enum(['active', 'paused']);

export const mealPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  dailyCalories: z.number().int().nullable(),
  proteinG: z.number().int().nullable(),
  carbsG: z.number().int().nullable(),
  fatG: z.number().int().nullable(),
  status: mealPlanStatusSchema,
  createdAt: z.coerce.date(),
});

export const createMealPlanSchema = mealPlanSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  dailyCalories: true,
  proteinG: true,
  carbsG: true,
  fatG: true,
  status: true,
});

export const mealSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  type: mealTypeSchema,
  title: z.string().nullable(),
  calories: z.number().int().nullable(),
  proteinG: z.number().int().nullable(),
  carbsG: z.number().int().nullable(),
  fatG: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export const createMealSchema = mealSchema.omit({
  id: true,
  createdAt: true,
}).partial({
  date: true,
  title: true,
  calories: true,
  proteinG: true,
  carbsG: true,
  fatG: true,
  notes: true,
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
