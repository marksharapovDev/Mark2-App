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
