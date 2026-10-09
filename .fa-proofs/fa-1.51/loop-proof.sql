-- FA-1.51 loop red proof. Local stack only; both transactions end in ROLLBACK.
--   psql "$LOCAL_DB" -f .fa-proofs/fa-1.51/loop-proof.sql
-- Scenario: a page with two guides (G1 primary/active, G2 backup/active); the old admin
-- changes guide_id G1 -> G2.
\set ON_ERROR_STOP off
\pset pager off

-- ─── 1. WITHOUT the guard: both functions as they would be with no flag and an
--        unconditional UPDATE in trg_sync_primary ───────────────────────────────
\echo '=== 1. guard removed ==='
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_guide_id_to_experience_guides() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.guide_id IS NOT DISTINCT FROM OLD.guide_id THEN RETURN NULL; END IF;
  UPDATE public.experience_guides SET status = 'paused'
   WHERE experience_id = NEW.id AND role = 'primary' AND status = 'active';
  IF NEW.guide_id IS NOT NULL THEN
    INSERT INTO public.experience_guides (experience_id, guide_id, role, status)
    VALUES (NEW.id, NEW.guide_id, 'primary', 'active')
    ON CONFLICT (experience_id, guide_id) DO UPDATE SET role = 'primary', status = 'active';
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.sync_primary_guide_to_guide_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE pid uuid := COALESCE(CASE WHEN TG_OP <> 'DELETE' THEN NEW.experience_id END, OLD.experience_id);
BEGIN
  UPDATE public.experience_pages SET guide_id = (
    SELECT guide_id FROM public.experience_guides
     WHERE experience_id = pid AND role = 'primary' AND status = 'active' LIMIT 1)
   WHERE id = pid;
  RETURN NULL;
END $$;

INSERT INTO public.guides (id, full_name, country) VALUES
  ('51a00000-0000-4000-8000-0000000000f1', 'loop proof g1', 'New Zealand'),
  ('51a00000-0000-4000-8000-0000000000f2', 'loop proof g2', 'New Zealand');
INSERT INTO public.experience_pages (id, experience_name, slug, country, region, price_from)
VALUES ('51b00000-0000-4000-8000-0000000000f1', 'loop proof', 'fa151-loop-proof', 'New Zealand', 'x', 1);
INSERT INTO public.experience_guides (experience_id, guide_id, role, status) VALUES
  ('51b00000-0000-4000-8000-0000000000f1', '51a00000-0000-4000-8000-0000000000f1', 'primary', 'active'),
  ('51b00000-0000-4000-8000-0000000000f1', '51a00000-0000-4000-8000-0000000000f2', 'backup',  'active');

UPDATE public.experience_pages SET guide_id = '51a00000-0000-4000-8000-0000000000f2'
 WHERE id = '51b00000-0000-4000-8000-0000000000f1';

ROLLBACK;

-- ─── 2. WITH the guard: the migration's functions, unchanged ──────────────────
\echo '=== 2. guard in place (migration as shipped) ==='
BEGIN;

INSERT INTO public.guides (id, full_name, country) VALUES
  ('51a00000-0000-4000-8000-0000000000f1', 'loop proof g1', 'New Zealand'),
  ('51a00000-0000-4000-8000-0000000000f2', 'loop proof g2', 'New Zealand');
INSERT INTO public.experience_pages (id, experience_name, slug, country, region, price_from)
VALUES ('51b00000-0000-4000-8000-0000000000f1', 'loop proof', 'fa151-loop-proof', 'New Zealand', 'x', 1);
INSERT INTO public.experience_guides (experience_id, guide_id, role, status) VALUES
  ('51b00000-0000-4000-8000-0000000000f1', '51a00000-0000-4000-8000-0000000000f1', 'primary', 'active'),
  ('51b00000-0000-4000-8000-0000000000f1', '51a00000-0000-4000-8000-0000000000f2', 'backup',  'active');

UPDATE public.experience_pages SET guide_id = '51a00000-0000-4000-8000-0000000000f2'
 WHERE id = '51b00000-0000-4000-8000-0000000000f1';

SELECT right(guide_id::text, 2) AS guide, role, status
  FROM public.experience_guides WHERE experience_id = '51b00000-0000-4000-8000-0000000000f1' ORDER BY 1;
SELECT count(*) AS primary_active_rows FROM public.experience_guides
  WHERE experience_id = '51b00000-0000-4000-8000-0000000000f1' AND role = 'primary' AND status = 'active';
SELECT right(guide_id::text, 2) AS pages_guide_id FROM public.experience_pages
  WHERE id = '51b00000-0000-4000-8000-0000000000f1';

ROLLBACK;

\echo '=== leftovers after both rollbacks (must be 0) ==='
SELECT count(*) AS leftover_pages FROM public.experience_pages WHERE slug = 'fa151-loop-proof';
SELECT count(*) AS leftover_guides FROM public.guides WHERE full_name LIKE 'loop proof%';
