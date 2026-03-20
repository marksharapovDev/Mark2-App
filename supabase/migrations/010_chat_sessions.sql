CREATE TABLE chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent       TEXT NOT NULL CHECK (agent IN ('dev', 'teaching', 'study', 'health', 'finance', 'general')),
  title       TEXT NOT NULL DEFAULT 'New chat',
  summary     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_agent ON chat_sessions(agent);
CREATE INDEX idx_chat_sessions_updated_at ON chat_sessions(updated_at);

ALTER TABLE chat_messages ADD COLUMN session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE;
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
