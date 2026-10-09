-- FA-1.51: SYNC — the old columns and the new tables say the same thing.
-- docs/proposals/2026-10-05-experience-offer-centric.md §7 step 2.
--
-- Until the v2 pilot ends, the old admin writes experience_pages.guide_id and price_from,
-- and the new admin (FA-1.56) writes experience_guides and price_from_cents. Three
-- triggers make both writes lead to one state:
--
--   trg_sync_guide_id   AFTER INSERT OR UPDATE OF guide_id  ON experience_pages
--                       guide_id -> experience_guides: the previous active primary is
--                       paused, the new guide becomes primary/active.
--   trg_sync_primary    AFTER INSERT OR UPDATE OR DELETE    ON experience_guides
--                       the page's active primary guide -> experience_pages.guide_id
--                       (NULL when there is none).
--   trg_sync_price_from BEFORE INSERT OR UPDATE OF price_from ON experience_pages
--                       price_from (numeric) -> price_from_cents (integer).
--
-- Why trg_sync_guide_id is AFTER, not BEFORE as the proposal sketches it: the proposal
-- is BEFORE UPDATE only, and FA-1.51 adds INSERT (decision D1, 2026-10-08 — the old admin
-- sets guide_id only when it creates a page). In a BEFORE INSERT trigger the page row does
-- not exist yet, so inserting experience_guides(experience_id = NEW.id) fails on its FK.
-- price_from_cents, on the other hand, has to be written into NEW, which only a BEFORE
-- trigger can do — hence two triggers on experience_pages instead of one.
--
-- Loop guard. The two guide triggers write into each other's table. Without a guard,
-- pausing the old primary re-fires trg_sync_primary, which rewrites guide_id, which
-- re-fires trg_sync_guide_id ... Postgres ends that with "tuple to be updated was already
-- modified by an operation triggered by the current command". Each trigger therefore sets
-- the transaction-local flag fa.experience_guides_sync = 'on' around its own writes and
-- returns at once when it sees the flag set by the other one. On top of that
-- trg_sync_primary only writes guide_id when it differs from the current value.
-- (A flag rather than pg_trigger_depth(): the depth is also > 0 when an unrelated trigger
-- caused the write, and that write must still be synced.)
--
-- Functions are SECURITY INVOKER like experience_guides_check_override: the writers are
-- admins (admin policy on both tables) and service_role.
--
-- No data is changed here. Prod was read on 2026-10-08: 0 pages whose guide_id differs
-- from their active primary, 0 whose price_from_cents differs from round(price_from*100).
--
-- Everything below is temporary: dropped in the stage-4 CONTRACT (proposal §7 step 4).

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. experience_pages.guide_id  ->  experience_guides
-- ═════════════════════════════════════════════════════════════════════════════
CREATE FUNCTION public.sync_guide_id_to_experience_guides()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- The change came from sync_primary_guide_to_guide_id(): experience_guides is already right.
  IF current_setting('fa.experience_guides_sync', true) = 'on' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.guide_id IS NOT DISTINCT FROM OLD.guide_id THEN
    RETURN NULL;
  END IF;

  PERFORM set_config('fa.experience_guides_sync', 'on', true);

  -- Pause first: the partial unique index experience_guides_one_primary allows one
  -- primary/active row per page, so the new primary cannot go in beside the old one.
  UPDATE public.experience_guides
  SET status = 'paused'
  WHERE experience_id = NEW.id
    AND role = 'primary'
    AND status = 'active'
    AND guide_id IS DISTINCT FROM NEW.guide_id;

  IF NEW.guide_id IS NOT NULL THEN
    INSERT INTO public.experience_guides (experience_id, guide_id, role, status)
    VALUES (NEW.id, NEW.guide_id, 'primary', 'active')
    ON CONFLICT (experience_id, guide_id) DO UPDATE
      SET role = 'primary', status = 'active';
  END IF;

  PERFORM set_config('fa.experience_guides_sync', 'off', true);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_guide_id
  AFTER INSERT OR UPDATE OF guide_id ON public.experience_pages
  FOR EACH ROW EXECUTE FUNCTION public.sync_guide_id_to_experience_guides();

COMMENT ON FUNCTION public.sync_guide_id_to_experience_guides() IS
  'temporary until stage-4 CONTRACT (docs/proposals/2026-10-05-experience-offer-centric.md §7 step 4): experience_pages.guide_id -> experience_guides primary/active.';
COMMENT ON TRIGGER trg_sync_guide_id ON public.experience_pages IS
  'temporary until stage-4 CONTRACT (docs/proposals/2026-10-05-experience-offer-centric.md §7 step 4)';

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. experience_guides  ->  experience_pages.guide_id
-- ═════════════════════════════════════════════════════════════════════════════
CREATE FUNCTION public.sync_primary_guide_to_guide_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  page_id uuid;
  primary_guide uuid;
BEGIN
  -- The change came from sync_guide_id_to_experience_guides(): guide_id is already right.
  IF current_setting('fa.experience_guides_sync', true) = 'on' THEN
    RETURN NULL;
  END IF;

  PERFORM set_config('fa.experience_guides_sync', 'on', true);

  -- NEW is not assigned in a DELETE trigger, OLD not in an INSERT trigger.
  -- A row that moved to another page (UPDATE of experience_id) leaves two pages to re-sync.
  FOR page_id IN
    SELECT DISTINCT id FROM (
      SELECT CASE WHEN TG_OP <> 'DELETE' THEN NEW.experience_id END AS id
      UNION ALL
      SELECT CASE WHEN TG_OP <> 'INSERT' THEN OLD.experience_id END
    ) ids
    WHERE id IS NOT NULL
  LOOP
    SELECT guide_id INTO primary_guide
    FROM public.experience_guides
    WHERE experience_id = page_id AND role = 'primary' AND status = 'active'
    LIMIT 1;

    -- Only when it differs: an UPDATE that changes nothing would still fire
    -- trg_experience_pages_updated_at and bump updated_at.
    UPDATE public.experience_pages
    SET guide_id = primary_guide
    WHERE id = page_id
      AND guide_id IS DISTINCT FROM primary_guide;
  END LOOP;

  PERFORM set_config('fa.experience_guides_sync', 'off', true);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_primary
  AFTER INSERT OR UPDATE OR DELETE ON public.experience_guides
  FOR EACH ROW EXECUTE FUNCTION public.sync_primary_guide_to_guide_id();

COMMENT ON FUNCTION public.sync_primary_guide_to_guide_id() IS
  'temporary until stage-4 CONTRACT (docs/proposals/2026-10-05-experience-offer-centric.md §7 step 4): the active primary of experience_guides -> experience_pages.guide_id (NULL when none).';
COMMENT ON TRIGGER trg_sync_primary ON public.experience_guides IS
  'temporary until stage-4 CONTRACT (docs/proposals/2026-10-05-experience-offer-centric.md §7 step 4)';

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. experience_pages.price_from  ->  price_from_cents
-- ═════════════════════════════════════════════════════════════════════════════
-- One direction only (as specified): the v2 admin writes price_from_cents and leaves the
-- old price_from alone. A writer that sets price_from_cents itself wins: on INSERT the
-- conversion runs only when cents were not supplied (price_from is NOT NULL DEFAULT 0, so
-- "price_from is set" cannot be told from "price_from defaulted"); on UPDATE only when
-- price_from_cents does not change in the same statement.
CREATE FUNCTION public.sync_price_from_to_cents()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.price_from_cents IS NULL THEN
      NEW.price_from_cents := round(NEW.price_from * 100)::bigint;
    END IF;
  ELSIF NEW.price_from IS DISTINCT FROM OLD.price_from
        AND NEW.price_from_cents IS NOT DISTINCT FROM OLD.price_from_cents THEN
    NEW.price_from_cents := round(NEW.price_from * 100)::bigint;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_price_from
  BEFORE INSERT OR UPDATE OF price_from ON public.experience_pages
  FOR EACH ROW EXECUTE FUNCTION public.sync_price_from_to_cents();

COMMENT ON FUNCTION public.sync_price_from_to_cents() IS
  'temporary until stage-4 CONTRACT (docs/proposals/2026-10-05-experience-offer-centric.md §7 step 4): price_from (numeric) -> price_from_cents = round(price_from * 100).';
COMMENT ON TRIGGER trg_sync_price_from ON public.experience_pages IS
  'temporary until stage-4 CONTRACT (docs/proposals/2026-10-05-experience-offer-centric.md §7 step 4)';
