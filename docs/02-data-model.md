# Data model

Three sections: what exists now (so you do not trust the types file), what we are
moving to, and the mapping between them. Column-level detail for the current state is in
`docs/audit/rebuild-audit-db-aug-2026.md`; do not duplicate it here — read it.

**Rule 2 of CLAUDE.md applies to this file too:** before touching a table, query its
actual columns (`information_schema.columns`) — the dashboard has been used to add
columns that appear in no migration and no types file.

## 1. Current state (Aug 2026)

### Live spine
`guides` → `experience_pages` (+ `experience_page_options`) → `inquiries` →
`lead_messages`, `unmatched_messages`. Plus `profiles` (role only), `guide_photos`,
`reviews`, `leads`, `guide_intake_forms`, `guide_intake_responses`, back-office
`ad_campaigns`, `ad_campaign_defs`, `fixed_costs`, `manual_cost_entries`, `finance_settings`.

### Ghost tables (exist in DB, in no migration, in no types)
`inquiry_trip_details`, `guide_unavailable_dates`. Code accesses them via `as any` in
try/catch. Stage 1 baseline migration records them; stage 4 replaces them.

### Ghost columns on `inquiries` (same situation)
`assigned_guide_id`, `assigned_at`, `guide_acceptance`, `guide_offer_eta`,
`deal_currency`, `source`, `angler_phone`, plus ~40 migrated `offer_*` / `internal_*` /
agent columns. `inquiries` is ~60 columns wide.

### Dead (zero code references, or referenced only from dead modules)
`bookings` (58 cols), `booking_messages`, `payments` (old), `guide_calendars`,
`calendar_blocked_dates`, `calendar_experiences`, `experience_availability_config`,
`experience_blocked_dates`, `guide_weekly_schedules`, `audit_log`, `experience_images`,
`guide_images`, `guide_accommodations`, `experience_accommodations`, `inquiry_messages`,
`guide_submissions` (read-only archive), legacy `experiences` (written by a legacy admin
editor, read by the public site only for `max_guests`). Functions `search_trips_near`,
`get_licenses_for_point`, `import_license_zone`; PostGIS. Enums `booking_status`,
`payment_status`, `trip_inquiry_status`.

### Known wrong-but-live
- Money as `NUMERIC` euros; one global FX rate in `finance_settings`.
- Revenue computed as `offer_deposit_eur ?? deposit_amount ?? internal_commission_eur`.
- `status` set by hand for 5 of 10 values; `stage_reached` maintained by trigger.
- Availability = one row per blocked day (`guide_unavailable_dates`), ~730 rows per
  guide per "open season".
- Storage bucket `review-media` has no policy migration.

## 2. Target state

Conventions: cents + currency, `created_at`/`updated_at` everywhere, explicit `ON
DELETE`, RLS + policy on every table, plural names, no foreign prefixes on another
table's columns.

```sql
customers        (id, email_normalized UNIQUE, name, phone, country, first_inquiry_at)
destinations     (id, slug, name, country, region, season, status, first_contact_at, target_live_at, live_at)
guide_destinations (guide_id, destination_id, status ∈ candidate|vetted|active, vetted_at)
guides           (… minus stripe_*, iban*, calendar_*, average_rating, total_reviews; plus season_from, season_to, boat jsonb)
guide_photos     (unchanged)
guide_blocked_dates (guide_id, date_from, date_to, reason)
experiences      (= experience_pages + destination_id + max_guests − special_attraction_*)
experience_options (= experience_page_options)
inquiries        (identity, contact, request, attribution[source,gclid,utm], classification,
                  qualified, brief jsonb, brief_completed_at, trip_start_date, trip_end_date,
                  assignment, agent state, status, stage_reached, lost_reason, notes)
offers           (inquiry_id, version, status, token, totals in cents, options, plan, licence, map, photos, schedule)
payments         (inquiry_id, offer_id, kind ∈ deposit|balance|refund, provider ids, amount_cents, currency, status, paid_at)
deals            (inquiry_id PK, offer_id, total_cents, commission_cents, currency, fx_rate_pln, recognized_at)
inquiry_events   (see 01-architecture.md §3)
messages         (= lead_messages + external_id UNIQUE + thread_id)
unmatched_messages (+ resolved_inquiry_id, resolved_at)
reviews          (+ guide_id, inquiry_id explicit)
incidents        (inquiry_id, kind ∈ complaint|refund|safety, severity, opened_at, resolved_at)
guide_applications (= leads + first_contact_at)
guide_intake_forms / guide_intake_responses (+ application_id, guide_id nullable)
ad_campaigns, ad_campaign_defs (+ destination_id), fixed_costs, manual_cost_entries (cents)
fx_rates         (date, base, quote, rate)
metric_snapshots (metric_key, period_start, period_end, granularity, value, unit, source)
checklist_items  (group_key ∈ legal|branding|compliance, key, label, done, done_at, reviewed_at)
profiles         (id, role)
```

Materialised views: `mv_inquiry_facts`, `mv_weekly_metrics`, `mv_monthly_cohorts`,
`mv_guide_performance`, `mv_destination_status`, `mv_channel_costs`.

Full DDL sketches: `REBUILD_PLAN.md` §4–5.

## 3. Mapping old → new (stage 4 backfill)

| Old | New |
|---|---|
| `inquiries.offer_total_eur`, `offer_deposit_eur` | `offers.total_cents`, `deposit_cents` (×100), `currency='EUR'` |
| `inquiries.offer_token`, `offer_token_expires_at`, `offer_sent_at` | `offers.token`, `token_expires_at`, `sent_at` |
| `inquiries.offer_{trip_plan,notes,inclusions,what_to_bring,questions,answers,license_*,refund_reason,location*,photos,schedule,options}`, `selected_option_id` | `offers.*` 1:1 |
| `inquiries.deposit_amount`, `deposit_stripe_session_id`, `deposit_paid_at` | `payments(kind='deposit', provider='stripe', amount_cents, provider_session_id, paid_at, status='paid')` |
| `inquiries.internal_deal_total_eur`, `internal_commission_eur`, `deal_currency` | `deals.total_cents`, `commission_cents`, `currency`, `fx_rate_pln` |
| `inquiry_trip_details.*` | `inquiries.brief` |
| `guide_unavailable_dates(guide_id, date)` | `guide_blocked_dates` ranges (merge consecutive days) |
| `experiences.max_guests` | `experience_pages.max_guests` via `trip_id` |
| `inquiries.angler_email` (normalised) | `customers.email_normalized` + `inquiries.customer_id` |
| `inquiries.trip_country` + published experiences | `destinations` + `experiences.destination_id` |
| `lead_messages` | `messages` |
| `leads` | `guide_applications`; `guides.lead_id` → `application_id` |
| `guides.boat_*` (5) | `guides.boat` jsonb |
| `guides.average_rating`, `total_reviews` | computed from `reviews` |

## 4. Order of schema operations

1. Stage 1: `supabase db pull` baseline → `drop_marketplace_leftovers` (dead tables that
   need no data move) → `inquiry_events` + `inquiries.qualified` → regenerate types.
2. Stage 4: create new tables **beside** old columns → backfill in a migration →
   switch `packages/core` → one week dual-read → `drop_legacy_inquiry_columns`, drop
   `experiences`/`inquiry_trip_details`/`guide_unavailable_dates`, rename
   `experience_pages → experiences`.
3. Stage 5: `metric_snapshots`, `fx_rates`, materialised views.

Every migration that drops or renames is preceded by a STOP gate and a `pg_dump`.
