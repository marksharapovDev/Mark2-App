CREATE TABLE study_exams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'exam' CHECK (type IN ('exam', 'credit', 'test', 'midterm')),
  date          DATE,
  status        TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'passed', 'failed')),
  grade         TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_study_exams_subject ON study_exams(subject_id);
CREATE INDEX idx_study_exams_date ON study_exams(date) WHERE date IS NOT NULL;

ALTER TABLE study_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated and anon" ON study_exams
  FOR ALL
  USING (true)
  WITH CHECK (true);
