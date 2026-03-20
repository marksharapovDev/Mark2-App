export type WorkoutType = 'gym' | 'run' | 'swim';

export interface Exercise {
  name: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
}

export interface Workout {
  id: string;
  type: WorkoutType;
  exercises: Exercise[] | null;
  duration: number | null;
  date: string;
  notes: string | null;
  createdAt: Date;
}
