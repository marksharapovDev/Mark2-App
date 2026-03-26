-- Daily checklist snapshots for habit tracking

CREATE TABLE daily_checklist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL UNIQUE,
  workout         BOOLEAN NOT NULL DEFAULT false,
  weight_logged   BOOLEAN NOT NULL DEFAULT false,
  sleep_logged    BOOLEAN NOT NULL DEFAULT false,
  water_goal      BOOLEAN NOT NULL DEFAULT false,
  meals_logged    BOOLEAN NOT NULL DEFAULT false,
  completed_count INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_checklist_date ON daily_checklist(date);

ALTER TABLE daily_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for daily_checklist" ON daily_checklist
  FOR ALL USING (true) WITH CHECK (true);
