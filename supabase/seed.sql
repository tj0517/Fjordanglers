-- Minimal seed for FA-1.05 backfill testing.
-- Covers edge cases from the prod audit (2026-09-19):
--   external_offer_sent=true + offer_sent_at NULL  (24 prod rows like this)
--   offer_sent_at IS NOT NULL                      (1 prod row)
--   deposit_paid_at IS NOT NULL                    (0 prod rows — required by acceptance criteria)
--   status = 'lost'                                (63 prod rows)
--   messages: inbound + outbound, angler + guide counterparts
-- All UUIDs are v4 (version digit = 4, variant = 8).
-- Run the backfill migration manually after db reset to populate inquiry_events:
--   psql "$LOCAL_DB_URL" -f supabase/migrations/20261003000000_backfill_inquiry_events.sql

-- ─── Inquiries ───────────────────────────────────────────────────────────────

INSERT INTO inquiries (id, angler_name, angler_email, status, external_offer_sent, offer_sent_at, deposit_paid_at, created_at, updated_at)
VALUES
  -- external_offer_sent but no offer_sent_at: backfill must NOT emit offer.presented
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a101',
   'Alice Seed', 'alice@seed.test',
   'qualifying', true, NULL, NULL,
   '2026-06-01 10:00:00+00', '2026-06-01 10:00:00+00'),

  -- offer_sent_at present: backfill MUST emit offer.presented
  ('a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a202',
   'Bob Seed', 'bob@seed.test',
   'offer_presented', false, '2026-07-15 12:00:00+00', NULL,
   '2026-07-01 10:00:00+00', '2026-07-15 12:00:00+00'),

  -- deposit_paid_at present: backfill MUST emit payment.received
  ('a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a303',
   'Carol Seed', 'carol@seed.test',
   'paid', false, '2026-07-20 12:00:00+00', '2026-07-25 14:00:00+00',
   '2026-07-10 10:00:00+00', '2026-07-25 14:00:00+00'),

  -- status='lost': backfill must NOT emit inquiry.lost (no timestamp — D-A1)
  ('a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a404',
   'Dave Seed', 'dave@seed.test',
   'lost', false, NULL, NULL,
   '2026-05-15 10:00:00+00', '2026-05-20 10:00:00+00'),

  -- plain inquiry for guide-counterpart message tests
  ('a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a505',
   'Eve Seed', 'eve@seed.test',
   'waiting_guide', false, NULL, NULL,
   '2026-08-01 10:00:00+00', '2026-08-01 10:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ─── Pre-existing app event (red proof: idempotency fix from tj review 19 IX) ─
-- Bob already has inquiry.created from source='app' (simulates a post-stage-1 inquiry).
-- After backfill, Bob must have exactly ONE inquiry.created, not two.

INSERT INTO inquiry_events (id, inquiry_id, type, actor_kind, channel, source, occurred_at, created_at, payload)
VALUES (
  'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c101',
  'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a202',
  'inquiry.created',
  'system',
  'app',
  'app',
  '2026-07-01 10:00:00+00',
  '2026-07-01 10:00:00+00',
  '{"source": "app"}'
) ON CONFLICT (id) DO NOTHING;

-- ─── Messages ────────────────────────────────────────────────────────────────

INSERT INTO messages (id, inquiry_id, channel, direction, counterpart, body, status, drafted_by, occurred_at, created_at)
VALUES
  -- inbound from angler (email)
  ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b101',
   'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a101',
   'email', 'inbound', 'angler',
   'I am interested in Iceland fishing.', 'received', NULL,
   '2026-06-01 11:00:00+00', '2026-06-01 11:00:00+00'),

  -- outbound to angler (email, drafted_by='admin')
  ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b202',
   'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a101',
   'email', 'outbound', 'angler',
   'Thank you for your inquiry!', 'sent', 'admin',
   '2026-06-02 09:00:00+00', '2026-06-02 09:00:00+00'),

  -- inbound from angler (whatsapp)
  ('b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b303',
   'a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a505',
   'whatsapp', 'inbound', 'angler',
   'Still very interested!', 'received', NULL,
   '2026-08-02 10:00:00+00', '2026-08-02 10:00:00+00'),

  -- outbound to guide (email, drafted_by='admin') — tests guide counterpart path
  ('b4b4b4b4-b4b4-4b4b-8b4b-b4b4b4b4b404',
   'a5a5a5a5-a5a5-4a5a-8a5a-a5a5a5a5a505',
   'email', 'outbound', 'guide',
   'Are you available for this inquiry?', 'sent', 'admin',
   '2026-08-01 12:00:00+00', '2026-08-01 12:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- FA-1.10 — coverage for /admin/weekly (all 8 numbers computable from this seed)
-- Dates are RELATIVE to now() in Europe/Warsaw ISO weeks (W0 = current week; each date is
-- `date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - N weeks + offset`), so the
-- "current + 4 previous weeks" window is never empty, whenever the seed is applied.
-- The five FA-1.05 rows above keep their fixed dates (backfill tests depend on them).
--
-- Hand-checkable totals (rates seeded below: 4.30 PLN/EUR, 0.90 EUR/USD):
--   commission to date = 300 EUR + 400 USD*0.90 = 660 EUR -> 2838.00 PLN
--   W-1: 3 inquiries (2 yes, 1 no), 1 attributed (gclid); ad spend 300.00 PLN
--   W-2: 4 inquiries (1 yes), 0 attributed; ad spend 210.00 PLN
--   W0 : 2 inquiries (1 yes, 1 unknown), 2 attributed (gclid + utm_medium=cpc); no ad spend
--   lost (90 d): price, no_guide, went_elsewhere, NULL code -> 1 each
-- Status vocabulary is the FA-1.03 one; s3 is 'paid' and s6 'completed' ON PURPOSE:
-- /admin/finances still filters status IN ('deposit_paid','completed') and misses 'paid'
-- (see docs/deferred-tasks.md, FA-1.10 rows). All UUIDs are v4.
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO finance_settings (key, value) VALUES
  ('eur_pln_rate', '4.30'),
  ('usd_eur_rate', '0.90')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO inquiries (
  id, angler_name, angler_email, status, qualified, priority, trip_country, source,
  gclid, utm, lost_reason_code,
  offer_deposit_eur, deposit_amount, deal_currency, deposit_paid_at,
  created_at, updated_at
) VALUES
  -- W0 ──────────────────────────────────────────────────────────────────────
  -- gclid attribution, qualified yes
  ('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f101', 'Frida Weekly', 'frida@seed.test',
   'qualifying', 'yes', 'high', 'Iceland', 'web_form',
   'seed-gclid-1', NULL, NULL,
   NULL, NULL, 'EUR', NULL,
   ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '0 week' + interval '1 hour') AT TIME ZONE 'Europe/Warsaw'), ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '0 week' + interval '1 hour') AT TIME ZONE 'Europe/Warsaw')),
  -- utm attribution only (no gclid), qualified unknown
  ('f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f202', 'Gunnar Weekly', 'gunnar@seed.test',
   'new', 'unknown', NULL, NULL, 'web_form',
   NULL, '{"utm_source":"google","utm_medium":"cpc","utm_campaign":"seed"}', NULL,
   NULL, NULL, 'EUR', NULL,
   ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '0 week' + interval '2 hours') AT TIME ZONE 'Europe/Warsaw'), ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '0 week' + interval '2 hours') AT TIME ZONE 'Europe/Warsaw')),

  -- W-1 ─────────────────────────────────────────────────────────────────────
  -- booking, EUR, gclid, status 'paid' (finances filter misses it)
  ('f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f303', 'Helga Weekly', 'helga@seed.test',
   'paid', 'yes', 'high', 'Iceland', 'web_form',
   'seed-gclid-2', NULL, NULL,
   300, NULL, 'EUR', ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '1 week' + interval '2 days 12 hours') AT TIME ZONE 'Europe/Warsaw'),
   ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '1 week' + interval '1 hour') AT TIME ZONE 'Europe/Warsaw'), ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '1 week' + interval '2 days 12 hours') AT TIME ZONE 'Europe/Warsaw')),
  -- lost with code 'price', qualified no
  ('f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f404', 'Ivar Weekly', 'ivar@seed.test',
   'lost', 'no', 'not_viable', 'Iceland', 'manual',
   NULL, NULL, 'price',
   NULL, NULL, 'EUR', NULL,
   ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '1 week' + interval '3 hours') AT TIME ZONE 'Europe/Warsaw'), ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '1 week' + interval '1 day') AT TIME ZONE 'Europe/Warsaw')),
  -- lost with code 'no_guide', qualified yes
  ('f5f5f5f5-f5f5-4f5f-8f5f-f5f5f5f5f505', 'Jonas Weekly', 'jonas@seed.test',
   'lost', 'yes', 'medium', 'Norway', 'email',
   NULL, NULL, 'no_guide',
   NULL, NULL, 'EUR', NULL,
   ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '1 week' + interval '4 hours') AT TIME ZONE 'Europe/Warsaw'), ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '1 week' + interval '2 days') AT TIME ZONE 'Europe/Warsaw')),

  -- W-2 ─────────────────────────────────────────────────────────────────────
  -- booking in USD (deposit_amount only), status 'completed' (finances filter counts it)
  ('f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f606', 'Kari Weekly', 'kari@seed.test',
   'completed', 'yes', 'high', 'New Zealand', 'web_form',
   NULL, NULL, NULL,
   NULL, 400, 'USD', ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '2 week' + interval '3 days 14 hours') AT TIME ZONE 'Europe/Warsaw'),
   ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '2 week' + interval '1 hour') AT TIME ZONE 'Europe/Warsaw'), ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '2 week' + interval '3 days 14 hours') AT TIME ZONE 'Europe/Warsaw')),
  -- lost with code 'went_elsewhere'
  ('f7f7f7f7-f7f7-4f7f-8f7f-f7f7f7f7f707', 'Liv Weekly', 'liv@seed.test',
   'lost', 'no', 'not_viable', 'Spain', 'web_form',
   NULL, NULL, 'went_elsewhere',
   NULL, NULL, 'EUR', NULL,
   ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '2 week' + interval '2 hours') AT TIME ZONE 'Europe/Warsaw'), ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '2 week' + interval '2 days') AT TIME ZONE 'Europe/Warsaw')),
  -- lost WITHOUT a reason code ("bez kodu")
  ('f8f8f8f8-f8f8-4f8f-8f8f-f8f8f8f8f808', 'Mats Weekly', 'mats@seed.test',
   'lost', 'unknown', NULL, NULL, 'whatsapp',
   NULL, NULL, NULL,
   NULL, NULL, 'EUR', NULL,
   ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '2 week' + interval '3 hours') AT TIME ZONE 'Europe/Warsaw'), ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '2 week' + interval '2 days') AT TIME ZONE 'Europe/Warsaw')),
  -- still open, qualified unknown
  ('f9f9f9f9-f9f9-4f9f-8f9f-f9f9f9f9f909', 'Nora Weekly', 'nora@seed.test',
   'qualifying', 'unknown', 'medium', NULL, 'web_form',
   NULL, NULL, NULL,
   NULL, NULL, 'EUR', NULL,
   ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '2 week' + interval '4 hours') AT TIME ZONE 'Europe/Warsaw'), ((date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '2 week' + interval '4 hours') AT TIME ZONE 'Europe/Warsaw'))
ON CONFLICT (id) DO NOTHING;

-- Ad spend: two different weeks (values are PLN straight from the column — decision T1).
INSERT INTO ad_campaigns (id, date, platform, campaign_name, spend, impressions, clicks, avg_cpc)
VALUES
  ('e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e101', (date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw')::date - 7),
   'google_ads', 'Seed Iceland', 120.50, 4000, 80, 1.5063),
  ('e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e202', (date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw')::date - 6),
   'google_ads', 'Seed Iceland', 80.25, 3000, 60, 1.3375),
  ('e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e303', (date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw')::date - 5),
   'google_ads', 'Seed Norway', 99.25, 3500, 70, 1.4179),
  ('e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e404', (date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw')::date - 14),
   'google_ads', 'Seed Iceland', 150.00, 5000, 90, 1.6667),
  ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e505', (date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw')::date - 13),
   'google_ads', 'Seed Norway', 60.00, 2000, 40, 1.5000)
ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- FA-1.22 — role accounts, one guide, and the agent's knowledge base
--
-- Until now this seed had no auth.users, no profiles and no guides at all, so there was
-- no way to prove an RLS policy locally: "the angler sees nothing" is worthless when no
-- angler exists. tj decision 22 Sep (option A): the accounts are fictional and live here.
--
-- LOCAL ONLY. Both passwords are the literal below, written down on purpose so a human
-- can sign in to the local stack. Nothing here ever reaches production — seed.sql is not
-- applied by `supabase db push`.
--
--   admin@seed.test  / seed-admin-password-2026    (profiles.role = 'admin')
--   angler@seed.test / seed-angler-password-2026   (profiles.role = 'angler')
--
-- The profiles rows are NOT inserted here: auth.users has an AFTER INSERT trigger
-- (public.handle_new_user, baseline lines 264-277) that creates them from
-- raw_user_meta_data ->> 'role'. One writer, so the two can never drift.
-- pgcrypto lives in the `extensions` schema (baseline line 33), hence the qualified calls.
-- All UUIDs are v4 (version digit = 4, variant = 8), like the rest of this file.
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  ('00000000-0000-0000-0000-000000000000',
   '9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a01',
   'authenticated', 'authenticated', 'admin@seed.test',
   extensions.crypt('seed-admin-password-2026', extensions.gen_salt('bf')),
   now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"admin","full_name":"Adam Seed (admin)"}',
   now(), now(), '', '', '', ''),

  ('00000000-0000-0000-0000-000000000000',
   '9b9b9b9b-9b9b-4b9b-8b9b-9b9b9b9b9b02',
   'authenticated', 'authenticated', 'angler@seed.test',
   extensions.crypt('seed-angler-password-2026', extensions.gen_salt('bf')),
   now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"angler","full_name":"Anna Seed (angler)"}',
   now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Identities: without them gotrue refuses a password sign-in, and the RLS proof would be
-- limited to faking claims with `SET LOCAL request.jwt.claims`.
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES
  ('9d9d9d9d-9d9d-4d9d-8d9d-9d9d9d9d9d01',
   '9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a01',
   '9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a01',
   '{"sub":"9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a01","email":"admin@seed.test","email_verified":true,"phone_verified":false}',
   'email', now(), now(), now()),

  ('9d9d9d9d-9d9d-4d9d-8d9d-9d9d9d9d9d02',
   '9b9b9b9b-9b9b-4b9b-8b9b-9b9b9b9b9b02',
   '9b9b9b9b-9b9b-4b9b-8b9b-9b9b9b9b9b02',
   '{"sub":"9b9b9b9b-9b9b-4b9b-8b9b-9b9b9b9b9b02","email":"angler@seed.test","email_verified":true,"phone_verified":false}',
   'email', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- One guide, so the `guide` knowledge entry has something to point at. Fictional.
-- avatar_url / google_* are read by the v2 offer page (FA-1.53): the rating line next to the
-- H1 and the mini-avatar in the widget. Fictional values, example.com so nothing resolves.
INSERT INTO guides (
  id, full_name, country, city, status, languages, fish_expertise, years_experience, bio,
  avatar_url, google_rating, google_review_count, google_profile_url, association, response_time_hours
) VALUES (
  '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9c03',
  'Jon Seed', 'Iceland', 'Reykjavik', 'active',
  ARRAY['en', 'is'], ARRAY['atlantic salmon', 'brown trout'], 12,
  'Fictional seed guide. Not a real person, not real content.',
  '/about/krzychu.jpg', 4.8, 21, 'https://example.com/seed-google-profile-jon', 'SEED-ASSOC', 48
) ON CONFLICT (id) DO NOTHING;

-- ─── agent_knowledge — one entry of each kind (FA-1.22) ──────────────────────
-- The `instructions` body is a verbatim copy of STUB_PROMPT from
-- src/lib/ai/draft-reply-prompt.ts (lines 17-21). The constant is module-private, so SQL
-- cannot import it and a copy is the only option; FA-1.23 deletes the original once the
-- agent reads this table instead. tj decision 22 Sep (D-B).
INSERT INTO agent_knowledge (id, kind, country, guide_id, title, body, active, updated_by)
VALUES
  ('d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d101',
   'instructions', NULL, NULL,
   'Draft-reply instructions (stub)',
   'You are the FjordAnglers reply assistant.

Draft a warm, professional reply to the angler''s most recent message.
Use the conversation history and knowledge files provided.
Return only the reply text — no subject line, no greeting scaffold, no commentary.',
   true, '9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a01'),

  ('d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d202',
   'tone', NULL, NULL,
   'Tone of voice',
   'Warm, direct, no marketing jargon. Short sentences. Never promise a date or a price
that is not in the thread. Fictional seed content.',
   true, '9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a01'),

  ('d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d303',
   'destination', 'Iceland', NULL,
   'Iceland — basics',
   'Season runs June to September. Licences are arranged by the guide. Fictional seed
content — the real text arrives with FA-1.17 / FA-1.26, typed by tj in the panel.',
   true, '9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a01'),

  ('d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d404',
   'guide', NULL, '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9c03',
   'Jon Seed — rates and style',
   'Rates as prose, per O-21: 450 EUR per day for two anglers, boat and gear included.
Fishes the south-west rivers. Fictional seed content.',
   true, '9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a01')
ON CONFLICT (id) DO NOTHING;

-- ═════════════════════════════════════════════════════════════════════════════
-- FA-1.36 — category A coverage for /admin/data-gaps ("booking without a payment date")
--
-- Every other gap category (B: zero amount, C: offer without a date, D: loss without a
-- code) already has at least one row above (Kari Weekly / f6…, Alice Seed / a1…, Mats
-- Weekly / f8…). Category A had none: no seed row reached a booked state with
-- deposit_paid_at left null. `stage_reached` is settable directly on INSERT — the
-- "must advance" trigger only fires on UPDATE OF stage_reached (baseline line 2634) — so
-- this row also doubles as the round-2 red proof case: `status` alone (still
-- 'awaiting_payment') would miss it; `stage_reached` already reads 'deposit_paid'.
-- ═════════════════════════════════════════════════════════════════════════════

INSERT INTO inquiries (
  id, angler_name, angler_email, status, stage_reached, deposit_paid_at, created_at, updated_at
) VALUES (
  'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f010', 'Otto Gap', 'otto@seed.test',
  'awaiting_payment', 'deposit_paid', NULL,
  '2026-07-05 10:00:00+00', '2026-07-05 10:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- FA-1.50 — offer pages for the offer-centric schema (fictional, synthetic)
--
-- Three pages: NZ (active, guide), Iceland (active, guide), a draft with no guide — each
-- with at least one option — and a second fictional guide, so a second `primary` can be
-- attempted in a red proof. All UUIDs are v4.
--
-- FA-1.53 (tj, 2026-10-07) adds the offer-page fixture the v2 template needs to render:
-- `experience_guides` (one active primary per active page) and `experience_prices` (NZ only),
-- plus the v2 columns on the two active pages. `experience_slug_aliases` stays unseeded.
-- Two consequences of seeding tables the migration also backfills:
--   • Nothing here relies on the backfill. On `supabase db reset` the migration runs BEFORE
--     this file, so its backfill never sees these rows — `offer_mode`, `price_from_cents`
--     and the option `kind`/`currency` are therefore written out in full below, not inherited.
--   • FA-1.50's verification re-runs the BACKFILL-BEGIN … BACKFILL-END block of
--     20261007000000_experience_offer_centric_expand.sql by hand after the seed. Its
--     `experience_guides` INSERT is now a no-op for both active pages (ON CONFLICT DO NOTHING
--     over the rows below), so the count check still matches but no longer demonstrates that
--     the backfill inserts anything. Use a page added after the seed for that.
-- No `guide_price_override_cents` anywhere: the public read policy on `experience_guides` is
-- wider than what the page may show (docs/deferred-tasks.md, FA-1.50), so the seed does not
-- put an override on a row anon can read.
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO guides (
  id, full_name, country, city, status, languages, fish_expertise, years_experience, bio,
  avatar_url, google_rating, google_review_count, google_profile_url, association, response_time_hours
) VALUES (
  '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9c04',
  'Hana Seed', 'New Zealand', 'Queenstown', 'active',
  ARRAY['en'], ARRAY['brown trout', 'rainbow trout'], 9,
  'Fictional seed guide. Not a real person, not real content.',
  '/brand/profile-photo.png', 4.9, 37, 'https://example.com/seed-google-profile-hana', 'SEED-ASSOC', 24
) ON CONFLICT (id) DO NOTHING;

-- Both active pages are on page_version = 2, so the v2 template renders them as soon as
-- EXPERIENCE_V2_ENABLED is on. NZ is the `fixed` variant (calculator over experience_prices);
-- Iceland is `custom` (a price range, no calculator) — offer_mode is written out because the
-- migration's backfill runs before this file and never sees these rows.
-- price_from_cents mirrors what that backfill would have made of price_from; the v2 `fixed`
-- page ignores it and prices from experience_prices (its semantics are unresolved —
-- docs/deferred-tasks.md, FA-1.50). The `custom` page is the one that shows it, as stored.
INSERT INTO experience_pages (
  id, guide_id, experience_name, slug, country, region, status, price_from, currency,
  page_version, offer_mode, price_from_cents, price_to_cents,
  intro_text, skill_level, season_months, includes,
  min_days, max_days, max_anglers_per_guide, response_sla_hours,
  hero_image_url, gallery_image_urls, meta_title, meta_description
)
VALUES
  ('e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e101', '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9c04',
   'Seed Backcountry Day, South Island', 'seed-backcountry-day-nz', 'New Zealand', 'Otago',
   'active', 650, 'NZD',
   2, 'fixed', 65000, NULL,
   'Sight-fishing for wild brown trout in clear backcountry water. Full day, one or two anglers. Fictional seed content.',
   3, ARRAY[10, 11, 12, 1, 2, 3, 4], ARRAY['Guide service', 'Gear and flies included', 'Lunch on the river'],
   1, 3, 2, 24,
   '/hero.jpg',
   ARRAY['/about/gallery-1.jpg', '/about/gallery-2.jpg', '/about/gallery-3.jpg', '/about/gallery-4.jpg', '/brand/guide-fishing.jpg'],
   'Seed Backcountry Day, South Island', 'Fictional seed page for the v2 offer template. Not real content.'),
  ('e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e202', '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9c03',
   'Seed Salmon Week, South-West Iceland', 'seed-salmon-week-iceland', 'Iceland', 'South-West',
   'active', 450.50, 'EUR',
   2, 'custom', 45050, 320000,
   'Multi-day salmon fishing on a private beat in South-West Iceland. Planned around your dates. Fictional seed content.',
   2, ARRAY[6, 7, 8, 9], ARRAY['Guide service', 'Transfers from Reykjavik'],
   3, 7, 2, 48,
   '/iceland.jpg',
   ARRAY['/norway.jpg', '/sweden.jpg', '/brand/hero-fjord.jpg'],
   'Seed Salmon Week, South-West Iceland', 'Fictional seed page for the v2 offer template, custom mode. Not real content.'),
  ('e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e303', NULL,
   'Seed Draft Page, Finland', 'seed-draft-finland', 'finland', 'Lapland',
   'draft', 300, 'EUR',
   1, 'fixed', 30000, NULL,
   NULL, NULL, '{}', '{}',
   1, NULL, 2, 24,
   NULL, '{}', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO experience_page_options (id, experience_page_id, sort_order, label, price_from)
VALUES
  ('e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e401', 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e101', 0, 'Full day, two anglers', 650),
  ('e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e502', 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e202', 0, 'Day trip from Reykjavik', 450.50),
  ('e6e6e6e6-e6e6-4e6e-8e6e-e6e6e6e6e603', 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e202', 1, 'Lodge week', 3200),
  ('e7e7e7e7-e7e7-4e7e-8e7e-e7e7e7e7e704', 'e3e3e3e3-e3e3-4e3e-8e3e-e3e3e3e3e303', 0, 'Draft option', 300)
ON CONFLICT (id) DO NOTHING;

-- ─── experience_prices — the NZ (`fixed`) page only (FA-1.53) ────────────────
-- Guide prices, excluding the FA fee; the angler sees guide_price_cents × (1 + fee_pct = 0.20),
-- computed, never stored (O-31). Amounts are chosen so the 20% divides to a whole cent, which
-- is what the widget's "Total / Deposit / Balance" lines add up from.
--   (1 day, 1 angler)  900.00 → total 1 080.00   ← the minimum total, i.e. the "from" price
--   (1 day, 2 anglers) 1 250.00 → total 1 500.00
--   (2 days, 2 anglers) 2 400.00 → total 2 880.00
-- The fourth row is deliberately EXPIRED (season 2024): a reader of getExperienceV2() must be
-- able to see that "current by valid_from/valid_to" is filtered, not merely asserted. It shares
-- (days, anglers) with the undated row above it, which the UNIQUE constraint allows because
-- valid_from differs (NULLS NOT DISTINCT only collapses two *undated* rows).
-- Iceland gets no rows on purpose: `custom` has no price table, and that is also the empty
-- state ("no price rows") the v2 calculator has to survive.
INSERT INTO experience_prices (id, experience_id, days, anglers, guide_price_cents, currency, valid_from, valid_to)
VALUES
  ('e8e8e8e8-e8e8-4e8e-8e8e-e8e8e8e8e801', 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e101', 1, 1,  90000, 'NZD', NULL, NULL),
  ('e8e8e8e8-e8e8-4e8e-8e8e-e8e8e8e8e802', 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e101', 1, 2, 125000, 'NZD', NULL, NULL),
  ('e8e8e8e8-e8e8-4e8e-8e8e-e8e8e8e8e803', 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e101', 2, 2, 240000, 'NZD', NULL, NULL),
  ('e8e8e8e8-e8e8-4e8e-8e8e-e8e8e8e8e804', 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e101', 1, 2, 100000, 'NZD', '2024-01-01', '2024-12-31')
ON CONFLICT (id) DO NOTHING;

-- ─── experience_guides — one active primary per active page (FA-1.53) ───────
-- Inserted after experience_prices: the override trigger reads the base price row. No override
-- is set here (see the block header), so the trigger returns early either way.
INSERT INTO experience_guides (experience_id, guide_id, role, status, show_on_page, sort_order)
VALUES
  ('e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e101', '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9c04', 'primary', 'active', true, 0),
  ('e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e202', '9c9c9c9c-9c9c-4c9c-8c9c-9c9c9c9c9c03', 'primary', 'active', true, 0)
ON CONFLICT DO NOTHING;
