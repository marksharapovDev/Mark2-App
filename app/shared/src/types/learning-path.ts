export type LearningPathStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';

export interface LearningPathTopic {
  id: string;
  studentId: string;
  title: string;
  description: string | null;
  orderIndex: number;
  status: LearningPathStatus;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
