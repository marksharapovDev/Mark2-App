export type Sphere = 'dev' | 'teaching' | 'study' | 'health' | 'finance';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface Task {
  id: string;
  sphere: Sphere;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  dueDate: Date | null;
  parentId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
