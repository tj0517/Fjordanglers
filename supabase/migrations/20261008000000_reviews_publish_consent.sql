-- FA-1.59 — reviews: publication consent, page pin backfill, no anon read.
-- Re-runnable: ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS, backfill guarded by IS NULL.

-- O-38 (a): one consent flag covers first name, country and photos.
-- Default false: a review without an explicit yes is never shown (O-37 a).
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS publish_consent    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_consent_at timestamptz;

COMMENT ON COLUMN public.reviews.publish_consent IS
  'Reviewer agreed to publication of first name, country and photos on the experience page (O-38 a). False for every review collected before FA-1.59.';
COMMENT ON COLUMN public.reviews.publish_consent_at IS
  'When the reviewer ticked the publication box. Set only when publish_consent is true.';

-- Pin existing reviews to the experience page of their inquiry (FA-1.50 added the column without a backfill).
-- Only rows still NULL are touched, so a second run changes nothing.
UPDATE public.reviews AS r
   SET experience_id = i.experience_page_id
  FROM public.inquiries AS i
 WHERE i.id = r.inquiry_id
   AND r.experience_id IS NULL
   AND i.experience_page_id IS NOT NULL;

-- D2: the anon key must not read reviews — the table holds link tokens and unpublished content.
-- RLS stays enabled; with no policy left, only the service role reads it.
DROP POLICY IF EXISTS "Public read reviews" ON public.reviews;
