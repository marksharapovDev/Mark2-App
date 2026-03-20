CREATE TABLE workouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type IN ('gym', 'run', 'swim')),
  exercises   JSONB,
  duration    INT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workouts_type ON workouts(type);
CREATE INDEX idx_workouts_date ON workouts(date);
