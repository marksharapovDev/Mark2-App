export type LessonStatus = 'planned' | 'completed';

export interface Lesson {
  id: string;
  studentId: string;
  date: string;
  topic: string;
  status: LessonStatus;
  notes: string;
  homeworkGiven: string | null;
  createdAt: Date;
}
