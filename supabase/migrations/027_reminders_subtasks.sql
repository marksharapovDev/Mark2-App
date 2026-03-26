-- Add subtasks column to reminders
ALTER TABLE reminders ADD COLUMN subtasks JSONB DEFAULT '[]';
