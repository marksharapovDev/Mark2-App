import type { Sphere } from './task.js';

export type Recurrence = 'daily' | 'weekly' | 'none';

export interface CalendarEvent {
  id: string;
  sphere: Sphere;
  title: string;
  startAt: Date;
  endAt: Date | null;
  recurrence: Recurrence | null;
  reminder: number | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
