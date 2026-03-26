-- Reminders: unified task/reminder system across all spheres
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped', 'deferred')),
  sphere TEXT CHECK (sphere IN ('teaching', 'dev', 'study', 'finance', 'health', 'personal')),
  source_type TEXT CHECK (source_type IN ('manual', 'teaching_lesson', 'dev_task', 'study_assignment', 'study_exam', 'finance_tax', 'health_workout')),
  source_id UUID,
  is_recurring BOOLEAN DEFAULT false,
  recurring_pattern TEXT CHECK (recurring_pattern IN ('daily', 'weekday', 'weekly', 'monthly')),
  recurring_end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON reminders FOR ALL TO anon USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_reminders_date ON reminders (date);
CREATE INDEX idx_reminders_status ON reminders (status);
CREATE INDEX idx_reminders_sphere ON reminders (sphere);
