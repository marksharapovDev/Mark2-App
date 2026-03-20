export type StudentLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Student {
  id: string;
  name: string;
  subject: string | null;
  level: StudentLevel | null;
  schedule: Record<string, unknown> | null;
  stats: Record<string, unknown>;
  createdAt: Date;
}
