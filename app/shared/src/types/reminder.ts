export type ReminderPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ReminderStatus = 'pending' | 'done' | 'skipped' | 'deferred';

export type ReminderSphere = 'teaching' | 'dev' | 'study' | 'finance' | 'health' | 'personal';

export type ReminderSourceType = 'manual' | 'teaching_lesson' | 'dev_task' | 'study_assignment' | 'study_exam' | 'finance_tax' | 'health_workout';

export type RecurringPattern = 'daily' | 'weekday' | 'weekly' | 'monthly';

export interface Reminder {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string | null;
  priority: ReminderPriority;
  status: ReminderStatus;
  sphere: ReminderSphere | null;
  sourceType: ReminderSourceType | null;
  sourceId: string | null;
  isRecurring: boolean;
  recurringPattern: RecurringPattern | null;
  recurringEndDate: string | null;
  notes: string | null;
  createdAt: string;
}
