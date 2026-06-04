-- Ad campaigns table for tracking paid advertising performance
-- Rows are inserted manually via the admin Ads Analytics dashboard
-- Conversions are derived from the inquiries table (not stored here)

create table ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  date date not null,
  platform text not null default 'google_ads',
  campaign_name text not null,
  spend numeric(10,2) not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  avg_cpc numeric(10,4) not null default 0
);

-- Index for common filter/sort patterns
create index ad_campaigns_date_idx on ad_campaigns (date desc);
create index ad_campaigns_platform_idx on ad_campaigns (platform);
