-- Dev V2: expand dev_projects, add dev_tasks and dev_time_entries

-- 1. Expand dev_projects
ALTER TABLE dev_projects
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS budget DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS tech_stack TEXT,
  ADD COLUMN IF NOT EXISTS deadline DATE;

-- Update status check constraint: replace 'archived' with 'cancelled'
ALTER TABLE dev_projects DROP CONSTRAINT IF EXISTS dev_projects_status_check;
ALTER TABLE dev_projects ADD CONSTRAINT dev_projects_status_check
  CHECK (status IN ('active', 'paused', 'completed', 'cancelled'));

-- Migrate any existing 'archived' rows
UPDATE dev_projects SET status = 'completed' WHERE status = 'archived';

ALTER TABLE dev_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on dev_projects" ON dev_projects;
CREATE POLICY "Allow all on dev_projects" ON dev_projects FOR ALL USING (true) WITH CHECK (true);

-- 2. Dev Tasks
CREATE TABLE dev_tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES dev_projects(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  prompt              TEXT,
  status              TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'deferred')),
  priority            TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  order_index         INTEGER NOT NULL DEFAULT 0,
  time_estimate_minutes INTEGER,
  time_spent_minutes  INTEGER DEFAULT 0,
  deadline            DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dev_tasks_project_status ON dev_tasks(project_id, status);
CREATE INDEX idx_dev_tasks_project_order ON dev_tasks(project_id, order_index);

ALTER TABLE dev_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on dev_tasks" ON dev_tasks FOR ALL USING (true) WITH CHECK (true);

-- 3. Dev Time Entries
CREATE TABLE dev_time_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES dev_tasks(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES dev_projects(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dev_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on dev_time_entries" ON dev_time_entries FOR ALL USING (true) WITH CHECK (true);
