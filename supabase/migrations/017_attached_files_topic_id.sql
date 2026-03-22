ALTER TABLE attached_files
  ADD COLUMN topic_id UUID REFERENCES learning_path_topics(id) ON DELETE SET NULL;

CREATE INDEX idx_attached_files_topic ON attached_files(topic_id);
