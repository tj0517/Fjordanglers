# DB row-count baseline — production `uwxrstbplaoxfghrchcy` — 2026-09-04

Source: query A1 from `docs/REBUILD_PLAN.md` Appendix A (`scripts/db-baseline.sql`), run by tj in
the Supabase SQL Editor on 2026-09-04, immediately after the first full backup
(`backups/20260904-1434/`, SHA256SUMS verified, 50 `CREATE TABLE`, 80 RLS policies, auth + storage + roles included).

Purpose: compare against this after Stage 1 (`drop_marketplace_leftovers`) and Stage 4 (`inquiries` rewrite)
to prove nothing disappeared unintentionally. Task: FA-0.08.

## How to read `est_rows`

`est_rows` is the planner's estimate (`pg_class.reltuples`), not a count.
**`-1` means "never analyzed", not "empty"** — 25 of 41 tables are in that state. For those, the
activity counters (`n_tup_ins/upd/del` since last stats reset) are the only signal; an exact
`count(*)` is in the second query below and should be run before Stage 1 drops anything.

## A1 result (41 tables in `public`, ordered by est_rows)

| table | est_rows | size | ins | upd | del | last_autoanalyze |
|---|---:|---:|---:|---:|---:|---|
| spatial_ref_sys | 8500 | 7144 kB | 0 | 0 | 0 | — |
| lead_messages | 505 | 888 kB | 851 | 0 | 378 | 2026-08-27 |
| guide_unavailable_dates | 265 | 120 kB | 0 | 0 | 0 | — |
| guide_photos | 249 | 216 kB | 0 | 0 | 0 | — |
| unmatched_messages | 132 | 576 kB | 684 | 22 | 497 | 2026-08-21 |
| audit_log | 114 | 440 kB | 30 | 0 | 0 | — |
| experience_page_options | 86 | 432 kB | 40 | 24 | 0 | 2026-09-03 |
| inquiries | 81 | 240 kB | 84 | 1647 | 25 | 2026-09-02 |
| guide_images | 60 | 104 kB | 0 | 0 | 0 | — |
| requests | 51 | 192 kB | 52 | 58 | 1 | 2026-07-29 |
| ad_campaigns | 42 | 112 kB | 40 | 0 | 0 | — |
| experience_pages | 29 | 528 kB | 13 | 65 | 0 | 2026-09-03 |
| inquiry_trip_details | 26 | 136 kB | 37 | 65 | 0 | 2026-07-29 |
| profiles | 23 | 80 kB | 4 | 4 | 2 | — |
| guides | 18 | 384 kB | 103 | 12 | 2 | — |
| inquiry_messages | 16 | 128 kB | 61 | 0 | 30 | 2026-07-15 |
| expedition_options | 0 | 208 kB | 47 | 1 | 47 | 2026-07-29 |
| waters | -1 | 48 kB | 3 | 0 | 0 | — |
| manual_cost_entries | -1 | 24 kB | 0 | 0 | 0 | — |
| reviews | -1 | 48 kB | 8 | 2 | 1 | — |
| guide_intake_forms | -1 | 48 kB | 1 | 1 | 0 | — |
| guide_intake_responses | -1 | 48 kB | 4 | 0 | 2 | — |
| inquiry_todos | -1 | 16 kB | 0 | 0 | 0 | — |
| fixed_costs | -1 | 32 kB | 0 | 0 | 0 | — |
| ad_campaign_defs | -1 | 48 kB | 0 | 1 | 0 | — |
| expedition_private | -1 | 16 kB | 0 | 0 | 0 | — |
| guide_private | -1 | 32 kB | 19 | 0 | 1 | — |
| guide_availability | -1 | 32 kB | 1 | 0 | 1 | — |
| guide_submissions | -1 | 32 kB | 0 | 0 | 0 | — |
| request_guides | -1 | 48 kB | 23 | 1 | 1 | — |
| offers | -1 | 112 kB | 15 | 18 | 1 | — |
| countries | -1 | 48 kB | 6 | 4 | 1 | — |
| regions | -1 | 48 kB | 16 | 0 | 0 | — |
| media | -1 | 16 kB | 0 | 0 | 0 | — |
| media_links | -1 | 24 kB | 0 | 0 | 0 | — |
| finance_settings | -1 | 32 kB | 0 | 0 | 0 | — |
| expeditions | -1 | 208 kB | 19 | 14 | 17 | — |
| guide_intake_submissions | -1 | 64 kB | 1 | 0 | 1 | — |
| species_windows | -1 | 32 kB | 4 | 0 | 0 | — |
| expedition_guides | -1 | 48 kB | 4 | 0 | 0 | — |
| expedition_waters | -1 | 48 kB | 3 | 6 | 0 | — |

`spatial_ref_sys` belongs to PostGIS, not to the app — ignore it in every comparison.

## Observations for Stage 1 (FA-1.02 `drop_marketplace_leftovers`) — not decisions

Based on activity counters only; confirm with the exact count below before acting.

- **Never written to** (`ins = 0` since stats reset): `manual_cost_entries`, `inquiry_todos`, `fixed_costs`,
  `guide_submissions`, `media`, `media_links`, `finance_settings`, `expedition_private`. Prime drop candidates,
  but `ins = 0` since the last stats reset is not the same as empty — see exact count.
- **Written then fully deleted**: `expedition_options` (47 in / 47 out, est 0), `expeditions` (19 in / 17 out).
  The expedition model looks abandoned in practice, consistent with the audit.
- **Heavy churn, small residue**: `lead_messages` (851 in / 378 del), `unmatched_messages` (684 in / 497 del) —
  inbound-message tables, worth keeping an eye on size growth rather than dropping.
- **`inquiries`: 84 inserts, 1647 updates, 25 deletes** — ~20 updates per row. That is the status-column
  churn the event log (FA-1.03) is meant to replace with append-only history.
- `guide_unavailable_dates`, `guide_photos`, `guide_images` show `ins = 0` but non-trivial `est_rows` — data
  predates the last stats reset; they are live tables, not candidates.

## Exact counts — run before Stage 1 and append the result here

```sql
select 'lead_messages' t, count(*) from lead_messages union all
select 'guide_unavailable_dates', count(*) from guide_unavailable_dates union all
select 'guide_photos', count(*) from guide_photos union all
select 'unmatched_messages', count(*) from unmatched_messages union all
select 'audit_log', count(*) from audit_log union all
select 'experience_page_options', count(*) from experience_page_options union all
select 'inquiries', count(*) from inquiries union all
select 'guide_images', count(*) from guide_images union all
select 'requests', count(*) from requests union all
select 'ad_campaigns', count(*) from ad_campaigns union all
select 'experience_pages', count(*) from experience_pages union all
select 'inquiry_trip_details', count(*) from inquiry_trip_details union all
select 'profiles', count(*) from profiles union all
select 'guides', count(*) from guides union all
select 'inquiry_messages', count(*) from inquiry_messages union all
select 'expedition_options', count(*) from expedition_options union all
select 'waters', count(*) from waters union all
select 'manual_cost_entries', count(*) from manual_cost_entries union all
select 'reviews', count(*) from reviews union all
select 'guide_intake_forms', count(*) from guide_intake_forms union all
select 'guide_intake_responses', count(*) from guide_intake_responses union all
select 'inquiry_todos', count(*) from inquiry_todos union all
select 'fixed_costs', count(*) from fixed_costs union all
select 'ad_campaign_defs', count(*) from ad_campaign_defs union all
select 'expedition_private', count(*) from expedition_private union all
select 'guide_private', count(*) from guide_private union all
select 'guide_availability', count(*) from guide_availability union all
select 'guide_submissions', count(*) from guide_submissions union all
select 'request_guides', count(*) from request_guides union all
select 'offers', count(*) from offers union all
select 'countries', count(*) from countries union all
select 'regions', count(*) from regions union all
select 'media', count(*) from media union all
select 'media_links', count(*) from media_links union all
select 'finance_settings', count(*) from finance_settings union all
select 'expeditions', count(*) from expeditions union all
select 'guide_intake_submissions', count(*) from guide_intake_submissions union all
select 'species_windows', count(*) from species_windows union all
select 'expedition_guides', count(*) from expedition_guides union all
select 'expedition_waters', count(*) from expedition_waters
order by 2 desc;
```

### Exact counts result (2026-09-04)

_Filled in during FA-1.01 Phase A, 2026-09-04 16:51 UTC. Source: `pg_stat_user_tables.n_live_tup`
(approximate live-tuple count, not `count(*)`). Tables with `n_live_tup = 0` may still contain
rows if stats haven't been reset since last insert — run `count(*)` before Stage 1 if needed._

| table | n_live_tup |
|---|---:|
| lead_messages | 559 |
| unmatched_messages | 187 |
| inquiries | 84 |
| experience_page_options | 86 |
| experience_pages | 29 |
| inquiry_messages | 56 |
| inquiry_trip_details | 40 |
| ad_campaigns | 40 |
| requests | 51 |
| guides | 32 |
| guide_private | 18 |
| regions | 16 |
| offers | 14 |
| request_guides | 22 |
| countries | 5 |
| expedition_guides | 4 |
| expedition_waters | 3 |
| waters | 3 |
| profiles | 2 |
| species_windows | 2 |
| guide_intake_responses | 2 |
| guide_intake_forms | 1 |
| expeditions | 1 |
| audit_log | 30 |
| reviews | 7 |
| ad_campaign_defs | 0 |
| expedition_options | 0 |
| expedition_private | 0 |
| finance_settings | 0 |
| fixed_costs | 0 |
| guide_availability | 0 |
| guide_images | 0 |
| guide_intake_submissions | 0 |
| guide_photos | 0 |
| guide_submissions | 0 |
| guide_unavailable_dates | 0 |
| inquiry_todos | 0 |
| manual_cost_entries | 0 |
| media | 0 |
| media_links | 0 |
| spatial_ref_sys | 0 |

## Snapshot przed baseline — FA-1.01 (2026-09-04 16:51 UTC)

Source: `pg_stat_user_tables.n_live_tup`, project `uwxrstbplaoxfghrchcy`, run by Claude Sonnet 4.6
during FA-1.01 Phase A immediately before `supabase db dump` created the baseline migration.
Includes all 10 `archive` tables (introduced alongside baseline; all empty — migrated 2026-04–07).

### public schema (41 tables)

| table | n_live_tup |
|---|---:|
| lead_messages | 559 |
| experience_page_options | 86 |
| inquiries | 84 |
| inquiry_messages | 56 |
| requests | 51 |
| inquiry_trip_details | 40 |
| ad_campaigns | 40 |
| guides | 32 |
| audit_log | 30 |
| experience_pages | 29 |
| request_guides | 22 |
| guide_private | 18 |
| unmatched_messages | 187 |
| regions | 16 |
| offers | 14 |
| reviews | 7 |
| countries | 5 |
| expedition_guides | 4 |
| expedition_waters | 3 |
| waters | 3 |
| profiles | 2 |
| species_windows | 2 |
| guide_intake_responses | 2 |
| guide_intake_forms | 1 |
| expeditions | 1 |
| ad_campaign_defs | 0 |
| expedition_options | 0 |
| expedition_private | 0 |
| finance_settings | 0 |
| fixed_costs | 0 |
| guide_availability | 0 |
| guide_images | 0 |
| guide_intake_submissions | 0 |
| guide_photos | 0 |
| guide_submissions | 0 |
| guide_unavailable_dates | 0 |
| inquiry_todos | 0 |
| manual_cost_entries | 0 |
| media | 0 |
| media_links | 0 |
| spatial_ref_sys | 0 |

### archive schema (10 tables — all empty)

| table | n_live_tup |
|---|---:|
| booking_messages | 0 |
| bookings | 0 |
| experience_accommodations | 0 |
| experience_availability_config | 0 |
| experience_blocked_dates | 0 |
| experience_images | 0 |
| experiences | 0 |
| guide_accommodations | 0 |
| leads | 0 |
| payments | 0 |
