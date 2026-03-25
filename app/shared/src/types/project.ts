export type ProjectStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface DevProject {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  stack: Record<string, unknown>;
  repoUrl: string | null;
  deployUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
