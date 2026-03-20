CREATE TABLE calendar_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sphere      TEXT NOT NULL CHECK (sphere IN ('dev', 'teaching', 'study', 'health', 'finance')),
  title       TEXT NOT NULL,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ,
  recurrence  TEXT CHECK (recurrence IN ('daily', 'weekly', 'none')),
  reminder    INT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_events_sphere ON calendar_events(sphere);
CREATE INDEX idx_calendar_events_start_at ON calendar_events(start_at);
