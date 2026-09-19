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
