ALTER TABLE lessons
  ADD COLUMN topic_id UUID REFERENCES learning_path_topics(id) ON DELETE SET NULL;

CREATE INDEX idx_lessons_topic ON lessons(topic_id);
