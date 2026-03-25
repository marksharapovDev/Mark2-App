export type AssignmentType = 'homework' | 'lab_report' | 'essay' | 'project' | 'presentation' | 'typical_calc' | 'coursework' | 'report' | 'other';
export type AssignmentStatus = 'pending' | 'in_progress' | 'submitted' | 'graded';

export interface StudyAssignment {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  type: AssignmentType;
  status: AssignmentStatus;
  deadline: string | null;
  grade: string | null;
  filePath: string | null;
  createdAt: Date;
}

export type ExamType = 'exam' | 'credit' | 'test' | 'midterm';
export type ExamStatus = 'upcoming' | 'passed' | 'failed';

export interface StudyExam {
  id: string;
  subjectId: string;
  title: string;
  type: ExamType;
  date: string | null;
  status: ExamStatus;
  grade: string | null;
  notes: string | null;
  createdAt: Date;
}

export type SubjectType = 'lecture' | 'seminar' | 'lab' | 'practice';
export type SubjectStatus = 'active' | 'completed' | 'dropped';
