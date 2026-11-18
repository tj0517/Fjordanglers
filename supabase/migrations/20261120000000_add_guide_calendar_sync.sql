-- FA-M.09 — guide calendar, part 1: busy-day sync from a calendar link (Apple share link),
-- "Connect with your calendar" page opened by a one-time signed link. Design approved by tj
-- 2026-11-17 (docs/tasks/FA-M.09.md, "Notatki z realizacji", D1–D6).
--
-- Shape of the decisions:
--   * D1 (b): the calendar link is a secret (whoever holds it reads the whole calendar). The app
--     encrypts it (AES-256-GCM, key in env) before it reaches this database; the column holds only
--     ciphertext. The admin sees the host only (link_host), never a character of the secret path.
--   * D2 (a): a busy day carries its source in the key — (guide_id, date, source). A day blocked by
--     hand and busy in the calendar is two rows; readers de-duplicate dates. A sync deletes only
--     source = 'calendar' rows. Existing rows become 'manual'.
--   * D4 (a): connect / link issued / link revoked / sync turned failing / sync recovered write an
--     audit_log row in the same transaction (FA-M.08 precedent: inquiry_events needs an inquiry).
--     Payloads never carry the link — provider, host, counts and an error code only.
--   * D5: the signed link is valid 7 days, used only by a successful connect (opening the page or a
--     bad paste does not use it), a new link revokes the guide's open one. One calendar per guide
--     (deliberate MVP choice): connecting again replaces it.
--   * D6 (b): guides read their own busy days; writes are server-only (all app writes already go
--     through the service client after requireGuide()).
--
-- Access: both new tables have RLS on, one policy for service_role, nothing for anon /
-- authenticated. The functions below are the only writers; they run as the caller
-- (SECURITY INVOKER, search_path '') and only service_role may execute them.

-- ─── guide_unavailable_dates: source in the key (D2 a) ──────────────────────
ALTER TABLE public.guide_unavailable_dates
  ADD COLUMN source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.guide_unavailable_dates
  ADD CONSTRAINT guide_unavailable_dates_source_check CHECK (source IN ('manual', 'calendar'));

ALTER TABLE public.guide_unavailable_dates DROP CONSTRAINT guide_available_dates_pkey;
ALTER TABLE public.guide_unavailable_dates
  ADD CONSTRAINT guide_unavailable_dates_pkey PRIMARY KEY (guide_id, date, source);

COMMENT ON COLUMN public.guide_unavailable_dates.source IS
  'FA-M.09: manual = blocked by the guide in the dashboard; calendar = busy in the connected '
  'calendar (written only by connect_calendar_with_link / record_calendar_sync). A day may have '
  'both rows; readers de-duplicate dates.';

-- D6 (b): guides read their own rows; no direct writes from anon / authenticated.
DROP POLICY "guide_manage_own_unavailable_dates" ON public.guide_unavailable_dates;

CREATE POLICY "guide_reads_own_unavailable_dates"
  ON public.guide_unavailable_dates
  FOR SELECT TO authenticated
  USING (guide_id = (SELECT guides.id FROM public.guides WHERE guides.user_id = auth.uid() LIMIT 1));

REVOKE ALL ON TABLE public.guide_unavailable_dates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.guide_unavailable_dates TO authenticated;
GRANT ALL ON TABLE public.guide_unavailable_dates TO service_role;

-- ─── guide_calendar_connect_links (signed "connect calendar" link) ──────────
CREATE TABLE public.guide_calendar_connect_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id    uuid        NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  token_hash  text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_by  uuid        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  used_at     timestamptz,
  revoked_at  timestamptz,

  CONSTRAINT guide_calendar_connect_links_token_hash_key    UNIQUE (token_hash),
  CONSTRAINT guide_calendar_connect_links_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT guide_calendar_connect_links_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT guide_calendar_connect_links_used_or_revoked   CHECK (used_at IS NULL OR revoked_at IS NULL)
);

COMMENT ON TABLE public.guide_calendar_connect_links IS
  'FA-M.09: one-time signed links to the "Connect with your calendar" page (no sign-in). Only the '
  'sha256 of the token is stored. Valid 7 days; used by a successful connect only. Written only by '
  'issue_calendar_connect_link / connect_calendar_with_link, each with its audit_log row.';
COMMENT ON COLUMN public.guide_calendar_connect_links.token_hash IS 'sha256 (hex) of the token in the link; the token itself is never stored.';
COMMENT ON COLUMN public.guide_calendar_connect_links.created_by IS 'Admin uid that issued the link.';

CREATE INDEX guide_calendar_connect_links_guide_idx
  ON public.guide_calendar_connect_links (guide_id, created_at DESC);

ALTER TABLE public.guide_calendar_connect_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on guide_calendar_connect_links"
  ON public.guide_calendar_connect_links
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.guide_calendar_connect_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guide_calendar_connect_links TO service_role;

-- ─── guide_calendar_connections (one per guide, D5) ─────────────────────────
CREATE TABLE public.guide_calendar_connections (
  guide_id         uuid        PRIMARY KEY REFERENCES public.guides(id) ON DELETE CASCADE,
  provider         text        NOT NULL,
  link_ciphertext  text        NOT NULL,
  link_host        text        NOT NULL,
  status           text        NOT NULL DEFAULT 'ok',
  last_error       text,
  failure_count    integer     NOT NULL DEFAULT 0,
  connected_at     timestamptz NOT NULL DEFAULT now(),
  connected_via    uuid        REFERENCES public.guide_calendar_connect_links(id) ON DELETE SET NULL,
  last_attempt_at  timestamptz,
  last_synced_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT guide_calendar_connections_provider_check CHECK (provider IN ('apple_ics')),
  -- Envelope written by src/lib/calendar/link-crypto.ts: v1:<iv>:<tag>:<ciphertext>, base64url.
  CONSTRAINT guide_calendar_connections_ciphertext_format
    CHECK (link_ciphertext ~ '^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
  -- A bare host name: no scheme, path, query, port or credentials can slip in here.
  CONSTRAINT guide_calendar_connections_host_format
    CHECK (link_host ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  CONSTRAINT guide_calendar_connections_status_check CHECK (status IN ('ok', 'error')),
  CONSTRAINT guide_calendar_connections_error_check  CHECK (last_error IN (
    'not_found', 'http_error', 'timeout', 'too_large', 'blocked_address',
    'too_many_redirects', 'not_a_calendar', 'decrypt_failed', 'network')),
  CONSTRAINT guide_calendar_connections_error_coherent CHECK ((status = 'error') = (last_error IS NOT NULL)),
  CONSTRAINT guide_calendar_connections_failures_nonneg CHECK (failure_count >= 0)
);

COMMENT ON TABLE public.guide_calendar_connections IS
  'FA-M.09: the calendar a guide shares with FA (one per guide — MVP, tj D5). FA reads busy/free '
  'only; event titles are never stored. Written only by connect_calendar_with_link / '
  'record_calendar_sync. service_role only.';
COMMENT ON COLUMN public.guide_calendar_connections.link_ciphertext IS
  'The calendar link, AES-256-GCM encrypted by the app (key CALENDAR_LINK_KEY, never in the DB). Secret.';
COMMENT ON COLUMN public.guide_calendar_connections.link_host IS
  'Host of the calendar link only — what the admin sees. No part of the secret path.';
COMMENT ON COLUMN public.guide_calendar_connections.last_synced_at IS 'Last successful sync.';
COMMENT ON COLUMN public.guide_calendar_connections.last_attempt_at IS 'Last sync attempt, successful or not.';

CREATE TRIGGER guide_calendar_connections_set_updated_at
  BEFORE UPDATE ON public.guide_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.guide_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on guide_calendar_connections"
  ON public.guide_calendar_connections
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.guide_calendar_connections FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guide_calendar_connections TO service_role;

-- ─── replace_calendar_busy_days (internal) ──────────────────────────────────
-- Replaces the guide's source = 'calendar' rows with p_dates. Never touches 'manual' rows.
CREATE FUNCTION public.replace_calendar_busy_days(p_guide_id uuid, p_dates date[])
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_dates IS NULL OR array_position(p_dates, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'busy days must be a list of dates without nulls' USING ERRCODE = '22023';
  END IF;
  IF cardinality(p_dates) > 400 THEN
    RAISE EXCEPTION 'too many busy days (% > 400)', cardinality(p_dates) USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.guide_unavailable_dates
   WHERE guide_id = p_guide_id AND source = 'calendar';

  INSERT INTO public.guide_unavailable_dates (guide_id, date, source)
  SELECT DISTINCT p_guide_id, d, 'calendar' FROM unnest(p_dates) AS d;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.replace_calendar_busy_days(uuid, date[]) IS
  'FA-M.09: replace a guide''s calendar-sourced busy days; manual rows untouched. service_role only.';

-- ─── issue_calendar_connect_link ────────────────────────────────────────────
-- Revokes the guide's open link(s) and issues a new one (7 days), with audit_log rows.
CREATE FUNCTION public.issue_calendar_connect_link(
  p_guide_id   uuid,
  p_token_hash text,
  p_admin_id   uuid
) RETURNS TABLE (link_id uuid, expires_at timestamptz)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_id      uuid;
  v_expires timestamptz := now() + interval '7 days';
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'admin id required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.guides g WHERE g.id = p_guide_id) THEN
    RAISE EXCEPTION 'guide not found' USING ERRCODE = 'P0002';
  END IF;

  WITH revoked AS (
    UPDATE public.guide_calendar_connect_links l
       SET revoked_at = now()
     WHERE l.guide_id = p_guide_id
       AND l.used_at IS NULL AND l.revoked_at IS NULL AND l.expires_at > now()
    RETURNING l.id, l.guide_id
  )
  INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
  SELECT 'guide_calendar_connect_links', 'REVOKE', r.id,
         jsonb_build_object('guide_id', r.guide_id, 'reason', 'replaced'), p_admin_id
    FROM revoked r;

  INSERT INTO public.guide_calendar_connect_links (guide_id, token_hash, expires_at, created_by)
  VALUES (p_guide_id, p_token_hash, v_expires, p_admin_id)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
  VALUES ('guide_calendar_connect_links', 'ISSUE', v_id,
          jsonb_build_object('guide_id', p_guide_id, 'expires_at', v_expires), p_admin_id);

  RETURN QUERY SELECT v_id, v_expires;
END;
$$;

COMMENT ON FUNCTION public.issue_calendar_connect_link(uuid, text, uuid) IS
  'FA-M.09: revoke the guide''s open connect link and issue a new one (7 days), with audit_log rows. service_role only.';

-- ─── calendar_connect_link_refusal ──────────────────────────────────────────
-- Why a link cannot be used (NULL = usable). Precedence: not_found > revoked > used > expired.
-- Returns nothing about the guide: a wrong link shows no data.
CREATE FUNCTION public.calendar_connect_link_refusal(p_token_hash text)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = ''
AS $$
  SELECT CASE
    WHEN l.id IS NULL              THEN 'not_found'
    WHEN l.revoked_at IS NOT NULL  THEN 'revoked'
    WHEN l.used_at IS NOT NULL     THEN 'used'
    WHEN l.expires_at <= now()     THEN 'expired'
    ELSE NULL
  END
  FROM (SELECT 1) AS one
  LEFT JOIN public.guide_calendar_connect_links l ON l.token_hash = p_token_hash
$$;

COMMENT ON FUNCTION public.calendar_connect_link_refusal(text) IS
  'FA-M.09: refusal for a connect link (not_found > revoked > used > expired; NULL = usable). service_role only.';

-- ─── connect_calendar_with_link ─────────────────────────────────────────────
-- Uses the link, stores (or replaces) the guide's connection, writes the busy days of the trial
-- fetch, audit row — one transaction. Refusal → nothing written, refusal returned.
CREATE FUNCTION public.connect_calendar_with_link(
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
  v_replaced boolean;
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

  v_replaced := EXISTS (SELECT 1 FROM public.guide_calendar_connections c WHERE c.guide_id = v_link.guide_id);

  INSERT INTO public.guide_calendar_connections AS c
    (guide_id, provider, link_ciphertext, link_host, status, last_error, failure_count,
     connected_at, connected_via, last_attempt_at, last_synced_at)
  VALUES
    (v_link.guide_id, p_provider, p_ciphertext, p_host, 'ok', NULL, 0,
     now(), v_link.id, now(), now())
  ON CONFLICT ON CONSTRAINT guide_calendar_connections_pkey DO UPDATE SET
    provider        = EXCLUDED.provider,
    link_ciphertext = EXCLUDED.link_ciphertext,
    link_host       = EXCLUDED.link_host,
    status          = 'ok',
    last_error      = NULL,
    failure_count   = 0,
    connected_at    = EXCLUDED.connected_at,
    connected_via   = EXCLUDED.connected_via,
    last_attempt_at = EXCLUDED.last_attempt_at,
    last_synced_at  = EXCLUDED.last_synced_at;

  v_count := public.replace_calendar_busy_days(v_link.guide_id, p_dates);

  UPDATE public.guide_calendar_connect_links l SET used_at = now() WHERE l.id = v_link.id;

  INSERT INTO public.audit_log (table_name, operation, record_id, new_data, changed_by)
  VALUES ('guide_calendar_connections', 'CONNECT', v_link.guide_id,
          jsonb_build_object('guide_id', v_link.guide_id, 'provider', p_provider, 'host', p_host,
                             'replaced', v_replaced, 'busy_days', v_count, 'link_id', v_link.id),
          NULL);

  RETURN QUERY SELECT NULL::text, v_link.guide_id, v_count;
END;
$$;

COMMENT ON FUNCTION public.connect_calendar_with_link(text, text, text, text, date[]) IS
  'FA-M.09: use a connect link, store/replace the guide''s calendar, write its busy days, audit_log row. service_role only.';

-- ─── record_calendar_sync ───────────────────────────────────────────────────
-- Result of one cron sync. Success (p_error NULL): replace calendar busy days, status ok.
-- Failure: status error + code, NOTHING deleted. audit_log only when the status flips.
-- p_connected_at is the connected_at the sync read before fetching: if the guide reconnected in
-- the meantime the result belongs to the old link and is dropped ('stale').
CREATE FUNCTION public.record_calendar_sync(
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
  'FA-M.09: record one sync — success replaces calendar busy days, failure keeps them and sets the error. service_role only.';

-- ─── execute: service_role only ─────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.replace_calendar_busy_days(uuid, date[])                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_calendar_connect_link(uuid, text, uuid)                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calendar_connect_link_refusal(text)                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.connect_calendar_with_link(text, text, text, text, date[])        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_calendar_sync(uuid, timestamptz, date[], text)             FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_calendar_busy_days(uuid, date[])                       TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_calendar_connect_link(uuid, text, uuid)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.calendar_connect_link_refusal(text)                            TO service_role;
GRANT EXECUTE ON FUNCTION public.connect_calendar_with_link(text, text, text, text, date[])     TO service_role;
GRANT EXECUTE ON FUNCTION public.record_calendar_sync(uuid, timestamptz, date[], text)          TO service_role;
