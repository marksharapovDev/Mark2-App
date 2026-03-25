CREATE TABLE study_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  type          TEXT NOT NULL DEFAULT 'homework' CHECK (type IN ('homework', 'lab_report', 'essay', 'project', 'presentation', 'typical_calc', 'coursework', 'report', 'other')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'graded')),
  deadline      DATE,
  grade         TEXT,
  file_path     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_study_assignments_subject ON study_assignments(subject_id);
CREATE INDEX idx_study_assignments_deadline ON study_assignments(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX idx_study_assignments_status ON study_assignments(status);

ALTER TABLE study_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated and anon" ON study_assignments
  FOR ALL
  USING (true)
  WITH CHECK (true);
