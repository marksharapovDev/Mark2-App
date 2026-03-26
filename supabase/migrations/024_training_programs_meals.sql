-- Training programs & Nutrition

-- Training programs
CREATE TABLE training_programs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for training_programs" ON training_programs
  FOR ALL USING (true) WITH CHECK (true);

-- Training program days
CREATE TABLE training_program_days (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  day_name    TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  exercises   JSONB NOT NULL DEFAULT '[]',
  notes       TEXT
);

CREATE INDEX idx_training_program_days_program ON training_program_days(program_id);

ALTER TABLE training_program_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for training_program_days" ON training_program_days
  FOR ALL USING (true) WITH CHECK (true);

-- Meal plans
CREATE TABLE meal_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  daily_calories  INTEGER,
  protein_g       INTEGER,
  carbs_g         INTEGER,
  fat_g           INTEGER,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for meal_plans" ON meal_plans
  FOR ALL USING (true) WITH CHECK (true);

-- Meals
CREATE TABLE meals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  type        TEXT NOT NULL CHECK (type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  title       TEXT,
  calories    INTEGER,
  protein_g   INTEGER,
  carbs_g     INTEGER,
  fat_g       INTEGER,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meals_date ON meals(date);

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for meals" ON meals
  FOR ALL USING (true) WITH CHECK (true);
