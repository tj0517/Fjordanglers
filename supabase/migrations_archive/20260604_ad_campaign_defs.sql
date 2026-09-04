-- ─────────────────────────────────────────────────────────────────────────────
-- Campaign definitions table (UI-managed)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists ad_campaign_defs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  key text not null unique,
  name text not null,
  platform text not null check (platform in ('google_ads', 'meta')),
  sort_order int not null default 0,
  active boolean not null default true
);

-- Seed default campaigns (from previous hardcoded list)
insert into ad_campaign_defs (key, name, platform, sort_order) values
  ('google_brand',     'Brand',       'google_ads', 1),
  ('google_generic',   'Generic',     'google_ads', 2),
  ('meta_retargeting', 'Retargeting', 'meta',       3),
  ('meta_prospecting', 'Prospecting', 'meta',       4)
on conflict (key) do nothing;

-- Unique constraint on ad_campaigns for upsert support (date + campaign pair)
alter table ad_campaigns
  drop constraint if exists ad_campaigns_date_campaign_unique;
alter table ad_campaigns
  add constraint ad_campaigns_date_campaign_unique unique (date, campaign_name);
