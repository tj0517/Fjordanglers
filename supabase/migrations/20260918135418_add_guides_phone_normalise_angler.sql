-- FA-1.13 — guides.phone_e164 + normalise inquiries.angler_phone to E.164

ALTER TABLE guides ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
CREATE INDEX IF NOT EXISTS guides_phone_e164_idx
  ON guides (phone_e164) WHERE phone_e164 IS NOT NULL;
COMMENT ON COLUMN guides.phone_e164 IS
  'Guide WhatsApp number in E.164 format (e.g. +48123456789). Not UNIQUE — shared phones are valid.';

-- Index for inbound routing lookups
CREATE INDEX IF NOT EXISTS inquiries_angler_phone_idx
  ON inquiries (angler_phone) WHERE angler_phone IS NOT NULL;

-- Normalise existing angler_phone values to E.164.
-- Leaves un-normalisable rows unchanged (preserves originals).
DO $$
DECLARE
  r           RECORD;
  stripped    TEXT;
  digit_count INT;
BEGIN
  FOR r IN
    SELECT id, angler_phone FROM inquiries
    WHERE angler_phone IS NOT NULL AND angler_phone <> ''
  LOOP
    stripped := regexp_replace(r.angler_phone, '[^\d+]', '', 'g');
    IF stripped NOT LIKE '+%' THEN
      stripped := '+' || stripped;
    END IF;
    digit_count := length(regexp_replace(stripped, '[^\d]', '', 'g'));
    IF digit_count >= 7 AND digit_count <= 15 THEN
      UPDATE inquiries SET angler_phone = stripped WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;
