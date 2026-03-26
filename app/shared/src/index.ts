// Types
export type { Sphere, TaskStatus, Task } from './types/task.js';
export type { ProjectStatus, DevProject } from './types/project.js';
export type { DevProjectStatus, DevProjectV2, DevTaskStatus, DevTaskPriority, DevTask, DevTimeEntry } from './types/dev.js';
export type { StudentLevel, Student } from './types/student.js';
export type { Subject } from './types/subject.js';
export type { AssignmentType, AssignmentStatus, StudyAssignment, ExamType, ExamStatus, StudyExam, SubjectType, SubjectStatus } from './types/study.js';
export type { TransactionType, Transaction, IncomeCategory, ExpenseCategory, SavingsCategory, TaxCategory, TransactionCategory, SavingsGoal, StudentRate, FinanceSummary } from './types/finance.js';
export type { WorkoutType, Exercise, Workout } from './types/workout.js';
export type { WorkoutTypeV2, WorkoutMood, WorkoutV2, WorkoutExercise, HealthLogType, HealthLog, HealthGoalType, HealthGoalStatus, HealthGoal, TrainingProgramStatus, TrainingProgramDayExercise, TrainingProgram, TrainingProgramDay, MealType, MealPlanStatus, MealPlan, Meal, DailyChecklist } from './types/health.js';
export type { Recurrence, CalendarEvent } from './types/calendar.js';
export type { NoteSource, DailyNote } from './types/note.js';
export type { AttachedFileEntityType, AttachedFileCategory, AttachedFileType, AttachedFileStatus, AttachedFile } from './types/attached-file.js';
export type { LessonStatus, Lesson } from './types/lesson.js';
export type { LearningPathStatus, LearningPathTopic } from './types/learning-path.js';
export type { AgentName, ChatEngine, ChatRole, ChatSession, ChatMessage } from './types/chat.js';
export type { ReminderPriority, ReminderStatus, ReminderSphere, ReminderSourceType, RecurringPattern, ReminderSubtask, Reminder } from './types/reminder.js';

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
  assignmentTypeSchema,
  assignmentStatusSchema,
  studyAssignmentSchema,
  createStudyAssignmentSchema,
  examTypeSchema,
  examStatusSchema,
  studyExamSchema,
  createStudyExamSchema,
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
  workoutTypeV2Schema,
  workoutMoodSchema,
  workoutV2Schema,
  createWorkoutV2Schema,
  workoutExerciseSchema,
  createWorkoutExerciseSchema,
  healthLogTypeSchema,
  healthLogSchema,
  createHealthLogSchema,
  healthGoalTypeSchema,
  healthGoalStatusSchema,
  healthGoalSchema,
  createHealthGoalSchema,
  trainingProgramStatusSchema,
  trainingProgramSchema,
  createTrainingProgramSchema,
  trainingProgramDaySchema,
  createTrainingProgramDaySchema,
  mealTypeSchema,
  mealPlanStatusSchema,
  mealPlanSchema,
  createMealPlanSchema,
  mealSchema,
  createMealSchema,
} from './validation/schemas.js';
