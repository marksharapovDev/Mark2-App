CREATE TABLE students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  subject     TEXT,
  level       TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  schedule    JSONB,
  stats       JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
