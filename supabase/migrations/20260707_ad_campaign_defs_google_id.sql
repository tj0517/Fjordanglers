-- Add google_campaign_id to ad_campaign_defs
-- Maps each campaign definition to the numeric Google Ads campaign ID.
-- Set this manually via Supabase SQL editor after running the migration:
--   UPDATE ad_campaign_defs SET google_campaign_id = '12345678901' WHERE key = 'iceland_main';

ALTER TABLE ad_campaign_defs
  ADD COLUMN IF NOT EXISTS google_campaign_id TEXT;
