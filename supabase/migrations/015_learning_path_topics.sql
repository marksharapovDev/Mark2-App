CREATE TABLE learning_path_topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  order_index   INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'skipped')),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_learning_path_topics_student_order ON learning_path_topics(student_id, order_index);

ALTER TABLE learning_path_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated and anon" ON learning_path_topics
  FOR ALL
  USING (true)
  WITH CHECK (true);
