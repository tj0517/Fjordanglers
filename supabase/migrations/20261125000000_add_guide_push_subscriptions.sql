-- FA-M.12 — web push for guides: one row per phone / browser that turned push on.
-- Design approved by tj 2026-11-25 (docs/tasks/FA-M.12.md, "Notatki z realizacji", D1–D3).
--
-- Shape of the decisions:
--   * D1a (A): a subscription belongs to the LOGIN (user_id → auth.users ON DELETE CASCADE), not to
--     the guide listing. A push for a guide goes to every subscription of guides.user_id, so
--     unlinking or deleting the login silences its phones. Many devices per login.
--   * D1b (A): guides READ their own rows; every write is server-side — the action runs
--     requireGuide() and the zod host allowlist (src/lib/push/subscription.ts), then calls the
--     functions below with the service client. No INSERT / UPDATE / DELETE for anon / authenticated,
--     so nobody can store an address the server would send requests to without passing the allowlist.
--     endpoint is UNIQUE: the same device subscribing under another login moves to that login.
--   * D2 (A): turning push on / off (and the server removing a subscription the push service
--     reports gone, 404/410) writes one audit_log row in the same transaction. No endpoint and no
--     keys in any audit row — the user id and, on a move, the previous user id only.
--
-- The endpoint and the two keys are what a push service needs to deliver to one browser; they are
-- not passwords, but they are never logged, put in events, audit rows or error messages.
--
-- Access: RLS on; service_role full access; authenticated SELECT of own rows only; nothing for anon.
-- The functions run as the caller (SECURITY INVOKER, search_path '') and only service_role may
-- execute them.

-- ─── guide_push_subscriptions ──────────────────────────────────────────────
CREATE TABLE public.guide_push_subscriptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),   -- audit_log.record_id is a uuid
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text        NOT NULL,
  p256dh      text        NOT NULL,
  auth        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT guide_push_subscriptions_endpoint_key    UNIQUE (endpoint),
  -- The host allowlist lives in the app (one place to add a push service); the database still
  -- refuses anything that is not https or absurdly long.
  CONSTRAINT guide_push_subscriptions_endpoint_https  CHECK (endpoint ~ '^https://[^/?#@\s]+/'),
  CONSTRAINT guide_push_subscriptions_endpoint_length CHECK (char_length(endpoint) <= 2048),
  -- Browser keys, base64url: p256dh is a 65-byte P-256 point (87 chars), auth 16 bytes (22 chars).
  CONSTRAINT guide_push_subscriptions_p256dh_format   CHECK (p256dh ~ '^[A-Za-z0-9_-]{80,100}={0,2}$'),
  CONSTRAINT guide_push_subscriptions_auth_format     CHECK (auth   ~ '^[A-Za-z0-9_-]{16,32}={0,2}$')
);

CREATE INDEX guide_push_subscriptions_user_id_idx ON public.guide_push_subscriptions (user_id);

COMMENT ON TABLE public.guide_push_subscriptions IS
  'FA-M.12: web push subscriptions of guide logins (one per browser, many per login). Written only '
  'by save_push_subscription / delete_push_subscription / remove_gone_push_subscriptions, each with '
  'its audit_log row. A guide reads own rows; writes are server-only (tj D1b A).';
COMMENT ON COLUMN public.guide_push_subscriptions.user_id IS
  'The login that turned push on (tj D1a A). Pushes for a guide go to guides.user_id.';
COMMENT ON COLUMN public.guide_push_subscriptions.endpoint IS
  'Push service URL of one browser. https, host on the app allowlist. Never logged.';

CREATE TRIGGER guide_push_subscriptions_set_updated_at
  BEFORE UPDATE ON public.guide_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.guide_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on guide_push_subscriptions"
  ON public.guide_push_subscriptions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "guide_reads_own_push_subscriptions"
  ON public.guide_push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.guide_push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.guide_push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.guide_push_subscriptions TO service_role;

-- ─── save_push_subscription ────────────────────────────────────────────────
-- Stores the browser's subscription for p_user_id (a guide's login). A new endpoint inserts; the
-- same endpoint under another login moves to p_user_id; the same endpoint with new keys updates
-- them. One audit_log row when something changed, none for an identical repeat.
CREATE FUNCTION public.save_push_subscription(
  p_user_id  uuid,
  p_endpoint text,
  p_p256dh   text,
  p_auth     text
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_row public.guide_push_subscriptions%ROWTYPE;
  v_id  uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'save_push_subscription: user id is required' USING ERRCODE = '22004';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.guides g WHERE g.user_id = p_user_id) THEN
    RAISE EXCEPTION 'not_a_guide' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.guide_push_subscriptions s WHERE s.endpoint = p_endpoint FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.guide_push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (p_user_id, p_endpoint, p_p256dh, p_auth)
    RETURNING id INTO v_id;

    INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
    VALUES ('guide_push_subscriptions', 'SUBSCRIBE', v_id,
            jsonb_build_object('user_id', p_user_id), p_user_id);
    RETURN v_id;
  END IF;

  IF v_row.user_id = p_user_id AND v_row.p256dh = p_p256dh AND v_row.auth = p_auth THEN
    RETURN v_row.id;   -- identical repeat: nothing changed, no audit row
  END IF;

  UPDATE public.guide_push_subscriptions s
     SET user_id = p_user_id, p256dh = p_p256dh, auth = p_auth
   WHERE s.id = v_row.id;

  INSERT INTO public.audit_log (table_name, operation, record_id, old_data, new_data, changed_by)
  VALUES ('guide_push_subscriptions', 'SUBSCRIBE', v_row.id,
          jsonb_build_object('user_id', v_row.user_id),
          jsonb_build_object('user_id', p_user_id, 'moved', v_row.user_id <> p_user_id), p_user_id);
  RETURN v_row.id;
END;
$$;

COMMENT ON FUNCTION public.save_push_subscription(uuid, text, text, text) IS
  'FA-M.12: store / move / refresh a guide login''s push subscription, with an audit_log row. service_role only.';

-- ─── delete_push_subscription ──────────────────────────────────────────────
-- The guide turns push off on this browser. Deletes only p_user_id's own row; another login's
-- endpoint is left alone (returns false).
CREATE FUNCTION public.delete_push_subscription(
  p_user_id  uuid,
  p_endpoint text
) RETURNS boolean
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'delete_push_subscription: user id is required' USING ERRCODE = '22004';
  END IF;

  DELETE FROM public.guide_push_subscriptions s
   WHERE s.endpoint = p_endpoint AND s.user_id = p_user_id
  RETURNING s.id INTO v_id;
  IF v_id IS NULL THEN RETURN false; END IF;

  INSERT INTO public.audit_log (table_name, operation, record_id, old_data, changed_by)
  VALUES ('guide_push_subscriptions', 'UNSUBSCRIBE', v_id,
          jsonb_build_object('user_id', p_user_id), p_user_id);
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.delete_push_subscription(uuid, text) IS
  'FA-M.12: a guide login turns push off on one browser (own row only), with an audit_log row. service_role only.';

-- ─── remove_gone_push_subscriptions ────────────────────────────────────────
-- The server removes subscriptions the push service answered 404 / 410 for (the browser
-- unsubscribed or expired). One audit_log row per removed row; changed_by NULL (system).
CREATE FUNCTION public.remove_gone_push_subscriptions(
  p_ids uuid[]
) RETURNS integer
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH gone AS (
    DELETE FROM public.guide_push_subscriptions s
     WHERE s.id = ANY (COALESCE(p_ids, '{}'::uuid[]))
    RETURNING s.id, s.user_id
  ), logged AS (
    INSERT INTO public.audit_log (table_name, operation, record_id, old_data, new_data, changed_by)
    SELECT 'guide_push_subscriptions', 'EXPIRE', g.id,
           jsonb_build_object('user_id', g.user_id), jsonb_build_object('reason', 'push_service_gone'), NULL
      FROM gone g
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_count FROM logged;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.remove_gone_push_subscriptions(uuid[]) IS
  'FA-M.12: delete subscriptions the push service reported gone (404/410), one audit_log row each. service_role only.';

REVOKE EXECUTE ON FUNCTION public.save_push_subscription(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_push_subscription(uuid, text)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_gone_push_subscriptions(uuid[])         FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.save_push_subscription(uuid, text, text, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.delete_push_subscription(uuid, text)           TO service_role;
GRANT  EXECUTE ON FUNCTION public.remove_gone_push_subscriptions(uuid[])         TO service_role;
