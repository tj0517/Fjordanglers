-- FA-1.12 — drop lead_messages + inquiry_messages (DEFERRED)
--
-- Moved from 20260917130000 by decision tj 2026-09-19: zero-window deploy.
-- Applies AFTER stage-1 code is live on production (new code reads `messages`,
-- not lead_messages / inquiry_messages).  Do NOT run until:
--   1. stage-1 deployment is Ready in Vercel;
--   2. grep confirms no live code writes to lead_messages / inquiry_messages;
--   3. row counts in both tables have not grown since krok 4 of the push procedure.
--
-- Pre-condition: every id from lead_messages and inquiry_messages must already
-- exist in messages (migration 20260917120000_migrate_messages_data ran first).
-- The guard below raises EXCEPTION if any id is missing — it checks coverage,
-- not a hard-coded count, so it is safe to run on prod where counts differ.
--
-- NB: unmatched_messages references lead_messages implicitly (no FK) via the
-- admin UI. After this drop, matchUnmatchedMessage + bulkMatchUnmatchedMessages
-- write directly to messages (updated in FA-1.12 app code).

DO $$
DECLARE
  v_lead_missing    BIGINT;
  v_inquiry_missing BIGINT;
BEGIN
  -- Verify every lead_messages id is in messages
  SELECT count(*) INTO v_lead_missing
  FROM lead_messages lm
  WHERE NOT EXISTS (SELECT 1 FROM messages m WHERE m.id = lm.id);

  IF v_lead_missing > 0 THEN
    RAISE EXCEPTION 'drop_legacy_tables: % lead_messages rows have no matching messages row — run migrate_messages_data first',
      v_lead_missing;
  END IF;

  -- Verify every inquiry_messages id is in messages
  SELECT count(*) INTO v_inquiry_missing
  FROM inquiry_messages im
  WHERE NOT EXISTS (SELECT 1 FROM messages m WHERE m.id = im.id);

  IF v_inquiry_missing > 0 THEN
    RAISE EXCEPTION 'drop_legacy_tables: % inquiry_messages rows have no matching messages row — run migrate_messages_data first',
      v_inquiry_missing;
  END IF;

  RAISE NOTICE 'drop_legacy_tables: all ids verified — dropping lead_messages and inquiry_messages';
END $$;

DROP TABLE lead_messages;
DROP TABLE inquiry_messages;
