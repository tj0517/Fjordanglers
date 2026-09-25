# Data model

Three sections: what exists now (so you do not trust the types file), what we are
moving to, and the mapping between them. Column-level detail for the current state is in
`docs/audit/rebuild-audit-db-aug-2026.md`; do not duplicate it here — read it.

**Rule 2 of CLAUDE.md applies to this file too:** before touching a table, query its
actual columns (`information_schema.columns`) — the dashboard has been used to add
columns that appear in no migration and no types file.

## 1. Current state (Sep 2026, after FA-1.01 baseline + FA-1.06)

Authoritative source: `supabase/migrations/20260904165037_baseline_prod.sql` and the
types generated from it (`supabase gen types typescript --local`). Since FA-1.06 the
types file is exactly the generator's output and every `.from('…')` in `src` names a
table that exists in `public`.

### Live spine
`guides` → `experience_pages` (+ `experience_page_options`) → `inquiries` →
`lead_messages`, `unmatched_messages`. Plus `profiles` (role only), `guide_photos`,
`reviews`, `guide_intake_forms`, `guide_intake_responses`, back-office
`ad_campaigns`, `ad_campaign_defs`, `fixed_costs`, `manual_cost_entries`, `finance_settings`.

### Formerly ghost, now in the baseline and in the types
`inquiry_trip_details`, `guide_unavailable_dates`, and the `inquiries` columns that used to
be undeclared (`assigned_guide_id`, `assigned_at`, `guide_acceptance`, `guide_offer_eta`,
`deal_currency`, `angler_phone`, the `offer_*` / `internal_*` / agent columns). The
`as any` casts that hid them were removed in FA-1.06 where the real types compile; the
remaining casts (9 files) cover `Json` columns and nullable columns, not missing tables.
`inquiries.source` / `utm` are **not** in the baseline — FA-0.05 adds them by migration
`20260904210532_inquiries_source_utm.sql` (`source text` with `CHECK (source IS NULL OR
source IN ('web_form','manual','email','whatsapp'))`, `utm jsonb`), written by the single
insert path `src/lib/inquiries/create.ts`. Historical rows keep `source = NULL`.
`guides.lead_id` is **not** in the baseline either (the audit listed it; production does not
have it).

### Dropped in FA-1.02 — schema `archive` (all 10 tables + schema)
All 10 tables dropped by migration `20260917100000_drop_marketplace_leftovers.sql`.
Tables with data were exported to `docs/archive/2026-09-17-archive/` before dropping:
`experiences` (22 rows), `experience_images` (134), `experience_accommodations` (1),
`guide_accommodations` (2). Empty tables (`booking_messages`, `bookings`, `payments`,
`experience_availability_config`, `experience_blocked_dates`, `leads`) dropped without export.
Side-effects of `DROP TABLE archive.experiences CASCADE`:
  - FK `experience_pages_trip_id_fkey` removed (was `ON DELETE SET NULL`; CASCADE removes
    the constraint itself, not the referencing rows — existing `trip_id` values in
    `experience_pages` become orphaned UUIDs, all confirmed inert: 0 unmatched inquiries).
  - Trigger `audit_experiences` auto-dropped with the table.
`inquiries.trip_id` still holds orphaned UUIDs from the dropped `archive.experiences`;
stage 4 will map `trip_id → experience_pages.trip_id` or drop the column.

### Dropped in FA-1.02 — dead `public` tables (all 0 rows)
`expedition_private`, `media`, `media_links`, `inquiry_todos`, `guide_availability`,
`guide_intake_submissions`. Zero rows confirmed on prod; zero code references.
Enums also dropped: `booking_status`, `payment_status`, `trip_inquiry_status`
(no remaining columns use them after the table drops).

### Dropped in FA-1.12 — legacy `offers` + enum `offer_state`
14-row marketplace `offers` table (all `draft`/`sent`, 0 payments) exported to
`docs/archive/2026-09-17-offers-legacy.json` (commit `fc5d8482`), then dropped.
Enum `offer_state` dropped alongside (was used only by `offers.status`).
New `offers` + `offer_options` tables replace them per §3b (FA-1.12 migration
`20260917104506_add_offers.sql`). `inquiry_messages` replaced by `messages`
(`20260917104503_add_messages.sql`); 75 rows migrated to `messages`.

**RLS note (messages, offers, offer_options):** RLS is intentionally narrower than
`inquiries`. No angler or guide policies — all access goes through server actions
with `requireAdmin()` / `requireToken()` / `requireGuide()` which use service_role.
`anon` is explicitly REVOKEd. Rationale: the thread contains messages to both
counterparts; a counterpart-scoped policy would risk leaking mistagged messages.
Decision: tj 2026-09-17. To revisit when building the client or guide portal.

### Added in FA-1.22 — `agent_knowledge` (agent knowledge base)
Migration `20261005000000_add_agent_knowledge.sql`. One row = one knowledge entry the
draft-reply agent can load. Replaces `docs/knowledge/*.md`, which FA-1.23 deletes:
editing in the panel instead of git + deploy, and one source of truth (tj, 2026-09-22).

```
agent_knowledge (id, kind, country, guide_id, title, body, active,
                 updated_by → auth.users, created_at, updated_at)
```

`kind ∈ instructions | tone | destination | guide` (CHECK, not an enum). The database
guarantees an entry is loadable rather than trusting the writer:

| Rule | Enforced by |
|---|---|
| `country` only from `COUNTRIES` (`src/lib/countries.ts`), full names | `agent_knowledge_country_check` |
| `destination` ⇒ has `country`, no `guide_id` | `agent_knowledge_destination_shape` |
| `guide` ⇒ has `guide_id`, no `country` | `agent_knowledge_guide_shape` |
| `instructions`/`tone` ⇒ neither | `agent_knowledge_global_shape` |
| at most one **active** `instructions` entry | partial unique index `agent_knowledge_one_active_instructions` |
| `title`/`body` not blank | `agent_knowledge_title_not_blank`, `…_body_not_blank` |
| `updated_at` on every UPDATE | trigger on `public.set_updated_at()` |

The guide is referenced by `guide_id`, not by surname — the old file format matched
`guides.full_name` case-insensitively, so a typo silently dropped the entry.
`guide_id` is `ON DELETE RESTRICT`: there is no change history (O-22, only
`updated_by`/`updated_at`), so a cascade would destroy hand-typed rate notes for good.
Guide rates are prose inside `body`; structured fields wait for stage 4 (O-21).

**RLS:** admin only — one `FOR ALL TO authenticated` policy gated on
`profiles.role = 'admin'`, the baseline pattern. No policy for anon, guides or anglers,
plus `REVOKE ALL … FROM anon` because the baseline's `ALTER DEFAULT PRIVILEGES` grants
anon `ALL` on every new `public` table. No policy for `service_role` either — it has
`rolbypassrls`, so `GRANT ALL … TO service_role` is what actually opens the table to the
FA-1.23 loader. A sync test (`src/lib/__tests__/agentKnowledgeCountries.test.ts`) keeps
the country list in the CHECK equal to `COUNTRIES`.

### Still in `public`, dead or near-dead (candidates for later tasks)
`guide_images` (admin insert + guide profile read — FA-1.07/1.08),
`guide_submissions` (read-only archive; writer component unrendered — FA-1.07),
`audit_log` (written by `audit_trigger_fn` on `guides`, `guide_images` triggers;
             no reader in `src` — investigate before dropping; stage 4),
`expedition_waters` (3 rows), `regions` (16 rows), `guide_private` (18 rows) — have data, not in FA-1.02 scope.
`spatial_ref_sys` and PostGIS functions `search_trips_near`, `get_licenses_for_point`,
`import_license_zone` — etap 4.

### Removed from the product in FA-1.06
The public guide-application funnel (`/guides/apply` → `leads`) — 0 rows, table
archived, 301 to `/guides`. The legacy `experiences` admin editor
(`/admin/guides/[id]/trips/*`). The marketplace `bookings` actions and the
`booking_fee` branch of the Stripe Connect webhook.

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
agent_knowledge  (kind, country, guide_id, title, body, active, updated_by) — unchanged from FA-1.22
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
