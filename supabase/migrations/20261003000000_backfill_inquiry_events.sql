-- FA-1.05 — Backfill historical events into inquiry_events
--
-- Prod audit 2026-09-19 (uwxrstbplaoxfghrchcy). Sources entering backfill:
--   inquiry.created   99 rows  — inquiries.created_at (NOT NULL)
--   message.sent     314 rows  — messages direction=outbound (occurred_at from FA-1.12)
--   message.received 370 rows  — messages direction=inbound  (occurred_at from FA-1.12)
--   offer.presented    1 row   — inquiries.offer_sent_at (1 non-null row)
--   payment.received   0 rows  — inquiries.deposit_paid_at (all NULL on prod; block kept for idempotency)
-- Not backfilled:
--   guide.contacted  — messages has 0 rows with counterpart='guide'; source does not exist
--   inquiry.lost     — no timestamp column; updated_at rejected by tj as proxy (D-A1)
--   status.changed   — no transition history
--
-- Idempotency: message.* keyed on message_id (no type/source filter — covers live events too).
--              All other types: (inquiry_id, type) — source excluded so a live event (source='app')
--              also prevents a duplicate backfill row. Deviation from D2 literal, approved tj 19 IX.
-- Rollback:    DELETE FROM inquiry_events WHERE source = 'backfill';
--              Safe: BEFORE UPDATE trigger only; REVOKE covers service_role, not DB owner.

-- ─── 1. inquiry.created ──────────────────────────────────────────────────────

DO $$
DECLARE v_count BIGINT;
BEGIN
  INSERT INTO inquiry_events (
    inquiry_id, type, actor_kind, channel, source,
    occurred_at, created_at, payload
  )
  SELECT
    i.id,
    'inquiry.created',
    'system',
    'app',
    'backfill',
    i.created_at,
    now(),
    jsonb_build_object('backfilled_from', 'inquiries.created_at')
  FROM inquiries i
  WHERE NOT EXISTS (
    SELECT 1 FROM inquiry_events e
    WHERE e.inquiry_id = i.id
      AND e.type      = 'inquiry.created'
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'backfill inquiry.created: % rows', v_count;
END $$;

-- ─── 2. message.sent ─────────────────────────────────────────────────────────

DO $$
DECLARE v_count BIGINT;
BEGIN
  INSERT INTO inquiry_events (
    inquiry_id, type, actor_kind, channel, source,
    message_id, occurred_at, created_at, payload
  )
  SELECT
    m.inquiry_id,
    'message.sent',
    CASE WHEN m.drafted_by = 'agent' THEN 'agent' ELSE 'admin' END,
    m.channel,
    'backfill',
    m.id,
    m.occurred_at,
    now(),
    jsonb_build_object(
      'backfilled_from', 'messages',
      'counterpart',     m.counterpart,
      'drafted_by',      m.drafted_by
    )
  FROM messages m
  WHERE m.direction = 'outbound'
    AND NOT EXISTS (
      SELECT 1 FROM inquiry_events e WHERE e.message_id = m.id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'backfill message.sent: % rows', v_count;
END $$;

-- ─── 3. message.received ─────────────────────────────────────────────────────

DO $$
DECLARE v_count BIGINT;
BEGIN
  INSERT INTO inquiry_events (
    inquiry_id, type, actor_kind, channel, source,
    message_id, occurred_at, created_at, payload
  )
  SELECT
    m.inquiry_id,
    'message.received',
    CASE m.counterpart WHEN 'guide' THEN 'guide' ELSE 'angler' END,
    m.channel,
    'backfill',
    m.id,
    m.occurred_at,
    now(),
    jsonb_build_object(
      'backfilled_from', 'messages',
      'counterpart',     m.counterpart
    )
  FROM messages m
  WHERE m.direction = 'inbound'
    AND NOT EXISTS (
      SELECT 1 FROM inquiry_events e WHERE e.message_id = m.id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'backfill message.received: % rows', v_count;
END $$;

-- ─── 4. offer.presented ──────────────────────────────────────────────────────
-- Only rows with offer_sent_at IS NOT NULL (1 on prod).
-- Rows with external_offer_sent=true but offer_sent_at NULL are intentionally excluded.

DO $$
DECLARE v_count BIGINT;
BEGIN
  INSERT INTO inquiry_events (
    inquiry_id, type, actor_kind, channel, source,
    occurred_at, created_at, payload
  )
  SELECT
    i.id,
    'offer.presented',
    'admin',
    'email',
    'backfill',
    i.offer_sent_at,
    now(),
    jsonb_build_object('backfilled_from', 'inquiries.offer_sent_at')
  FROM inquiries i
  WHERE i.offer_sent_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM inquiry_events e
      WHERE e.inquiry_id = i.id
        AND e.type      = 'offer.presented'
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'backfill offer.presented: % rows', v_count;
END $$;

-- ─── 5. payment.received ─────────────────────────────────────────────────────
-- deposit_paid_at was NULL for all 99 inquiries on prod (audit 2026-09-19).
-- Block included for idempotency completeness; will insert 0 rows on prod.

DO $$
DECLARE v_count BIGINT;
BEGIN
  INSERT INTO inquiry_events (
    inquiry_id, type, actor_kind, channel, source,
    occurred_at, created_at, payload
  )
  SELECT
    i.id,
    'payment.received',
    'system',
    'stripe',
    'backfill',
    i.deposit_paid_at,
    now(),
    jsonb_build_object(
      'amount',          COALESCE(i.deposit_amount, i.offer_deposit_eur),
      'currency',        'EUR',
      'backfilled_from', 'inquiries.deposit_paid_at'
    )
  FROM inquiries i
  WHERE i.deposit_paid_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM inquiry_events e
      WHERE e.inquiry_id = i.id
        AND e.type      = 'payment.received'
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'backfill payment.received: % rows', v_count;
END $$;
