-- FA-M.08 — guides maintain nothing: no signed-in session may UPDATE public.guides.
--
-- Until now `authenticated` held column-level UPDATE on 33 guides columns in production
-- (bio, full_name, country, cover_url, iban*, …). Together with the policy
-- "Guide updates own profile" (USING auth.uid() = user_id) that let a guide edit their public
-- listing straight through the REST API, whatever the app allows. The two listing fields a
-- guide still sets — terms_accepted_at and photo_marketing_consent — are written by server
-- actions (requireGuide() → service client, own row only): acceptGuideTerms and
-- setPhotoMarketingConsent in src/actions/dashboard.ts.
--
-- Scope (tj decision 2026-11-15): only UPDATE for `authenticated`. SELECT and INSERT grants
-- and all policies stay as they are.
--
-- Revoking the table-level privilege also revokes the matching column-level privileges on
-- every column (PostgreSQL REVOKE semantics), so this one statement clears all 33. It is a
-- no-op where the grants are already absent (a fresh local stack). The check below fails the
-- migration if any column-level UPDATE survived.

REVOKE UPDATE ON TABLE public.guides FROM authenticated;

DO $$
DECLARE
  v_left text;
BEGIN
  SELECT string_agg(a.attname, ', ' ORDER BY a.attname)
    INTO v_left
    FROM pg_attribute a
   WHERE a.attrelid = 'public.guides'::regclass
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE');

  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated still has UPDATE on public.guides columns: %', v_left;
  END IF;
END
$$;
