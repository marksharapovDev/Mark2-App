// Types
export type { Sphere, TaskStatus, Task } from './types/task.js';
export type { ProjectStatus, DevProject } from './types/project.js';
export type { StudentLevel, Student } from './types/student.js';
export type { Subject } from './types/subject.js';
export type { TransactionType, Transaction, IncomeCategory, ExpenseCategory, SavingsCategory, TaxCategory, TransactionCategory, SavingsGoal, StudentRate, FinanceSummary } from './types/finance.js';
export type { WorkoutType, Exercise, Workout } from './types/workout.js';
export type { Recurrence, CalendarEvent } from './types/calendar.js';
export type { NoteSource, DailyNote } from './types/note.js';
export type { AttachedFileEntityType, AttachedFileCategory, AttachedFileType, AttachedFileStatus, AttachedFile } from './types/attached-file.js';
export type { LessonStatus, Lesson } from './types/lesson.js';
export type { LearningPathStatus, LearningPathTopic } from './types/learning-path.js';
export type { AgentName, ChatEngine, ChatRole, ChatSession, ChatMessage } from './types/chat.js';

// Validation schemas
export {
  sphereSchema,
  taskStatusSchema,
  projectStatusSchema,
  studentLevelSchema,
  transactionTypeSchema,
  transactionSourceSchema,
  workoutTypeSchema,
  recurrenceSchema,
  noteSourceSchema,
  taskSchema,
  createTaskSchema,
  devProjectSchema,
  createDevProjectSchema,
  studentSchema,
  createStudentSchema,
  subjectSchema,
  createSubjectSchema,
  transactionSchema,
  createTransactionSchema,
  exerciseSchema,
  workoutSchema,
  createWorkoutSchema,
  calendarEventSchema,
  createCalendarEventSchema,
  dailyNoteSchema,
  createDailyNoteSchema,
  agentNameSchema,
  chatEngineSchema,
  chatRoleSchema,
  chatMessageSchema,
} from './validation/schemas.js';
