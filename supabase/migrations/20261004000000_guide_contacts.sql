-- FA-1.13 (fix) — the guide's contact number leaves the public guides row
--
-- Why: 20260918135418 added guides.phone_e164. guides has the baseline policy
--   "Public reads all guides" FOR SELECT USING (true)
-- so every column on it is readable with the publishable key shipped in the browser
-- bundle. The column was empty in production, so nothing has leaked yet — but
-- docs/ops/whatsapp-e2e-checklist.md tells the operator to fill it, and from that
-- moment a guide's private WhatsApp number would be world-readable.
--
-- What: the number moves to its own table with RLS enabled and a policy for
-- service_role only. No policy for anon or authenticated — and, following the
-- offers precedent (20260917104506), no table privileges for them either, so the
-- denial holds even if someone adds a permissive policy later by mistake.
--
-- 20260918135418 is already applied in production and is NOT edited; this migration
-- moves the data (zero rows in production, but correct for any environment) and
-- drops the column.

-- ────────────────────────────────────────────────────────
-- 1. Table
-- ────────────────────────────────────────────────────────
CREATE TABLE public.guide_contacts (
  guide_id    UUID PRIMARY KEY REFERENCES public.guides(id) ON DELETE CASCADE,
  phone_e164  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.guide_contacts IS
  'Private contact details of a guide. service_role only — never readable with the publishable key. Kept out of guides because guides is publicly selectable.';
COMMENT ON COLUMN public.guide_contacts.phone_e164 IS
  'Guide WhatsApp number in E.164 format (e.g. +48123456789). Not UNIQUE — shared phones are valid.';

CREATE INDEX guide_contacts_phone_e164_idx
  ON public.guide_contacts (phone_e164) WHERE phone_e164 IS NOT NULL;

CREATE OR REPLACE TRIGGER guide_contacts_set_updated_at
  BEFORE UPDATE ON public.guide_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────
-- 2. RLS — same migration as the table, never a separate one
-- ────────────────────────────────────────────────────────
ALTER TABLE public.guide_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on guide_contacts"
  ON public.guide_contacts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.guide_contacts TO service_role;
REVOKE ALL ON TABLE public.guide_contacts FROM anon, authenticated;

-- ────────────────────────────────────────────────────────
-- 3. Move the data, then drop the column
-- ────────────────────────────────────────────────────────
INSERT INTO public.guide_contacts (guide_id, phone_e164)
SELECT id, phone_e164 FROM public.guides WHERE phone_e164 IS NOT NULL;

DROP INDEX IF EXISTS public.guides_phone_e164_idx;
ALTER TABLE public.guides DROP COLUMN phone_e164;
