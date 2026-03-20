-- Add per-experience inquiry form configuration column.
-- Guides can control which fields are required / optional / hidden
-- in the inquiry form shown to anglers on the trip page.

ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS inquiry_form_config jsonb;

COMMENT ON COLUMN public.experiences.inquiry_form_config IS
  'Per-experience inquiry form field visibility config. '
  'Each key maps to ''required'' | ''optional'' | ''hidden''. '
  'NULL means use platform defaults.';
