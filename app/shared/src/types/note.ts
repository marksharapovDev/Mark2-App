export type NoteSource = 'mobile' | 'desktop';

export interface DailyNote {
  id: string;
  content: string;
  sorted: Record<string, unknown> | null;
  source: NoteSource;
  createdAt: Date;
}
