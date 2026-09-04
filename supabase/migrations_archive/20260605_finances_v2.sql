-- Manual one-off cost entries per calendar month
CREATE TABLE IF NOT EXISTS manual_cost_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month       TEXT NOT NULL,               -- YYYY-MM
  name        TEXT NOT NULL,
  amount_pln  NUMERIC(10, 2) NOT NULL CHECK (amount_pln >= 0),
  category    TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('infrastructure', 'tools', 'marketing', 'other')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_cost_entries_month_idx
  ON manual_cost_entries (month);

-- Key-value store for global finance settings
CREATE TABLE IF NOT EXISTS finance_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default EUR/PLN conversion rate
INSERT INTO finance_settings (key, value)
VALUES ('eur_pln_rate', '4.25')
ON CONFLICT (key) DO NOTHING;
