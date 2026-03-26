-- Health v2: expanded workouts, exercises, health logs, goals
-- Replaces old simple workouts table (008)

-- Drop old workouts table
DROP TABLE IF EXISTS workouts CASCADE;

-- New workouts table
CREATE TABLE workouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  type              TEXT NOT NULL CHECK (type IN ('gym', 'running', 'cycling', 'swimming', 'calisthenics', 'stretching', 'other')),
  title             TEXT,
  duration_minutes  INTEGER,
  notes             TEXT,
  mood              TEXT CHECK (mood IS NULL OR mood IN ('great', 'good', 'normal', 'tired', 'bad')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workouts_date ON workouts(date);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for workouts" ON workouts
  FOR ALL USING (true) WITH CHECK (true);

-- Workout exercises
CREATE TABLE workout_exercises (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id        UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  sets              INTEGER,
  reps              TEXT,
  weight_kg         DECIMAL(6,1),
  duration_minutes  INTEGER,
  distance_km       DECIMAL(6,2),
  order_index       INTEGER DEFAULT 0,
  notes             TEXT
);

CREATE INDEX idx_workout_exercises_workout ON workout_exercises(workout_id);

ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for workout_exercises" ON workout_exercises
  FOR ALL USING (true) WITH CHECK (true);

-- Health logs (weight, sleep, water, mood, measurement)
CREATE TABLE health_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  type        TEXT NOT NULL CHECK (type IN ('weight', 'sleep', 'water', 'mood', 'measurement')),
  value       DECIMAL(8,2),
  data        JSONB,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_health_logs_date ON health_logs(date);
CREATE INDEX idx_health_logs_type ON health_logs(type);
CREATE INDEX idx_health_logs_date_type ON health_logs(date, type);

ALTER TABLE health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for health_logs" ON health_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Health goals
CREATE TABLE health_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  type            TEXT CHECK (type IS NULL OR type IN ('weight', 'strength', 'cardio', 'habit', 'other')),
  target_value    DECIMAL(8,2),
  current_value   DECIMAL(8,2) DEFAULT 0,
  unit            TEXT,
  deadline        DATE,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE health_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for health_goals" ON health_goals
  FOR ALL USING (true) WITH CHECK (true);
