export type DevProjectStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface DevProjectV2 {
  id: string;
  name: string;
  slug: string;
  clientName: string | null;
  description: string | null;
  status: DevProjectStatus;
  budget: number | null;
  techStack: string | null;
  stack: Record<string, unknown>;
  repoUrl: string | null;
  deployUrl: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DevTaskStatus = 'todo' | 'in_progress' | 'done' | 'deferred';
export type DevTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface DevTask {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  prompt: string | null;
  status: DevTaskStatus;
  priority: DevTaskPriority;
  orderIndex: number;
  timeEstimateMinutes: number | null;
  timeSpentMinutes: number;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DevTimeEntry {
  id: string;
  taskId: string;
  projectId: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  notes: string | null;
  createdAt: string;
}
