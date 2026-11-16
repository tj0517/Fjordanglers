-- FA-M.03 — guide_requests: every assignment sent to a guide is its own record (O-52 a), with a
-- signed link for a page without sign-in (FA-M.04), three timestamps (sent / first opened /
-- answered) and the answer (accept / decline / 1–3 other dates). The guide columns on
-- `inquiries` stay as a summary of the latest request. Design approved by tj 2026-11-16
-- (docs/tasks/FA-M.03.md, "Notatki z realizacji", D1–D7 + requirements 1–5).
--
-- Shape of the decisions:
--   * only the sha256 of the link token is stored (token_hash) — the plain token leaves the
--     server once, when the request is created;
--   * the link is valid 7 days from sending (D6 — the one constant is in create_guide_request);
--   * an answer is recorded once. The same answer again (same answer, same dates as a set, same
--     note) is a no-op success; anything else is refused and the stored answer is returned;
--   * refusal precedence, fixed: not_found > guide_removed > withdrawn > expired > already_answered;
--   * "other dates" must be strictly after today in the trip country's time zone; the server passes
--     the zone name (src/lib/countries.ts), the function computes "today" in it and rejects an
--     unknown zone;
--   * every write emits its inquiry_events row in the same transaction (D3 a). The event types are
--     listed in src/lib/events/types.ts; a test checks every type written here is in that catalogue;
--   * decline / other-dates note (D7 b) is stored as data; event payloads carry only has_note;
--   * the dashboard (respondToAssignment, D2 b) answers through the record too — not blocked by
--     expiry; an assignment from before this migration (no request) writes the summary as before
--     and emits guide.request_answered without request_id.
--
-- Access: RLS on, one policy for service_role, nothing for anon / authenticated. The functions
-- below are the only writers; they run as the caller (SECURITY INVOKER) and only service_role may
-- execute them, so the data layer calls them after requireAdmin() / requireGuide() or with a token.

-- ─── inquiries.guide_acceptance: other_dates (D4 a) ──────────────────────────
ALTER TABLE public.inquiries DROP CONSTRAINT inquiries_guide_acceptance_check;
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_guide_acceptance_check
  CHECK (guide_acceptance IN ('accepted', 'declined', 'other_dates'));

-- ─── guide_requests ─────────────────────────────────────────────────────────
CREATE TABLE public.guide_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id       uuid        NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  -- SET NULL keeps the history when a guide listing is deleted; the link then refuses (guide_removed).
  guide_id         uuid        REFERENCES public.guides(id) ON DELETE SET NULL,
  token_hash       text        NOT NULL,
  token_expires_at timestamptz NOT NULL,
  channel          text        NOT NULL,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  created_by       uuid        NOT NULL,
  first_opened_at  timestamptz,
  answered_at      timestamptz,
  answer           text,
  alt_dates        date[]      NOT NULL DEFAULT '{}',
  note             text,
  reminded_at      timestamptz,
  withdrawn_at     timestamptz,
  withdrawn_by     uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT guide_requests_token_hash_key     UNIQUE (token_hash),
  CONSTRAINT guide_requests_token_hash_format  CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT guide_requests_expiry_after_send  CHECK (token_expires_at > sent_at),
  CONSTRAINT guide_requests_channel_check      CHECK (channel IN ('whatsapp', 'email')),
  CONSTRAINT guide_requests_answer_check       CHECK (answer IN ('accepted', 'declined', 'other_dates')),
  CONSTRAINT guide_requests_answer_needs_time  CHECK ((answer IS NULL) = (answered_at IS NULL)),
  CONSTRAINT guide_requests_alt_dates_max_3    CHECK (cardinality(alt_dates) <= 3),
  CONSTRAINT guide_requests_alt_dates_no_null  CHECK (array_position(alt_dates, NULL) IS NULL),
  CONSTRAINT guide_requests_alt_dates_coherent CHECK (
    CASE WHEN answer = 'other_dates' THEN cardinality(alt_dates) BETWEEN 1 AND 3
         ELSE cardinality(alt_dates) = 0 END),
  CONSTRAINT guide_requests_note_length        CHECK (char_length(note) BETWEEN 1 AND 500),
  CONSTRAINT guide_requests_note_with_answer   CHECK (note IS NULL OR answer IN ('declined', 'other_dates')),
  CONSTRAINT guide_requests_withdrawer_needs_time CHECK ((withdrawn_at IS NULL) = (withdrawn_by IS NULL))
);

COMMENT ON TABLE public.guide_requests IS
  'One row per assignment sent to a guide (FA-M.03, O-52 a): signed link (sha256 only), sent / '
  'first opened / answered timestamps, answer. inquiries.assigned_guide_id / guide_acceptance / '
  'guide_decline_reason / guide_responded_at summarise the latest request. Written only by '
  'create_guide_request / open_guide_request / answer_guide_request / '
  'answer_guide_request_for_guide / withdraw_guide_request, each with its inquiry_events row.';
COMMENT ON COLUMN public.guide_requests.token_hash IS 'sha256 (hex) of the token in the request link; the token itself is never stored.';
COMMENT ON COLUMN public.guide_requests.channel    IS 'How FA sent the link to the guide.';
COMMENT ON COLUMN public.guide_requests.created_by IS 'Admin uid that created the request.';
COMMENT ON COLUMN public.guide_requests.alt_dates  IS 'Other dates the guide proposes (answer = other_dates): 1–3, distinct, sorted, after "today" in the trip country at answer time.';
COMMENT ON COLUMN public.guide_requests.note       IS 'Free text from the guide with declined / other_dates (≤500). Data only — never rendered as HTML, never copied into event payloads.';
COMMENT ON COLUMN public.guide_requests.reminded_at IS 'Set by the reminder (FA-M.06).';

CREATE INDEX guide_requests_inquiry_sent_idx ON public.guide_requests (inquiry_id, sent_at DESC);
CREATE INDEX guide_requests_guide_sent_idx   ON public.guide_requests (guide_id, sent_at DESC);

CREATE TRIGGER guide_requests_set_updated_at
  BEFORE UPDATE ON public.guide_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.guide_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on guide_requests"
  ON public.guide_requests
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.guide_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guide_requests TO service_role;

-- ─── guide_request_refusal ──────────────────────────────────────────────────
-- The one place the refusal precedence lives. p_req is the row read by token (all-NULL when not
-- found). Expiry is skipped for the signed-in dashboard (D2 b). Answered is not a refusal here:
-- reading an answered request is allowed; answering it again is decided in guide_request_apply_answer.
CREATE FUNCTION public.guide_request_refusal(
  p_req          public.guide_requests,
  p_check_expiry boolean
) RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_req.id IS NULL                                   THEN 'not_found'
    WHEN p_req.guide_id IS NULL                             THEN 'guide_removed'
    WHEN p_req.withdrawn_at IS NOT NULL                     THEN 'withdrawn'
    WHEN p_check_expiry AND p_req.token_expires_at <= now() THEN 'expired'
    ELSE NULL
  END
$$;

COMMENT ON FUNCTION public.guide_request_refusal(public.guide_requests, boolean) IS
  'FA-M.03: refusal precedence not_found > guide_removed > withdrawn > expired (NULL = usable). service_role only.';

-- ─── create_guide_request ───────────────────────────────────────────────────
-- New request + summary on inquiries (latest assignment) + guide.request_sent, one transaction.
CREATE FUNCTION public.create_guide_request(
  p_inquiry_id uuid,
  p_guide_id   uuid,
  p_channel    text,
  p_token_hash text,
  p_admin_id   uuid
) RETURNS TABLE (request_id uuid, sent_at timestamptz, token_expires_at timestamptz)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_id      uuid;
  v_sent    timestamptz := now();
  v_expires timestamptz := now() + interval '7 days';   -- D6: the link lives 7 days from sending
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'create_guide_request: admin id is required' USING ERRCODE = '22004';
  END IF;

  PERFORM 1 FROM public.inquiries q WHERE q.id = p_inquiry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inquiry_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM public.guides g WHERE g.id = p_guide_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'guide_not_found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.guide_requests (inquiry_id, guide_id, token_hash, token_expires_at, channel, sent_at, created_by)
  VALUES (p_inquiry_id, p_guide_id, p_token_hash, v_expires, p_channel, v_sent, p_admin_id)
  RETURNING id INTO v_id;

  UPDATE public.inquiries q
     SET assigned_guide_id    = p_guide_id,
         assigned_at          = v_sent,
         guide_acceptance     = NULL,
         guide_decline_reason = NULL,
         guide_responded_at   = NULL,
         guide_offer_eta      = NULL
   WHERE q.id = p_inquiry_id;

  INSERT INTO public.inquiry_events (inquiry_id, type, actor_kind, actor_id, source, channel, payload)
  VALUES (p_inquiry_id, 'guide.request_sent', 'admin', p_admin_id, 'app', p_channel,
          jsonb_build_object('request_id', v_id, 'guide_id', p_guide_id,
                             'channel', p_channel, 'expires_at', v_expires));

  RETURN QUERY SELECT v_id, v_sent, v_expires;
END;
$$;

COMMENT ON FUNCTION public.create_guide_request(uuid, uuid, text, text, uuid) IS
  'FA-M.03: create a guide request (7-day link), set the inquiries summary, emit guide.request_sent. service_role only.';

-- ─── find_guide_request ─────────────────────────────────────────────────────
-- Read by token, no side effects (the link page calls open_guide_request separately). On a refusal
-- only the outcome is returned — nothing about the request.
CREATE FUNCTION public.find_guide_request(p_token_hash text)
RETURNS TABLE (
  outcome          text,
  request_id       uuid,
  inquiry_id       uuid,
  guide_id         uuid,
  sent_at          timestamptz,
  token_expires_at timestamptz,
  first_opened_at  timestamptz,
  answered_at      timestamptz,
  answer           text,
  alt_dates        date[],
  note             text
)
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_req    public.guide_requests%ROWTYPE;
  v_reason text;
BEGIN
  SELECT * INTO v_req FROM public.guide_requests r WHERE r.token_hash = p_token_hash;
  v_reason := public.guide_request_refusal(v_req, true);
  IF v_reason IS NOT NULL THEN
    RETURN QUERY SELECT v_reason, NULL::uuid, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::timestamptz,
                        NULL::timestamptz, NULL::timestamptz, NULL::text, NULL::date[], NULL::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'ok'::text, v_req.id, v_req.inquiry_id, v_req.guide_id, v_req.sent_at, v_req.token_expires_at,
                      v_req.first_opened_at, v_req.answered_at, v_req.answer, v_req.alt_dates, v_req.note;
END;
$$;

COMMENT ON FUNCTION public.find_guide_request(text) IS
  'FA-M.03: the request behind a token hash, or the refusal reason only. No writes. service_role only.';

-- ─── open_guide_request ─────────────────────────────────────────────────────
-- Records the first opening of the link (only the first) + guide.request_opened.
CREATE FUNCTION public.open_guide_request(p_token_hash text)
RETURNS TABLE (outcome text, request_id uuid, first_open boolean)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_req    public.guide_requests%ROWTYPE;
  v_reason text;
BEGIN
  SELECT * INTO v_req FROM public.guide_requests r WHERE r.token_hash = p_token_hash FOR UPDATE;
  v_reason := public.guide_request_refusal(v_req, true);
  IF v_reason IS NOT NULL THEN
    RETURN QUERY SELECT v_reason, NULL::uuid, false;
    RETURN;
  END IF;

  IF v_req.first_opened_at IS NOT NULL THEN
    RETURN QUERY SELECT 'ok'::text, v_req.id, false;
    RETURN;
  END IF;

  UPDATE public.guide_requests r SET first_opened_at = now() WHERE r.id = v_req.id;

  INSERT INTO public.inquiry_events (inquiry_id, type, actor_kind, actor_id, source, channel, payload)
  VALUES (v_req.inquiry_id, 'guide.request_opened', 'guide', v_req.guide_id, 'app', 'app',
          jsonb_build_object('request_id', v_req.id, 'guide_id', v_req.guide_id));

  RETURN QUERY SELECT 'ok'::text, v_req.id, true;
END;
$$;

COMMENT ON FUNCTION public.open_guide_request(text) IS
  'FA-M.03: record the first opening of a request link + guide.request_opened (only the first). service_role only.';

-- ─── guide_request_apply_answer ─────────────────────────────────────────────
-- Shared by the link and the dashboard. The caller has locked p_req and passed the refusal check.
-- outcome: answered (written now) | unchanged (same answer again, nothing written) |
--          already_answered (different answer, refused) | date_not_in_future
-- Malformed input (unknown answer, >3 / duplicate / NULL dates, note where none is allowed, unknown
-- zone) raises: the server validates it with a schema before calling, so reaching here is a bug.
CREATE FUNCTION public.guide_request_apply_answer(
  p_req       public.guide_requests,
  p_answer    text,
  p_alt_dates date[],
  p_note      text,
  p_timezone  text
) RETURNS TABLE (
  outcome         text,
  request_id      uuid,
  answer          text,
  alt_dates       date[],
  note            text,
  answered_at     timestamptz,
  summary_updated boolean
)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_in_dates date[] := COALESCE(p_alt_dates, '{}');
  v_dates    date[];
  v_note     text   := NULLIF(btrim(p_note), '');
  v_today    date;
  v_at       timestamptz;
  v_synced   boolean;
BEGIN
  IF array_position(v_in_dates, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_answer: alt_dates contains NULL' USING ERRCODE = '22023';
  END IF;
  v_dates := ARRAY(SELECT DISTINCT d FROM unnest(v_in_dates) AS d ORDER BY d);

  -- Answered already: the same answer is a no-op, anything else is refused. Stored answer returned.
  IF p_req.answered_at IS NOT NULL THEN
    RETURN QUERY SELECT
      CASE WHEN p_req.answer = p_answer
            AND p_req.alt_dates = v_dates
            AND p_req.note IS NOT DISTINCT FROM v_note
           THEN 'unchanged' ELSE 'already_answered' END,
      p_req.id, p_req.answer, p_req.alt_dates, p_req.note, p_req.answered_at, false;
    RETURN;
  END IF;

  IF p_answer IS NULL OR p_answer NOT IN ('accepted', 'declined', 'other_dates') THEN
    RAISE EXCEPTION 'invalid_answer: unknown answer %', p_answer USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_dates) <> cardinality(v_in_dates) THEN
    RAISE EXCEPTION 'invalid_answer: duplicate alt_dates' USING ERRCODE = '22023';
  END IF;
  IF p_answer = 'other_dates' AND cardinality(v_dates) NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'invalid_answer: other_dates needs 1–3 dates, got %', cardinality(v_dates) USING ERRCODE = '22023';
  END IF;
  IF p_answer <> 'other_dates' AND cardinality(v_dates) <> 0 THEN
    RAISE EXCEPTION 'invalid_answer: alt_dates only with other_dates' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND p_answer = 'accepted' THEN
    RAISE EXCEPTION 'invalid_answer: no note with accepted' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'invalid_answer: note longer than 500 characters' USING ERRCODE = '22023';
  END IF;
  IF p_timezone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = p_timezone) THEN
    RAISE EXCEPTION 'invalid_timezone: %', p_timezone USING ERRCODE = '22023';
  END IF;

  v_today := (now() AT TIME ZONE p_timezone)::date;
  IF EXISTS (SELECT 1 FROM unnest(v_dates) AS d WHERE d <= v_today) THEN
    RETURN QUERY SELECT 'date_not_in_future'::text, p_req.id, NULL::text, NULL::date[], NULL::text,
                        NULL::timestamptz, false;
    RETURN;
  END IF;

  UPDATE public.guide_requests r
     SET answer = p_answer, alt_dates = v_dates, note = v_note, answered_at = now()
   WHERE r.id = p_req.id
  RETURNING r.answered_at INTO v_at;

  INSERT INTO public.inquiry_events (inquiry_id, type, actor_kind, actor_id, source, channel, payload)
  VALUES (p_req.inquiry_id, 'guide.request_answered', 'guide', p_req.guide_id, 'app', 'app',
          jsonb_build_object('request_id', p_req.id, 'guide_id', p_req.guide_id, 'answer', p_answer,
                             'alt_dates', to_jsonb(v_dates), 'has_note', v_note IS NOT NULL));

  -- Summary: only when this is the inquiry's latest request that is not withdrawn, and the summary
  -- still points at this guide (a later assignment outside the record must not be overwritten).
  UPDATE public.inquiries q
     SET guide_acceptance     = p_answer,
         guide_decline_reason = CASE WHEN p_answer = 'declined' THEN v_note END,
         guide_responded_at   = v_at
   WHERE q.id = p_req.inquiry_id
     AND q.assigned_guide_id = p_req.guide_id
     AND NOT EXISTS (
       SELECT 1 FROM public.guide_requests o
        WHERE o.inquiry_id = p_req.inquiry_id
          AND o.id <> p_req.id
          AND o.withdrawn_at IS NULL
          AND (o.sent_at, o.id) > (p_req.sent_at, p_req.id));
  v_synced := FOUND;

  RETURN QUERY SELECT 'answered'::text, p_req.id, p_answer, v_dates, v_note, v_at, v_synced;
END;
$$;

COMMENT ON FUNCTION public.guide_request_apply_answer(public.guide_requests, text, date[], text, text) IS
  'FA-M.03: record an answer once (idempotent replay = unchanged), emit guide.request_answered, sync the '
  'inquiries summary for the latest request. Called by answer_guide_request(_for_guide). service_role only.';

-- ─── answer_guide_request (the link) ────────────────────────────────────────
CREATE FUNCTION public.answer_guide_request(
  p_token_hash text,
  p_answer     text,
  p_alt_dates  date[],
  p_note       text,
  p_timezone   text
) RETURNS TABLE (
  outcome         text,
  request_id      uuid,
  answer          text,
  alt_dates       date[],
  note            text,
  answered_at     timestamptz,
  summary_updated boolean
)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_req    public.guide_requests%ROWTYPE;
  v_reason text;
BEGIN
  SELECT * INTO v_req FROM public.guide_requests r WHERE r.token_hash = p_token_hash FOR UPDATE;
  v_reason := public.guide_request_refusal(v_req, true);
  IF v_reason IS NOT NULL THEN
    RETURN QUERY SELECT v_reason, NULL::uuid, NULL::text, NULL::date[], NULL::text, NULL::timestamptz, false;
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.guide_request_apply_answer(v_req, p_answer, p_alt_dates, p_note, p_timezone);
END;
$$;

COMMENT ON FUNCTION public.answer_guide_request(text, text, date[], text, text) IS
  'FA-M.03: answer a request by its link token (refusals: not_found > guide_removed > withdrawn > expired > already_answered). service_role only.';

-- ─── answer_guide_request_for_guide (the signed-in dashboard, D2 b) ─────────
-- The guide's latest request on the inquiry; not blocked by expiry. No request (an assignment from
-- before FA-M.03): the summary is written as before and guide.request_answered has no request_id.
-- The caller has checked that the inquiry is assigned to this guide (requireGuide + ownership).
CREATE FUNCTION public.answer_guide_request_for_guide(
  p_inquiry_id uuid,
  p_guide_id   uuid,
  p_answer     text,
  p_note       text
) RETURNS TABLE (
  outcome         text,
  request_id      uuid,
  answer          text,
  alt_dates       date[],
  note            text,
  answered_at     timestamptz,
  summary_updated boolean
)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_req    public.guide_requests%ROWTYPE;
  v_reason text;
  v_note   text := NULLIF(btrim(p_note), '');
  v_at     timestamptz := now();
BEGIN
  IF p_answer IS NULL OR p_answer NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'invalid_answer: the dashboard answers accepted or declined, got %', p_answer USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_req FROM public.guide_requests r
   WHERE r.inquiry_id = p_inquiry_id AND r.guide_id = p_guide_id
   ORDER BY r.sent_at DESC, r.id DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    v_reason := public.guide_request_refusal(v_req, false);
    IF v_reason IS NOT NULL THEN
      RETURN QUERY SELECT v_reason, NULL::uuid, NULL::text, NULL::date[], NULL::text, NULL::timestamptz, false;
      RETURN;
    END IF;
    RETURN QUERY SELECT * FROM public.guide_request_apply_answer(v_req, p_answer, '{}'::date[], p_note, 'UTC');
    RETURN;
  END IF;

  -- Legacy assignment, no request record.
  IF v_note IS NOT NULL AND p_answer = 'accepted' THEN
    RAISE EXCEPTION 'invalid_answer: no note with accepted' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'invalid_answer: note longer than 500 characters' USING ERRCODE = '22023';
  END IF;

  UPDATE public.inquiries q
     SET guide_acceptance     = p_answer,
         guide_decline_reason = CASE WHEN p_answer = 'declined' THEN v_note END,
         guide_responded_at   = v_at
   WHERE q.id = p_inquiry_id AND q.assigned_guide_id = p_guide_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_assigned'::text, NULL::uuid, NULL::text, NULL::date[], NULL::text, NULL::timestamptz, false;
    RETURN;
  END IF;

  INSERT INTO public.inquiry_events (inquiry_id, type, actor_kind, actor_id, source, channel, payload)
  VALUES (p_inquiry_id, 'guide.request_answered', 'guide', p_guide_id, 'app', 'app',
          jsonb_build_object('guide_id', p_guide_id, 'answer', p_answer,
                             'alt_dates', '[]'::jsonb, 'has_note', v_note IS NOT NULL));

  RETURN QUERY SELECT 'answered'::text, NULL::uuid, p_answer, '{}'::date[], v_note, v_at, true;
END;
$$;

COMMENT ON FUNCTION public.answer_guide_request_for_guide(uuid, uuid, text, text) IS
  'FA-M.03 (D2 b): dashboard Accept/Decline through the record — latest request of this guide, no expiry check; '
  'legacy assignment without a request writes the summary + guide.request_answered without request_id. service_role only.';

-- ─── withdraw_guide_request (D5 b — called from FA-M.05) ────────────────────
-- outcome: withdrawn | not_found | already_withdrawn. The inquiries summary is not changed.
CREATE FUNCTION public.withdraw_guide_request(
  p_request_id uuid,
  p_admin_id   uuid
) RETURNS text
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_req public.guide_requests%ROWTYPE;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'withdraw_guide_request: admin id is required' USING ERRCODE = '22004';
  END IF;

  SELECT * INTO v_req FROM public.guide_requests r WHERE r.id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF v_req.withdrawn_at IS NOT NULL THEN
    RETURN 'already_withdrawn';
  END IF;

  UPDATE public.guide_requests r
     SET withdrawn_at = now(), withdrawn_by = p_admin_id
   WHERE r.id = v_req.id;

  INSERT INTO public.inquiry_events (inquiry_id, type, actor_kind, actor_id, source, channel, payload)
  VALUES (v_req.inquiry_id, 'guide.request_withdrawn', 'admin', p_admin_id, 'app', 'app',
          jsonb_build_object('request_id', v_req.id, 'guide_id', v_req.guide_id,
                             'was_answered', v_req.answered_at IS NOT NULL));

  RETURN 'withdrawn';
END;
$$;

COMMENT ON FUNCTION public.withdraw_guide_request(uuid, uuid) IS
  'FA-M.03 (D5 b): withdraw a request — its link stops working (withdrawn) — + guide.request_withdrawn. service_role only.';

-- ─── EXECUTE: service_role only ─────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.guide_request_refusal(public.guide_requests, boolean)                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_guide_request(uuid, uuid, text, text, uuid)                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_guide_request(text)                                                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.open_guide_request(text)                                                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guide_request_apply_answer(public.guide_requests, text, date[], text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.answer_guide_request(text, text, date[], text, text)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.answer_guide_request_for_guide(uuid, uuid, text, text)                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.withdraw_guide_request(uuid, uuid)                                      FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.guide_request_refusal(public.guide_requests, boolean)                   TO service_role;
GRANT  EXECUTE ON FUNCTION public.create_guide_request(uuid, uuid, text, text, uuid)                      TO service_role;
GRANT  EXECUTE ON FUNCTION public.find_guide_request(text)                                                TO service_role;
GRANT  EXECUTE ON FUNCTION public.open_guide_request(text)                                                TO service_role;
GRANT  EXECUTE ON FUNCTION public.guide_request_apply_answer(public.guide_requests, text, date[], text, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.answer_guide_request(text, text, date[], text, text)                    TO service_role;
GRANT  EXECUTE ON FUNCTION public.answer_guide_request_for_guide(uuid, uuid, text, text)                  TO service_role;
GRANT  EXECUTE ON FUNCTION public.withdraw_guide_request(uuid, uuid)                                      TO service_role;
