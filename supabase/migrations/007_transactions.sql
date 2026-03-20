CREATE TABLE transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount      DECIMAL NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category    TEXT,
  description TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'screenshot', 'voice')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category) WHERE category IS NOT NULL;
