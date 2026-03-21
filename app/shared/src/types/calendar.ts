import type { Sphere } from './task.js';

export type Recurrence = 'daily' | 'weekly' | 'none';

export type CalendarEventType = 'event' | 'task' | 'reminder';

export interface Subtask {
  title: string;
  done: boolean;
}

export interface CalendarEvent {
  id: string;
  sphere: Sphere;
  title: string;
  type: CalendarEventType;
  done: boolean;
  subtasks: Subtask[];
  startAt: Date;
  endAt: Date | null;
  recurrence: Recurrence | null;
  reminder: number | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
