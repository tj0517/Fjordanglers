-- FA-1.93 — profiles.role is set by the server only.
--
-- Before this migration any signed-in user could become admin:
--   1. UPDATE own row   — policy "User updates own profile" has no column limit, no WITH CHECK,
--                         and `authenticated` holds GRANT ALL (baseline l. 3359-3373, 9585-9587).
--   2. INSERT own row   — policy "User inserts own profile" checks only `auth.uid() = id`; the 5
--                         auth.users that have no profiles row (prod, 2026-11-04) could use it.
--   3. sign-up trigger  — handle_new_user copied raw_user_meta_data ->> 'role' (baseline l. 264-280),
--                         and users can edit their own user_metadata.
-- (A fourth route, auth/callback writing the metadata role with the service client, is fixed in code.)
--
-- Mechanism: column-level privileges. `authenticated` keeps SELECT and may write only the columns
-- that are theirs to write; without a privilege on `role` the database refuses the statement
-- itself, whatever the policies say. `service_role` keeps ALL — signUp, linkGuideAccount and the
-- invite autolink grant roles through it. The policies are left untouched on purpose.

-- ── 1. grants ───────────────────────────────────────────────────────────────
-- Replaces baseline l. 9585-9586 (GRANT ALL ... TO anon / authenticated). Dropping DELETE and
-- TRUNCATE (and REFERENCES / TRIGGER / MAINTAIN) is deliberate: no policy allows DELETE, and
-- TRUNCATE is not subject to RLS at all. Other tables are a separate deferred row.

REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;

GRANT SELECT ON TABLE public.profiles TO anon, authenticated;

-- `role` is absent from both lists: a client-side INSERT gets the column default ('angler'),
-- a client-side UPDATE of `role` fails with 42501. created_at / updated_at are server-maintained
-- (default + update_profiles_updated_at trigger — a trigger needs no column privilege).
GRANT INSERT (id, full_name, avatar_url) ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name, avatar_url)     ON TABLE public.profiles TO authenticated;

-- ── 2. handle_new_user ──────────────────────────────────────────────────────
-- Always an `angler`; the role in account metadata is ignored. search_path is pinned (it is
-- SECURITY DEFINER), every name inside is schema-qualified. full_name from metadata stays: it is
-- display text, not authority.

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = ''
    AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'angler',
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- The baseline ACL gave EXECUTE to PUBLIC (=X), anon and authenticated — a trigger function has no
-- business being callable. A trigger fires without an EXECUTE check (it is checked at CREATE TRIGGER
-- only), so on_auth_user_created keeps working; the proof is in profiles-role.test.ts.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
