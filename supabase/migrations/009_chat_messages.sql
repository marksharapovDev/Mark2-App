CREATE TABLE chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent       TEXT NOT NULL CHECK (agent IN ('dev', 'teaching', 'study', 'health', 'finance', 'general')),
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  engine      TEXT NOT NULL DEFAULT 'api' CHECK (engine IN ('api', 'claude-code')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_agent ON chat_messages(agent);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
