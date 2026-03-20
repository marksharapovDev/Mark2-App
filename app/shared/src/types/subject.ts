export interface Subject {
  id: string;
  name: string;
  semester: number;
  professor: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
