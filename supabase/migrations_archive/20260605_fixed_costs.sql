-- Fixed costs: stable recurring costs (Vercel, Supabase, Zeus, etc.)

CREATE TABLE IF NOT EXISTS fixed_costs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  amount_pln    NUMERIC(10, 2) NOT NULL CHECK (amount_pln >= 0),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly', 'one_time')),
  category      TEXT NOT NULL DEFAULT 'infrastructure'
    CHECK (category IN ('infrastructure', 'tools', 'marketing', 'other')),
  notes         TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed known costs
INSERT INTO fixed_costs (name, amount_pln, billing_cycle, category) VALUES
  ('Vercel',    79.00, 'monthly', 'infrastructure'),
  ('Supabase',  100.00, 'monthly', 'infrastructure'),
  ('Zeus',      0.00,  'monthly', 'tools');
