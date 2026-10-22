-- FA-1.63 (O-39 a): experience_pages.hero_facts — the S1 hero chips and two S3 "At a
-- glance" cards typed by hand in the admin instead of computed.
--
--   { "location": "Tierra del Fuego", "day_length": "multi_day", "group_size": "2–4 anglers",
--     "season": "Nov–Apr", "gear_included": true, "start_pickup": "Hotel in Río Grande, 7:00" }
--
-- Every key is optional; an absent key (or an empty string) means the value is computed as
-- before, chip by chip. day_length is one of full_day | half_day | multi_day. The shape
-- lives in the zod schema `heroFactsSchema` (src/lib/experiences/v2-editor.ts), which the
-- only writer — saveExperienceV2HeroFacts — runs; the reader (parseHeroFacts,
-- src/lib/experience-v2-content.ts) returns null for anything that is not that shape.
--
-- Nullable, no default, no backfill: NULL = every chip and card computed, pages unchanged.

alter table public.experience_pages
  add column hero_facts jsonb;

comment on column public.experience_pages.hero_facts is
  'v2 S1 chips / S3 cards typed in the admin: {location?, day_length? full_day|half_day|multi_day, group_size?, season?, gear_included? boolean, start_pickup?}. Shape enforced by heroFactsSchema in the app; NULL or an absent key = computed as before.';
