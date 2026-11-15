-- FA-M.08 — guide_invites: one-time, expiring invite links that bind an account to a
-- guides row on the server (docs/tasks/FA-M.08.md, design approved by tj 2026-11-14).
--
-- Why: the old invite was "register with the e-mail in guides.invite_email and you get
-- linked" — binding by e-mail match, with no proof that the person registering is the
-- guide (audit docs/audit/guide-accounts-audit-2026-11.md §5). The new invite is a link
-- with a random code. Whoever redeems it gets the account for the invite's e-mail, bound
-- to exactly one listing, once, within 7 days.
--
-- Shape of the decisions (FA-M.08 notes, D1–D8):
--   * only the sha256 of the code is stored (D3) — the plain code exists in the admin's
--     clipboard and in the link, never in the database;
--   * the account e-mail is set by the admin on the invite (D4);
--   * an existing account can redeem only if its e-mail equals the invite e-mail (D5);
--   * issue / revoke / redeem write their audit_log row in the same transaction (D7);
--   * guides.invite_email stays (stage 4 drops it) but no longer drives anything.
--
-- Access: RLS on, one policy for service_role, nothing for anon / authenticated (pattern of
-- guide_contacts, 20261004000000). The three functions below are the only writers; they run
-- as the caller (SECURITY INVOKER) and only service_role may execute them, so the server
-- actions call them after requireAdmin() (issue, revoke) or with the code (redeem).

CREATE TABLE public.guide_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id    uuid        NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  token_hash  text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_by  uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  redeemed_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at  timestamptz,
  revoked_by  uuid,

  CONSTRAINT guide_invites_token_hash_key    UNIQUE (token_hash),
  CONSTRAINT guide_invites_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT guide_invites_email_normalised  CHECK (email = lower(btrim(email)) AND position('@' IN email) > 1),
  CONSTRAINT guide_invites_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT guide_invites_redeemed_or_revoked   CHECK (redeemed_at IS NULL OR revoked_at IS NULL),
  -- redeemed_by may become NULL later (ON DELETE SET NULL) when the account is deleted;
  -- what must never happen is a redeemer without a redemption time.
  CONSTRAINT guide_invites_redeemer_needs_time   CHECK (redeemed_by IS NULL OR redeemed_at IS NOT NULL),
  CONSTRAINT guide_invites_revoker_needs_time    CHECK ((revoked_at IS NULL) = (revoked_by IS NULL))
);

COMMENT ON TABLE public.guide_invites IS
  'One-time, expiring invite links that bind an auth account to a guides row (FA-M.08). '
  'Only the sha256 of the code is stored. Written only by issue_guide_invite / '
  'revoke_guide_invite / redeem_guide_invite, each with its audit_log row.';
COMMENT ON COLUMN public.guide_invites.token_hash IS 'sha256 (hex) of the code in the invite link; the code itself is never stored.';
COMMENT ON COLUMN public.guide_invites.email      IS 'The e-mail the guide account is created with (set by the admin; lower-case, trimmed).';
COMMENT ON COLUMN public.guide_invites.created_by IS 'Admin uid that issued the invite.';

-- At most one open invite per listing. "Open" ignores expiry on purpose: an expired invite is
-- revoked (reason "replaced") when the admin issues a new one.
CREATE UNIQUE INDEX guide_invites_one_open_per_guide
  ON public.guide_invites (guide_id)
  WHERE redeemed_at IS NULL AND revoked_at IS NULL;

CREATE INDEX guide_invites_guide_created_idx ON public.guide_invites (guide_id, created_at DESC);

ALTER TABLE public.guide_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on guide_invites"
  ON public.guide_invites
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.guide_invites FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guide_invites TO service_role;

-- ─── issue_guide_invite ─────────────────────────────────────────────────────
-- Revokes the listing's open invite (if any) and creates a new one, valid 7 days (D2).
-- Refuses a listing that already has an account. Returns the new invite id.
CREATE FUNCTION public.issue_guide_invite(
  p_guide_id   uuid,
  p_email      text,
  p_token_hash text,
  p_admin_id   uuid
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_id      uuid;
  v_email   text := lower(btrim(p_email));
  v_expires timestamptz := now() + interval '7 days';
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'issue_guide_invite: admin id is required' USING ERRCODE = '22004';
  END IF;

  SELECT g.user_id INTO v_user_id FROM public.guides g WHERE g.id = p_guide_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'guide_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'guide_already_linked' USING ERRCODE = 'P0001';
  END IF;

  WITH revoked AS (
    UPDATE public.guide_invites i
       SET revoked_at = now(), revoked_by = p_admin_id
     WHERE i.guide_id = p_guide_id AND i.redeemed_at IS NULL AND i.revoked_at IS NULL
    RETURNING i.id, i.guide_id
  )
  INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
  SELECT 'guide_invites', 'REVOKE', r.id,
         jsonb_build_object('guide_id', r.guide_id, 'reason', 'replaced'), p_admin_id
    FROM revoked r;

  INSERT INTO public.guide_invites (guide_id, email, token_hash, expires_at, created_by)
  VALUES (p_guide_id, v_email, p_token_hash, v_expires, p_admin_id)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
  VALUES ('guide_invites', 'ISSUE', v_id,
          jsonb_build_object('guide_id', p_guide_id, 'email', v_email, 'expires_at', v_expires),
          p_admin_id);

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.issue_guide_invite(uuid, text, text, uuid) IS
  'FA-M.08: revoke the open invite of a listing and issue a new one (7 days), with audit_log rows. service_role only.';

-- ─── revoke_guide_invite ────────────────────────────────────────────────────
-- Revokes one open invite. Returns false when it was not open (already used / revoked).
CREATE FUNCTION public.revoke_guide_invite(
  p_invite_id uuid,
  p_admin_id  uuid
) RETURNS boolean
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_guide_id uuid;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'revoke_guide_invite: admin id is required' USING ERRCODE = '22004';
  END IF;

  UPDATE public.guide_invites i
     SET revoked_at = now(), revoked_by = p_admin_id
   WHERE i.id = p_invite_id AND i.redeemed_at IS NULL AND i.revoked_at IS NULL
  RETURNING i.guide_id INTO v_guide_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
  VALUES ('guide_invites', 'REVOKE', p_invite_id,
          jsonb_build_object('guide_id', v_guide_id, 'reason', 'admin'), p_admin_id);

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.revoke_guide_invite(uuid, uuid) IS
  'FA-M.08: revoke one open guide invite, with an audit_log row. service_role only.';

-- ─── redeem_guide_invite ────────────────────────────────────────────────────
-- The only place an account gets bound to a listing. In one transaction: lock the invite,
-- check it, then mark it used + guides.user_id + profiles.role = 'guide' + audit row.
-- A refusal on a known invite writes an audit row (REDEEM_REFUSED + reason) and returns the
-- reason instead of raising, so the row survives and the admin card can show why.
--
-- p_user_email is the e-mail of the account as read by the server from Supabase Auth
-- (never from client input); it must equal the invite e-mail (D5, condition 1).
--
-- outcome: redeemed | not_found | revoked | used | expired | email_mismatch
--          | account_is_admin | account_already_linked | guide_already_linked
CREATE FUNCTION public.redeem_guide_invite(
  p_token_hash text,
  p_user_id    uuid,
  p_user_email text
) RETURNS TABLE (outcome text, bound_guide_id uuid)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_inv        public.guide_invites%ROWTYPE;
  v_reason     text;
  v_role       text;
  v_guide_user uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'redeem_guide_invite: user id is required' USING ERRCODE = '22004';
  END IF;

  SELECT * INTO v_inv FROM public.guide_invites i WHERE i.token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT g.user_id INTO v_guide_user FROM public.guides g WHERE g.id = v_inv.guide_id FOR UPDATE;
  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = p_user_id;

  v_reason := CASE
    WHEN v_inv.revoked_at  IS NOT NULL THEN 'revoked'
    WHEN v_inv.redeemed_at IS NOT NULL THEN 'used'
    WHEN v_inv.expires_at <= now()     THEN 'expired'
    WHEN p_user_email IS NULL OR lower(btrim(p_user_email)) <> v_inv.email THEN 'email_mismatch'
    WHEN v_role = 'admin'              THEN 'account_is_admin'
    WHEN EXISTS (SELECT 1 FROM public.guides g WHERE g.user_id = p_user_id) THEN 'account_already_linked'
    WHEN v_guide_user IS NOT NULL      THEN 'guide_already_linked'
    ELSE NULL
  END;

  IF v_reason IS NOT NULL THEN
    INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
    VALUES ('guide_invites', 'REDEEM_REFUSED', v_inv.id,
            jsonb_build_object('guide_id', v_inv.guide_id, 'reason', v_reason), p_user_id);
    RETURN QUERY SELECT v_reason, NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.guide_invites i
     SET redeemed_at = now(), redeemed_by = p_user_id
   WHERE i.id = v_inv.id;

  UPDATE public.guides g
     SET user_id = p_user_id, is_beta_listing = false
   WHERE g.id = v_inv.guide_id;

  INSERT INTO public.profiles (id, role)
  VALUES (p_user_id, 'guide')
  ON CONFLICT (id) DO UPDATE SET role = 'guide';

  INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
  VALUES ('guide_invites', 'REDEEM', v_inv.id,
          jsonb_build_object('guide_id', v_inv.guide_id), p_user_id);

  RETURN QUERY SELECT 'redeemed'::text, v_inv.guide_id;
END;
$$;

COMMENT ON FUNCTION public.redeem_guide_invite(text, uuid, text) IS
  'FA-M.08: redeem a guide invite — bind guides.user_id and set profiles.role=guide in one '
  'transaction, or record why it was refused. service_role only.';

REVOKE EXECUTE ON FUNCTION public.issue_guide_invite(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_guide_invite(uuid, uuid)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_guide_invite(text, uuid, text)     FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.issue_guide_invite(uuid, text, text, uuid) TO service_role;
GRANT  EXECUTE ON FUNCTION public.revoke_guide_invite(uuid, uuid)           TO service_role;
GRANT  EXECUTE ON FUNCTION public.redeem_guide_invite(text, uuid, text)     TO service_role;
