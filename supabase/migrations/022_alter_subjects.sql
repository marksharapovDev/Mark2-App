ALTER TABLE subjects ADD COLUMN IF NOT EXISTS schedule TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'lecture' CHECK (type IN ('lecture', 'seminar', 'lab', 'practice'));
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped'));
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS color TEXT;
