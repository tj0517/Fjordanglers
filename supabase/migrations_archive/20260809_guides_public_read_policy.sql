-- Allow anonymous/public SELECT on active, non-hidden guides.
-- Required for the public guide profile page (/guides/[slug]) which uses
-- the anon key client (createPublicClient) for ISR-friendly caching.
-- Without this policy, getGuide() returns null for all slugs and the
-- guide page renders 404.

CREATE POLICY "Public reads active guides"
  ON guides FOR SELECT
  USING (status = 'active' AND is_hidden = false);
