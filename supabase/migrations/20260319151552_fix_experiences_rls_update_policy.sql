-- Fix RLS UPDATE policy on `experiences`.
--
-- Bug: policy referenced OLD.user_id but the table has no user_id column.
--      experiences.guide_id → guides.user_id is the correct chain.
--
-- Drop all UPDATE policies on experiences and recreate correctly.

-- 1. Drop any existing UPDATE policies (names may vary — drop by name pattern)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'experiences'
      AND cmd        = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.experiences', pol.policyname);
  END LOOP;
END $$;

-- 2. Recreate the UPDATE policy using guide_id → guides.user_id join
CREATE POLICY "guides_can_update_own_experiences"
  ON public.experiences
  FOR UPDATE
  USING (
    guide_id IN (
      SELECT id FROM public.guides WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    guide_id IN (
      SELECT id FROM public.guides WHERE user_id = auth.uid()
    )
  );

-- 3. Also ensure SELECT / INSERT / DELETE policies are correct
--    (recreate only if they reference user_id wrongly — safe to run idempotently)

-- SELECT: anglers see published, guide sees own, admin sees all
DROP POLICY IF EXISTS "experiences_select" ON public.experiences;
CREATE POLICY "experiences_select"
  ON public.experiences
  FOR SELECT
  USING (
    published = true
    OR guide_id IN (SELECT id FROM public.guides WHERE user_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- INSERT: guide inserts for themselves, admin inserts for anyone
DROP POLICY IF EXISTS "experiences_insert" ON public.experiences;
CREATE POLICY "experiences_insert"
  ON public.experiences
  FOR INSERT
  WITH CHECK (
    guide_id IN (SELECT id FROM public.guides WHERE user_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- DELETE: guide deletes own, admin deletes any
DROP POLICY IF EXISTS "experiences_delete" ON public.experiences;
CREATE POLICY "experiences_delete"
  ON public.experiences
  FOR DELETE
  USING (
    guide_id IN (SELECT id FROM public.guides WHERE user_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );
