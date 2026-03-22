-- Add recurring event support to calendar_events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurring_parent_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_exception BOOLEAN NOT NULL DEFAULT false;

-- Update sphere check to include 'personal'
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_sphere_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_sphere_check
  CHECK (sphere IN ('dev', 'teaching', 'study', 'health', 'finance', 'personal'));

CREATE INDEX IF NOT EXISTS idx_calendar_events_recurring ON calendar_events(is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_calendar_events_parent ON calendar_events(recurring_parent_id) WHERE recurring_parent_id IS NOT NULL;
