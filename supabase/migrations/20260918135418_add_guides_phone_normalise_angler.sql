-- FA-1.13 — guides.phone_e164 + normalise inquiries.angler_phone to E.164
--
-- Backfill rules (mirrors normalisePhoneForStorage in src/lib/inquiries/create.ts):
--   1. Starts with '+' → already E.164 — strip formatting chars only
--   2. Starts with '00' → replace 00-prefix with '+', strip formatting chars
--   3. trip_country IN NANP set AND exactly 10 stripped digits → prepend +1
--   4. Anything else → SKIP (leave original untouched), log ID for manual review
--
-- Production baseline (live read 2026-09-18):
--   null_phone=24, already_e164=28, to_normalise=47
--   Breakdown of 47: Iceland 43, New Zealand 3, Other 1 — none NANP.
--   Expected result: normalised=0, skipped=47, null=24
--   RAISE NOTICE will list all 47 IDs for manual review.
--
-- STOP: do not run on production until tj confirms WHATSAPP_APP_SECRET is in Vercel.

ALTER TABLE guides ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
CREATE INDEX IF NOT EXISTS guides_phone_e164_idx
  ON guides (phone_e164) WHERE phone_e164 IS NOT NULL;
COMMENT ON COLUMN guides.phone_e164 IS
  'Guide WhatsApp number in E.164 format (e.g. +48123456789). Not UNIQUE — shared phones are valid.';

CREATE INDEX IF NOT EXISTS inquiries_angler_phone_idx
  ON inquiries (angler_phone) WHERE angler_phone IS NOT NULL;

DO $$
DECLARE
  r             RECORD;
  stripped      TEXT;
  digit_only    TEXT;
  digit_count   INT;
  normalised_n  INT := 0;
  skipped_n     INT := 0;
  null_n        INT := 0;
  skipped_ids   TEXT := '';
BEGIN
  SELECT COUNT(*) INTO null_n
    FROM inquiries WHERE angler_phone IS NULL OR angler_phone = '';

  FOR r IN
    SELECT id, angler_phone, trip_country
    FROM inquiries
    WHERE angler_phone IS NOT NULL AND angler_phone <> ''
    ORDER BY id
  LOOP
    IF r.angler_phone LIKE '+%' THEN
      -- Rule 1: already has E.164 prefix — strip formatting chars only
      stripped := regexp_replace(r.angler_phone, '[^\d+]', '', 'g');
      UPDATE inquiries SET angler_phone = stripped WHERE id = r.id;
      normalised_n := normalised_n + 1;

    ELSIF r.angler_phone LIKE '00%' THEN
      -- Rule 2: international 00-prefix → replace with +
      stripped := '+' || regexp_replace(substring(r.angler_phone FROM 3), '[^\d]', '', 'g');
      UPDATE inquiries SET angler_phone = stripped WHERE id = r.id;
      normalised_n := normalised_n + 1;

    ELSE
      digit_only  := regexp_replace(r.angler_phone, '[^\d]', '', 'g');
      digit_count := length(digit_only);

      IF digit_count = 10
         AND r.trip_country IN ('United States', 'Canada', 'USA', 'US') THEN
        -- Rule 3: NANP trip_country + 10 digits → prepend +1
        UPDATE inquiries SET angler_phone = '+1' || digit_only WHERE id = r.id;
        normalised_n := normalised_n + 1;

      ELSE
        -- Rule 4: ambiguous — leave untouched, log for manual review
        skipped_n := skipped_n + 1;
        skipped_ids := CASE WHEN skipped_ids = '' THEN r.id::TEXT
                            ELSE skipped_ids || ', ' || r.id::TEXT
                       END;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'FA-1.13 angler_phone backfill: normalised=%, skipped=%, null=%',
    normalised_n, skipped_n, null_n;
  IF skipped_n > 0 THEN
    RAISE NOTICE 'FA-1.13 skipped IDs (manual review needed — non-E.164, no NANP trip_country): %',
      skipped_ids;
  END IF;
END;
$$;
