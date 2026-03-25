-- Finance v2: expanded transactions, savings goals, student rates

-- 1. Expand transactions table
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_type_check CHECK (type IN ('income', 'expense', 'savings', 'tax'));

ALTER TABLE transactions
  ALTER COLUMN amount TYPE DECIMAL(12,2);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_period TEXT;

-- Update category constraint: drop old source column, add category values
-- source column is no longer needed (was manual/screenshot/voice)
ALTER TABLE transactions
  DROP COLUMN IF EXISTS source;

-- Add index on student_id
CREATE INDEX IF NOT EXISTS idx_transactions_student_id ON transactions(student_id) WHERE student_id IS NOT NULL;

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactions_allow_all ON transactions;
CREATE POLICY transactions_allow_all ON transactions FOR ALL USING (true) WITH CHECK (true);

-- 2. Savings goals table
CREATE TABLE IF NOT EXISTS savings_goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  target_amount  DECIMAL(12,2),
  current_amount DECIMAL(12,2) DEFAULT 0,
  status         TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS savings_goals_allow_all ON savings_goals;
CREATE POLICY savings_goals_allow_all ON savings_goals FOR ALL USING (true) WITH CHECK (true);

-- 3. Student rates table
CREATE TABLE IF NOT EXISTS student_rates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE UNIQUE,
  rate_per_lesson  DECIMAL(8,2) NOT NULL,
  currency         TEXT DEFAULT 'RUB',
  notes            TEXT
);

ALTER TABLE student_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_rates_allow_all ON student_rates;
CREATE POLICY student_rates_allow_all ON student_rates FOR ALL USING (true) WITH CHECK (true);
