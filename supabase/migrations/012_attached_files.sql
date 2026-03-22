CREATE TABLE attached_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('student', 'lesson', 'homework', 'subject', 'project', 'task')),
  entity_id   UUID,
  filename    TEXT NOT NULL,
  filepath    TEXT NOT NULL,
  file_type   TEXT NOT NULL DEFAULT 'md' CHECK (file_type IN ('docx', 'pdf', 'md', 'py', 'txt', 'xlsx', 'pptx')),
  category    TEXT NOT NULL DEFAULT 'material' CHECK (category IN ('homework', 'lesson_plan', 'material', 'notes', 'test', 'solution')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attached_files_entity ON attached_files(entity_type, entity_id);
