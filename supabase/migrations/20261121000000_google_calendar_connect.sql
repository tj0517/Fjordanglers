-- FA-M.10 — guide calendar, part 2: "Connect with Google". Design approved by tj 2026-11-18
-- (docs/tasks/FA-M.10.md, "Notatki z realizacji", STOP 1 and STOP 3).
--
-- Shape of the decisions:
--   * Scope `calendar.events.freebusy`; FA reads start, end, all-day and busy/free only. Busy days
--     follow the FA-M.09 rule (all-day = busy, timed "free" skipped) and land as source 'calendar'.
--   * The Google refresh token is a credential. It lives on the guide's connection row
--     (service_role only, like the Apple link) as ciphertext: the FA-M.09 envelope and
--     CALENDAR_LINK_KEY with its own purpose label, so an Apple link and a Google token cannot be
--     swapped for each other. The key never reaches this database.
--   * One calendar per guide (FA-M.09 D5): Google replaces Apple and vice versa.
--   * Google refusing the token (`invalid_grant`: consent revoked, token expired) → status
--     'disconnected', token cleared, calendar busy days KEPT until the guide disconnects; the cron
--     skips such rows.
--   * Disconnect (guide, server side) deletes the connection and the 'calendar' busy days; manual
--     blocks stay.
--   * OAuth `state`: a random value; only its sha256 is stored, valid 10 minutes, used once.
--   * audit_log rows in the same transaction (FA-M.09 D4): CONNECT, DISCONNECT, SYNC_DISCONNECTED
--     (plus FA-M.09's SYNC_FAILED / SYNC_RECOVERED). Payloads carry provider, host, counts and error
--     codes — never a token, code or calendar content.
--
-- Access: the new table has RLS on, one policy for service_role, nothing for anon / authenticated.
-- Every function is SECURITY INVOKER with search_path '' and only service_role may execute it.
-- FA-M.09's applied migration (20261120000000) is not edited; its constraints and two of its
-- functions are replaced here.

-- ─── guide_calendar_connections: Google ─────────────────────────────────────
ALTER TABLE public.guide_calendar_connections
  ALTER COLUMN link_ciphertext DROP NOT NULL,
  ADD COLUMN token_ciphertext text;

ALTER TABLE public.guide_calendar_connections
  DROP CONSTRAINT guide_calendar_connections_provider_check,
  DROP CONSTRAINT guide_calendar_connections_status_check,
  DROP CONSTRAINT guide_calendar_connections_error_check,
  DROP CONSTRAINT guide_calendar_connections_error_coherent;

ALTER TABLE public.guide_calendar_connections
  ADD CONSTRAINT guide_calendar_connections_provider_check CHECK (provider IN ('apple_ics', 'google')),
  ADD CONSTRAINT guide_calendar_connections_status_check   CHECK (status IN ('ok', 'error', 'disconnected')),
  ADD CONSTRAINT guide_calendar_connections_error_check    CHECK (last_error IN (
    'not_found', 'http_error', 'timeout', 'too_large', 'blocked_address',
    'too_many_redirects', 'not_a_calendar', 'decrypt_failed', 'network',
    'invalid_grant', 'insufficient_scope', 'bad_response')),
  ADD CONSTRAINT guide_calendar_connections_error_coherent
    CHECK ((status IN ('error', 'disconnected')) = (last_error IS NOT NULL)),
  -- Same envelope as link_ciphertext (src/lib/calendar/link-crypto.ts).
  ADD CONSTRAINT guide_calendar_connections_token_format
    CHECK (token_ciphertext ~ '^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
  -- Each provider carries its own secret and only that one; a disconnected Google row carries none.
  ADD CONSTRAINT guide_calendar_connections_secret_per_provider CHECK (
    (provider = 'apple_ics' AND link_ciphertext IS NOT NULL AND token_ciphertext IS NULL) OR
    (provider = 'google' AND link_ciphertext IS NULL
       AND (token_ciphertext IS NOT NULL) = (status <> 'disconnected'))),
  -- 'disconnected' means exactly one thing: Google refused the token.
  ADD CONSTRAINT guide_calendar_connections_disconnected_is_google_grant
    CHECK ((status = 'disconnected') = (provider = 'google' AND last_error = 'invalid_grant'));

COMMENT ON TABLE public.guide_calendar_connections IS
  'FA-M.09/FA-M.10: the calendar a guide shares with FA (one per guide — MVP, tj D5): an Apple share '
  'link or a Google account. FA reads busy/free only; event titles are never read or stored. Written '
  'only by connect_calendar_with_link / connect_google_calendar / record_calendar_sync / '
  'disconnect_calendar. service_role only.';
COMMENT ON COLUMN public.guide_calendar_connections.token_ciphertext IS
  'FA-M.10: the Google refresh token, AES-256-GCM encrypted by the app (key CALENDAR_LINK_KEY, purpose '
  'label of its own; never in the DB). NULL for Apple and for a Google row Google has disconnected. Secret.';
COMMENT ON COLUMN public.guide_calendar_connections.link_host IS
  'Host of the calendar link only — what the admin sees; ''calendar.google.com'' for Google (never the '
  'Google account). No part of any secret.';

-- ─── guide_calendar_oauth_states ────────────────────────────────────────────
CREATE TABLE public.guide_calendar_oauth_states (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash  text        NOT NULL,
  guide_id    uuid        NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  entry       text        NOT NULL,
  link_id     uuid        REFERENCES public.guide_calendar_connect_links(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,

  CONSTRAINT guide_calendar_oauth_states_state_hash_key    UNIQUE (state_hash),
  CONSTRAINT guide_calendar_oauth_states_state_hash_format CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT guide_calendar_oauth_states_entry_check       CHECK (entry IN ('link', 'session')),
  CONSTRAINT guide_calendar_oauth_states_link_iff_entry    CHECK ((entry = 'link') = (link_id IS NOT NULL)),
  CONSTRAINT guide_calendar_oauth_states_expiry_after_creation CHECK (expires_at > created_at)
);

COMMENT ON TABLE public.guide_calendar_oauth_states IS
  'FA-M.10: one row per "Connect with Google" start. Only the sha256 of the OAuth state is stored; valid '
  '10 minutes, used once by the callback. entry = where the guide started (signed link or own session). '
  'Written only by begin_google_calendar_connect / take_google_calendar_state. service_role only.';

CREATE INDEX guide_calendar_oauth_states_guide_idx
  ON public.guide_calendar_oauth_states (guide_id, created_at DESC);

ALTER TABLE public.guide_calendar_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on guide_calendar_oauth_states"
  ON public.guide_calendar_oauth_states
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.guide_calendar_oauth_states FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guide_calendar_oauth_states TO service_role;

-- ─── begin_google_calendar_connect ──────────────────────────────────────────
-- Exactly one of: p_link_token_hash (from the signed link — checked like FA-M.09) or p_guide_id
-- (from the guide's own session, after requireGuide()). Writes the state; nothing else changes, so no
-- audit row (opening the FA-M.09 page writes nothing either).
CREATE FUNCTION public.begin_google_calendar_connect(
  p_guide_id        uuid,
  p_link_token_hash text,
  p_state_hash      text
) RETURNS TABLE (refusal text, guide_id uuid)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_link    public.guide_calendar_connect_links;
  v_refusal text;
BEGIN
  IF (p_guide_id IS NULL) = (p_link_token_hash IS NULL) THEN
    RAISE EXCEPTION 'exactly one of guide id and link token hash' USING ERRCODE = '22023';
  END IF;

  IF p_link_token_hash IS NOT NULL THEN
    SELECT * INTO v_link FROM public.guide_calendar_connect_links l WHERE l.token_hash = p_link_token_hash;
    v_refusal := CASE
      WHEN v_link.id IS NULL             THEN 'not_found'
      WHEN v_link.revoked_at IS NOT NULL THEN 'revoked'
      WHEN v_link.used_at IS NOT NULL    THEN 'used'
      WHEN v_link.expires_at <= now()    THEN 'expired'
      ELSE NULL
    END;
    IF v_refusal IS NOT NULL THEN
      RETURN QUERY SELECT v_refusal, NULL::uuid;
      RETURN;
    END IF;
    INSERT INTO public.guide_calendar_oauth_states (state_hash, guide_id, entry, link_id, expires_at)
    VALUES (p_state_hash, v_link.guide_id, 'link', v_link.id, now() + interval '10 minutes');
    RETURN QUERY SELECT NULL::text, v_link.guide_id;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.guides g WHERE g.id = p_guide_id) THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid;
    RETURN;
  END IF;
  INSERT INTO public.guide_calendar_oauth_states (state_hash, guide_id, entry, link_id, expires_at)
  VALUES (p_state_hash, p_guide_id, 'session', NULL, now() + interval '10 minutes');
  RETURN QUERY SELECT NULL::text, p_guide_id;
END;
$$;

COMMENT ON FUNCTION public.begin_google_calendar_connect(uuid, text, text) IS
  'FA-M.10: start "Connect with Google" from a signed link or the guide''s session; stores the state hash (10 min). service_role only.';

-- ─── take_google_calendar_state ─────────────────────────────────────────────
-- The callback's first step: the state is used up here, whatever happens next. A wrong, used or
-- expired state is refused and nothing is written.
CREATE FUNCTION public.take_google_calendar_state(p_state_hash text)
  RETURNS TABLE (refusal text, guide_id uuid, entry text, link_id uuid)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_state public.guide_calendar_oauth_states;
BEGIN
  SELECT * INTO v_state
    FROM public.guide_calendar_oauth_states s
   WHERE s.state_hash = p_state_hash
   FOR UPDATE;

  IF v_state.id IS NULL THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::text, NULL::uuid; RETURN;
  END IF;
  IF v_state.used_at IS NOT NULL THEN
    RETURN QUERY SELECT 'used'::text, NULL::uuid, NULL::text, NULL::uuid; RETURN;
  END IF;
  IF v_state.expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::uuid, NULL::text, NULL::uuid; RETURN;
  END IF;

  UPDATE public.guide_calendar_oauth_states s SET used_at = now() WHERE s.id = v_state.id;
  RETURN QUERY SELECT NULL::text, v_state.guide_id, v_state.entry, v_state.link_id;
END;
$$;

COMMENT ON FUNCTION public.take_google_calendar_state(text) IS
  'FA-M.10: use an OAuth state once (not_found > used > expired; NULL = usable). service_role only.';

-- ─── connect_google_calendar ────────────────────────────────────────────────
-- Stores (or replaces — D5) the guide's calendar as Google, writes the busy days of the first read,
-- uses the signed link when the guide came from one, audit row — one transaction.
CREATE FUNCTION public.connect_google_calendar(
  p_guide_id   uuid,
  p_link_id    uuid,
  p_ciphertext text,
  p_dates      date[]
) RETURNS TABLE (refusal text, busy_days integer, previous_provider text)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_link     public.guide_calendar_connect_links;
  v_refusal  text;
  v_previous text;
  v_count    integer;
BEGIN
  IF p_link_id IS NOT NULL THEN
    SELECT * INTO v_link
      FROM public.guide_calendar_connect_links l
     WHERE l.id = p_link_id AND l.guide_id = p_guide_id
     FOR UPDATE;
    v_refusal := CASE
      WHEN v_link.id IS NULL             THEN 'not_found'
      WHEN v_link.revoked_at IS NOT NULL THEN 'revoked'
      WHEN v_link.used_at IS NOT NULL    THEN 'used'
      WHEN v_link.expires_at <= now()    THEN 'expired'
      ELSE NULL
    END;
    IF v_refusal IS NOT NULL THEN
      RETURN QUERY SELECT v_refusal, NULL::integer, NULL::text;
      RETURN;
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.guides g WHERE g.id = p_guide_id) THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::integer, NULL::text;
    RETURN;
  END IF;

  SELECT c.provider INTO v_previous
    FROM public.guide_calendar_connections c WHERE c.guide_id = p_guide_id FOR UPDATE;

  INSERT INTO public.guide_calendar_connections AS c
    (guide_id, provider, link_ciphertext, token_ciphertext, link_host, status, last_error, failure_count,
     connected_at, connected_via, last_attempt_at, last_synced_at)
  VALUES
    (p_guide_id, 'google', NULL, p_ciphertext, 'calendar.google.com', 'ok', NULL, 0,
     now(), p_link_id, now(), now())
  ON CONFLICT ON CONSTRAINT guide_calendar_connections_pkey DO UPDATE SET
    provider         = EXCLUDED.provider,
    link_ciphertext  = NULL,
    token_ciphertext = EXCLUDED.token_ciphertext,
    link_host        = EXCLUDED.link_host,
    status           = 'ok',
    last_error       = NULL,
    failure_count    = 0,
    connected_at     = EXCLUDED.connected_at,
    connected_via    = EXCLUDED.connected_via,
    last_attempt_at  = EXCLUDED.last_attempt_at,
    last_synced_at   = EXCLUDED.last_synced_at;

  v_count := public.replace_calendar_busy_days(p_guide_id, p_dates);

  IF p_link_id IS NOT NULL THEN
    UPDATE public.guide_calendar_connect_links l SET used_at = now() WHERE l.id = p_link_id;
  END IF;

  INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
  VALUES ('guide_calendar_connections', 'CONNECT', p_guide_id,
          jsonb_build_object('guide_id', p_guide_id, 'provider', 'google', 'host', 'calendar.google.com',
                             'entry', CASE WHEN p_link_id IS NULL THEN 'session' ELSE 'link' END,
                             'replaced', v_previous IS NOT NULL, 'previous_provider', v_previous,
                             'busy_days', v_count, 'link_id', p_link_id),
          NULL);

  RETURN QUERY SELECT NULL::text, v_count, v_previous;
END;
$$;

COMMENT ON FUNCTION public.connect_google_calendar(uuid, uuid, text, date[]) IS
  'FA-M.10: store/replace the guide''s calendar as Google (encrypted refresh token), write its busy days, use the signed link, audit_log row. service_role only.';

-- ─── disconnect_calendar ────────────────────────────────────────────────────
-- The guide disconnects (the app checked the session owns p_guide_id). Deletes the connection and
-- the 'calendar' busy days; manual blocks stay. No connection → nothing written, provider NULL.
CREATE FUNCTION public.disconnect_calendar(p_guide_id uuid, p_actor uuid)
  RETURNS TABLE (provider text, busy_days_removed integer)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_conn  public.guide_calendar_connections;
  v_count integer;
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'actor required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_conn
    FROM public.guide_calendar_connections c
   WHERE c.guide_id = p_guide_id
   FOR UPDATE;
  IF v_conn.guide_id IS NULL THEN
    RETURN QUERY SELECT NULL::text, 0;
    RETURN;
  END IF;

  DELETE FROM public.guide_unavailable_dates d WHERE d.guide_id = p_guide_id AND d.source = 'calendar';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  DELETE FROM public.guide_calendar_connections c WHERE c.guide_id = p_guide_id;

  INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
  VALUES ('guide_calendar_connections', 'DISCONNECT', p_guide_id,
          jsonb_build_object('guide_id', p_guide_id, 'provider', v_conn.provider, 'host', v_conn.link_host,
                             'status', v_conn.status, 'busy_days_removed', v_count),
          p_actor);

  RETURN QUERY SELECT v_conn.provider, v_count;
END;
$$;

COMMENT ON FUNCTION public.disconnect_calendar(uuid, uuid) IS
  'FA-M.10: the guide disconnects their calendar — connection and calendar busy days deleted, manual kept, audit_log row. service_role only.';

-- ─── connect_calendar_with_link (FA-M.09, replaced) ─────────────────────────
-- Change: Apple replacing Google clears the Google token (one secret per provider) and the audit row
-- names the provider it replaced. Everything else as in 20261120000000.
CREATE OR REPLACE FUNCTION public.connect_calendar_with_link(
  p_token_hash text,
  p_provider   text,
  p_ciphertext text,
  p_host       text,
  p_dates      date[]
) RETURNS TABLE (refusal text, guide_id uuid, busy_days integer)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_link     public.guide_calendar_connect_links;
  v_refusal  text;
  v_previous text;
  v_count    integer;
BEGIN
  SELECT * INTO v_link
    FROM public.guide_calendar_connect_links l
   WHERE l.token_hash = p_token_hash
   FOR UPDATE;

  v_refusal := CASE
    WHEN v_link.id IS NULL             THEN 'not_found'
    WHEN v_link.revoked_at IS NOT NULL THEN 'revoked'
    WHEN v_link.used_at IS NOT NULL    THEN 'used'
    WHEN v_link.expires_at <= now()    THEN 'expired'
    ELSE NULL
  END;
  IF v_refusal IS NOT NULL THEN
    RETURN QUERY SELECT v_refusal, NULL::uuid, NULL::integer;
    RETURN;
  END IF;

  SELECT c.provider INTO v_previous
    FROM public.guide_calendar_connections c WHERE c.guide_id = v_link.guide_id FOR UPDATE;

  INSERT INTO public.guide_calendar_connections AS c
    (guide_id, provider, link_ciphertext, link_host, status, last_error, failure_count,
     connected_at, connected_via, last_attempt_at, last_synced_at)
  VALUES
    (v_link.guide_id, p_provider, p_ciphertext, p_host, 'ok', NULL, 0,
     now(), v_link.id, now(), now())
  ON CONFLICT ON CONSTRAINT guide_calendar_connections_pkey DO UPDATE SET
    provider         = EXCLUDED.provider,
    link_ciphertext  = EXCLUDED.link_ciphertext,
    token_ciphertext = NULL,
    link_host        = EXCLUDED.link_host,
    status           = 'ok',
    last_error       = NULL,
    failure_count    = 0,
    connected_at     = EXCLUDED.connected_at,
    connected_via    = EXCLUDED.connected_via,
    last_attempt_at  = EXCLUDED.last_attempt_at,
    last_synced_at   = EXCLUDED.last_synced_at;

  v_count := public.replace_calendar_busy_days(v_link.guide_id, p_dates);

  UPDATE public.guide_calendar_connect_links l SET used_at = now() WHERE l.id = v_link.id;

  INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
  VALUES ('guide_calendar_connections', 'CONNECT', v_link.guide_id,
          jsonb_build_object('guide_id', v_link.guide_id, 'provider', p_provider, 'host', p_host,
                             'replaced', v_previous IS NOT NULL, 'previous_provider', v_previous,
                             'busy_days', v_count, 'link_id', v_link.id),
          NULL);

  RETURN QUERY SELECT NULL::text, v_link.guide_id, v_count;
END;
$$;

-- ─── record_calendar_sync (FA-M.09, replaced) ───────────────────────────────
-- Change: p_error 'invalid_grant' → status 'disconnected', token cleared, busy days kept, audit
-- SYNC_DISCONNECTED when the status flips; a disconnected row is never synced again (the cron skips
-- it; this is the guard). Everything else as in 20261120000000.
CREATE OR REPLACE FUNCTION public.record_calendar_sync(
  p_guide_id     uuid,
  p_connected_at timestamptz,
  p_dates        date[],
  p_error        text DEFAULT NULL
) RETURNS text
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_conn  public.guide_calendar_connections;
  v_count integer;
BEGIN
  SELECT * INTO v_conn
    FROM public.guide_calendar_connections c
   WHERE c.guide_id = p_guide_id
   FOR UPDATE;

  IF v_conn.guide_id IS NULL THEN RETURN 'no_connection'; END IF;
  IF v_conn.connected_at IS DISTINCT FROM p_connected_at THEN RETURN 'stale'; END IF;
  IF v_conn.status = 'disconnected' THEN RETURN 'disconnected'; END IF;

  IF p_error = 'invalid_grant' THEN
    UPDATE public.guide_calendar_connections c
       SET status = 'disconnected', last_error = 'invalid_grant', token_ciphertext = NULL,
           failure_count = c.failure_count + 1, last_attempt_at = now()
     WHERE c.guide_id = p_guide_id;

    INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
    VALUES ('guide_calendar_connections', 'SYNC_DISCONNECTED', p_guide_id,
            jsonb_build_object('guide_id', p_guide_id, 'provider', v_conn.provider,
                               'host', v_conn.link_host, 'error', p_error),
            NULL);
    RETURN 'disconnected';
  END IF;

  IF p_error IS NULL THEN
    v_count := public.replace_calendar_busy_days(p_guide_id, p_dates);

    UPDATE public.guide_calendar_connections c
       SET status = 'ok', last_error = NULL, failure_count = 0,
           last_attempt_at = now(), last_synced_at = now()
     WHERE c.guide_id = p_guide_id;

    IF v_conn.status = 'error' THEN
      INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
      VALUES ('guide_calendar_connections', 'SYNC_RECOVERED', p_guide_id,
              jsonb_build_object('guide_id', p_guide_id, 'provider', v_conn.provider,
                                 'host', v_conn.link_host, 'busy_days', v_count,
                                 'failures', v_conn.failure_count),
              NULL);
    END IF;
    RETURN 'ok';
  END IF;

  UPDATE public.guide_calendar_connections c
     SET status = 'error', last_error = p_error, failure_count = c.failure_count + 1,
         last_attempt_at = now()
   WHERE c.guide_id = p_guide_id;

  IF v_conn.status = 'ok' THEN
    INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
    VALUES ('guide_calendar_connections', 'SYNC_FAILED', p_guide_id,
            jsonb_build_object('guide_id', p_guide_id, 'provider', v_conn.provider,
                               'host', v_conn.link_host, 'error', p_error),
            NULL);
  END IF;
  RETURN 'failed';
END;
$$;

COMMENT ON FUNCTION public.record_calendar_sync(uuid, timestamptz, date[], text) IS
  'FA-M.09/FA-M.10: record one sync — success replaces calendar busy days; failure keeps them and sets the error; invalid_grant disconnects (token cleared, days kept). service_role only.';

-- ─── execute: service_role only ─────────────────────────────────────────────
-- CREATE OR REPLACE keeps the existing ACL of the two FA-M.09 functions; restated for clarity.
REVOKE ALL ON FUNCTION public.begin_google_calendar_connect(uuid, text, text)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.take_google_calendar_state(text)                                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.connect_google_calendar(uuid, uuid, text, date[])               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.disconnect_calendar(uuid, uuid)                                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.connect_calendar_with_link(text, text, text, text, date[])      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_calendar_sync(uuid, timestamptz, date[], text)           FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_google_calendar_connect(uuid, text, text)              TO service_role;
GRANT EXECUTE ON FUNCTION public.take_google_calendar_state(text)                             TO service_role;
GRANT EXECUTE ON FUNCTION public.connect_google_calendar(uuid, uuid, text, date[])            TO service_role;
GRANT EXECUTE ON FUNCTION public.disconnect_calendar(uuid, uuid)                              TO service_role;
GRANT EXECUTE ON FUNCTION public.connect_calendar_with_link(text, text, text, text, date[])   TO service_role;
GRANT EXECUTE ON FUNCTION public.record_calendar_sync(uuid, timestamptz, date[], text)        TO service_role;
