-- FA-1.12 — data migration: lead_messages + inquiry_messages → messages
--
-- Source mapping (verified on prod 2026-09-17):
--   lead_messages:    channel ∈ {email, whatsapp}; direction ∈ {inbound, outbound};
--                     contact_type = 'client' (100% of 594 rows) → counterpart='angler';
--                     content → body; created_at → occurred_at.
--                     status: inbound → 'received'; outbound → 'sent'.
--   inquiry_messages: all outbound email to angler; sent_at always NOT NULL (75 rows);
--                     channel='email', direction='outbound', counterpart='angler'.
--
-- Original IDs are preserved for traceability. Migration is idempotent (skips rows
-- already present in messages by id).
--
-- DOES NOT drop lead_messages or inquiry_messages — that is a separate migration
-- behind a STOP gate (show counts + verification query first).

DO $$
DECLARE
  v_lead_before      BIGINT;
  v_inquiry_before   BIGINT;
  v_lead_skipped     BIGINT;
  v_lead_inserted    BIGINT;
  v_inquiry_inserted BIGINT;
  v_unknown_channels BIGINT;
BEGIN
  SELECT count(*) INTO v_lead_before    FROM lead_messages;
  SELECT count(*) INTO v_inquiry_before FROM inquiry_messages;

  RAISE NOTICE 'migrate_messages: BEFORE — lead_messages=%, inquiry_messages=%, total_expected=%',
    v_lead_before, v_inquiry_before, v_lead_before + v_inquiry_before;

  -- ── Guard: count lead_messages rows with channels not in the messages CHECK ──
  SELECT count(*) INTO v_unknown_channels
  FROM lead_messages
  WHERE channel NOT IN ('email', 'whatsapp', 'instagram');

  IF v_unknown_channels > 0 THEN
    RAISE EXCEPTION 'migrate_messages: % lead_messages row(s) have unknown channel values — fix mapping before proceeding',
      v_unknown_channels;
  END IF;

  -- ── lead_messages → messages ─────────────────────────────────────────────────
  SELECT count(*) INTO v_lead_skipped
  FROM lead_messages lm
  WHERE EXISTS (SELECT 1 FROM messages m WHERE m.id = lm.id);

  IF v_lead_skipped > 0 THEN
    RAISE NOTICE 'migrate_messages: skipping % lead_messages rows already in messages (idempotent re-run)',
      v_lead_skipped;
  END IF;

  INSERT INTO messages (
    id, inquiry_id, channel, direction, counterpart,
    body, status, occurred_at, created_at
  )
  SELECT
    lm.id,
    lm.inquiry_id,
    lm.channel,
    lm.direction,
    'angler'                                                     AS counterpart,
    lm.content                                                   AS body,
    CASE lm.direction WHEN 'inbound' THEN 'received' ELSE 'sent' END AS status,
    lm.created_at                                                AS occurred_at,
    lm.created_at
  FROM lead_messages lm
  WHERE NOT EXISTS (SELECT 1 FROM messages m WHERE m.id = lm.id);

  GET DIAGNOSTICS v_lead_inserted = ROW_COUNT;

  -- ── inquiry_messages → messages ──────────────────────────────────────────────
  INSERT INTO messages (
    id, inquiry_id, channel, direction, counterpart,
    subject, body, status, occurred_at, created_at
  )
  SELECT
    im.id,
    im.inquiry_id,
    'email'                                                      AS channel,
    'outbound'                                                   AS direction,
    'angler'                                                     AS counterpart,
    im.subject,
    im.body,
    'sent'                                                       AS status,
    im.sent_at                                                   AS occurred_at,
    im.sent_at                                                   AS created_at
  FROM inquiry_messages im
  WHERE NOT EXISTS (SELECT 1 FROM messages m WHERE m.id = im.id);

  GET DIAGNOSTICS v_inquiry_inserted = ROW_COUNT;

  RAISE NOTICE 'migrate_messages: inserted from lead_messages=%, from inquiry_messages=%',
    v_lead_inserted, v_inquiry_inserted;
  RAISE NOTICE 'migrate_messages: total messages now=%  expected=%',
    (SELECT count(*) FROM messages), v_lead_before + v_inquiry_before;

  IF (SELECT count(*) FROM messages) <> v_lead_before + v_inquiry_before THEN
    RAISE EXCEPTION 'migrate_messages: count mismatch — messages=% but expected %',
      (SELECT count(*) FROM messages), v_lead_before + v_inquiry_before;
  END IF;

  RAISE NOTICE 'migrate_messages: OK — count matches';
END $$;
