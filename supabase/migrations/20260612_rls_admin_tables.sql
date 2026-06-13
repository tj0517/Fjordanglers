-- Enable RLS on all admin-only tables.
-- These tables are accessed exclusively via server-side service role clients
-- (Server Actions, API routes). No anon or authenticated user should have
-- direct read/write access.
--
-- service_role bypasses RLS automatically — no explicit policy needed for it.
-- The USING (false) policy denies ALL other roles (anon, authenticated).

-- ad_campaigns
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access" ON ad_campaigns
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- ad_campaign_defs
ALTER TABLE ad_campaign_defs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access" ON ad_campaign_defs
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- fixed_costs
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access" ON fixed_costs
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- manual_cost_entries
ALTER TABLE manual_cost_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access" ON manual_cost_entries
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);

-- finance_settings
ALTER TABLE finance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access" ON finance_settings
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false);
