export interface Subject {
  id: string;
  name: string;
  semester: number;
  professor: string | null;
  schedule: string | null;
  type: string | null;
  status: string | null;
  color: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
