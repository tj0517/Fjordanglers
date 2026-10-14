-- Experience v2 feedback round 1 (Krzysztof, 2026-10-13), change 1.
--
-- experience_pages.season_periods: what each part of the season is like, so the
-- twelve-month bar on the v2 page (S11) can say it when a month is hovered or tapped.
--
--   [{ "title": "Winter (June – August)", "months": [6, 7, 8], "text": "The signature period…" }]
--
-- The shape rules (months 1–12, a month in at most one period, title ≤ 80, text ≤ 1500)
-- live in the zod schema `seasonPeriodsSchema` (src/lib/experiences/v2-editor.ts), which
-- the only writer — saveExperienceV2Content — runs. The reader
-- (parseSeasonPeriods, src/lib/experience-v2-content.ts) skips anything malformed, so a
-- bad entry costs one period on the page, never the page. The database guarantees only
-- what is cheap and structural: when set, it is a JSON array.
--
-- Nullable, no default, no backfill: NULL = no periods, the bar renders as before.

alter table public.experience_pages
  add column season_periods jsonb
    constraint experience_pages_season_periods_is_array
      check (season_periods is null or jsonb_typeof(season_periods) = 'array');

comment on column public.experience_pages.season_periods is
  'v2 S11 season bar: [{title, months int[1..12], text}] — a month belongs to at most one period. Shape enforced by seasonPeriodsSchema in the app; NULL = no periods.';
