CREATE TABLE daily_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content     TEXT NOT NULL,
  sorted      JSONB,
  source      TEXT NOT NULL DEFAULT 'mobile' CHECK (source IN ('mobile', 'desktop')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_notes_created_at ON daily_notes(created_at);
