export type WorkoutTypeV2 = 'gym' | 'running' | 'cycling' | 'swimming' | 'calisthenics' | 'stretching' | 'other';
export type WorkoutMood = 'great' | 'good' | 'normal' | 'tired' | 'bad';

export interface WorkoutV2 {
  id: string;
  date: string;
  type: WorkoutTypeV2;
  title: string | null;
  durationMinutes: number | null;
  notes: string | null;
  mood: WorkoutMood | null;
  createdAt: Date;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  name: string;
  sets: number | null;
  reps: string | null;
  weightKg: number | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  orderIndex: number;
  notes: string | null;
}

export type HealthLogType = 'weight' | 'sleep' | 'water' | 'mood' | 'measurement';

export interface HealthLog {
  id: string;
  date: string;
  type: HealthLogType;
  value: number | null;
  data: Record<string, unknown> | null;
  notes: string | null;
  createdAt: Date;
}

export type HealthGoalType = 'weight' | 'strength' | 'cardio' | 'habit' | 'other';
export type HealthGoalStatus = 'active' | 'completed' | 'paused';

// --- Training Programs ---

export type TrainingProgramStatus = 'active' | 'completed' | 'paused';

export interface TrainingProgramDayExercise {
  name: string;
  sets?: number;
  reps?: string;
  weightKg?: number;
  notes?: string;
}

export interface TrainingProgram {
  id: string;
  name: string;
  description: string | null;
  status: TrainingProgramStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainingProgramDay {
  id: string;
  programId: string;
  dayName: string;
  orderIndex: number;
  exercises: TrainingProgramDayExercise[];
  notes: string | null;
}

// --- Nutrition ---

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealPlanStatus = 'active' | 'paused';

export interface MealPlan {
  id: string;
  name: string;
  dailyCalories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  status: MealPlanStatus;
  createdAt: Date;
}

export interface Meal {
  id: string;
  date: string;
  type: MealType;
  title: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface HealthGoal {
  id: string;
  title: string;
  type: HealthGoalType | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  deadline: string | null;
  status: HealthGoalStatus;
  createdAt: Date;
}

// --- Daily Checklist ---

export interface DailyChecklist {
  id: string;
  date: string;
  workout: boolean;
  weightLogged: boolean;
  sleepLogged: boolean;
  waterGoal: boolean;
  mealsLogged: boolean;
  completedCount: number;
  createdAt: Date;
  updatedAt: Date;
}
