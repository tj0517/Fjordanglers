-- FA-M.05 — guide requests replace the old assign / unassign (tj 2026-11-23, D1–D4).
--
--   create_guide_request            (CREATE OR REPLACE, same signature) D4 (a): an inquiry with no
--                                   trip country takes the guide's, in the same transaction;
--                                   guide.request_sent.payload.trip_country_set says which.
--   withdraw_guide_request          (CREATE OR REPLACE, same signature) D2 (a): withdrawing the
--                                   inquiry's latest request detaches its guide ("No guide");
--                                   guide.request_withdrawn.payload.detached says whether it did.
--   accept_guide_request_on_behalf  NEW, D1 (b): the admin records "accepted" for the guide. The
--                                   event's actor is the ADMIN (on_behalf_of_guide = true);
--                                   inquiries.guide_responded_at stays NULL. Metric rule (tj): a
--                                   guide response time counts only actor_kind = 'guide' answers.
--   unassign_guide_without_request  NEW, D3 (a): detach a guide attached without an open request
--                                   (assignments from before FA-M.03); emits guide.unassigned.
--
-- The applied 20261117000000 is not edited. CREATE OR REPLACE keeps the existing EXECUTE grants
-- (service_role only); the new functions get the same grants below. Every write emits its
-- inquiry_events row in the same transaction. Event types: src/lib/events/types.ts.

-- ─── create_guide_request (D4 a) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_guide_request(
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
  v_id            uuid;
  v_sent          timestamptz := now();
  v_expires       timestamptz := now() + interval '7 days';   -- D6: the link lives 7 days from sending
  v_trip_country  text;
  v_guide_country text;
  v_country_set   text;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'create_guide_request: admin id is required' USING ERRCODE = '22004';
  END IF;

  SELECT NULLIF(btrim(q.trip_country), '') INTO v_trip_country
    FROM public.inquiries q WHERE q.id = p_inquiry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inquiry_not_found' USING ERRCODE = 'P0002';
  END IF;
  SELECT NULLIF(btrim(g.country), '') INTO v_guide_country
    FROM public.guides g WHERE g.id = p_guide_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'guide_not_found' USING ERRCODE = 'P0002';
  END IF;
  -- FA-M.05 D4 (a): an inquiry with no trip country yet (e-mail / WhatsApp) takes the guide's —
  -- a guide works in one country. A country already on the inquiry is never overwritten.
  IF v_trip_country IS NULL THEN
    v_country_set := v_guide_country;
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
         guide_offer_eta      = NULL,
         trip_country         = COALESCE(v_country_set, q.trip_country)
   WHERE q.id = p_inquiry_id;

  INSERT INTO public.inquiry_events (inquiry_id, type, actor_kind, actor_id, source, channel, payload)
  VALUES (p_inquiry_id, 'guide.request_sent', 'admin', p_admin_id, 'app', p_channel,
          jsonb_build_object('request_id', v_id, 'guide_id', p_guide_id,
                             'channel', p_channel, 'expires_at', v_expires,
                             'trip_country_set', v_country_set));

  RETURN QUERY SELECT v_id, v_sent, v_expires;
END;
$$;

COMMENT ON FUNCTION public.create_guide_request(uuid, uuid, text, text, uuid) IS
  'FA-M.03: create a guide request (7-day link), set the inquiries summary, emit guide.request_sent. '
  'FA-M.05 D4: fills an empty inquiries.trip_country from the guide. service_role only.';

-- ─── withdraw_guide_request (D2 a) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.withdraw_guide_request(
  p_request_id uuid,
  p_admin_id   uuid
) RETURNS text
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_req      public.guide_requests%ROWTYPE;
  v_detached boolean;
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
  -- Same lock as create_guide_request: a request created concurrently is visible to the check below.
  PERFORM 1 FROM public.inquiries q WHERE q.id = v_req.inquiry_id FOR UPDATE;

  UPDATE public.guide_requests r
     SET withdrawn_at = now(), withdrawn_by = p_admin_id
   WHERE r.id = v_req.id;

  -- FA-M.05 D2 (a): withdrawing the inquiry's latest request also detaches its guide ("No guide").
  -- An older request (a later one exists, e.g. after a guide change) leaves the summary alone.
  UPDATE public.inquiries q
     SET assigned_guide_id    = NULL,
         assigned_at          = NULL,
         guide_acceptance     = NULL,
         guide_decline_reason = NULL,
         guide_responded_at   = NULL,
         guide_offer_eta      = NULL
   WHERE q.id = v_req.inquiry_id
     AND q.assigned_guide_id = v_req.guide_id
     AND NOT EXISTS (
       SELECT 1 FROM public.guide_requests o
        WHERE o.inquiry_id = v_req.inquiry_id
          AND o.id <> v_req.id
          AND (o.sent_at, o.id) > (v_req.sent_at, v_req.id));
  v_detached := FOUND;

  INSERT INTO public.inquiry_events (inquiry_id, type, actor_kind, actor_id, source, channel, payload)
  VALUES (v_req.inquiry_id, 'guide.request_withdrawn', 'admin', p_admin_id, 'app', 'app',
          jsonb_build_object('request_id', v_req.id, 'guide_id', v_req.guide_id,
                             'was_answered', v_req.answered_at IS NOT NULL,
                             'detached', v_detached));

  RETURN 'withdrawn';
END;
$$;

COMMENT ON FUNCTION public.withdraw_guide_request(uuid, uuid) IS
  'FA-M.03 (D5 b): withdraw a request — its link stops working — + guide.request_withdrawn. '
  'FA-M.05 D2: withdrawing the inquiry''s latest request detaches its guide. service_role only.';

-- ─── accept_guide_request_on_behalf (D1 b) ──────────────────────────────────
-- FA-M.05 D1 (b): the admin records "accepted" for the guide (trip agreed by phone / WhatsApp).
-- The event names the ADMIN as the actor — never the guide — and says so in the payload.
-- Refusals (fixed): not_found > guide_removed > withdrawn; expiry is not checked (the admin does
-- not use the link). Answered already: accepted → unchanged, anything else → already_answered.
CREATE FUNCTION public.accept_guide_request_on_behalf(
  p_request_id uuid,
  p_admin_id   uuid
) RETURNS TABLE (outcome text, summary_updated boolean)
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_req    public.guide_requests%ROWTYPE;
  v_reason text;
  v_at     timestamptz;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'accept_guide_request_on_behalf: admin id is required' USING ERRCODE = '22004';
  END IF;

  SELECT * INTO v_req FROM public.guide_requests r WHERE r.id = p_request_id FOR UPDATE;
  v_reason := public.guide_request_refusal(v_req, false);
  IF v_reason IS NOT NULL THEN
    RETURN QUERY SELECT v_reason, false;
    RETURN;
  END IF;
  IF v_req.answered_at IS NOT NULL THEN
    RETURN QUERY SELECT CASE WHEN v_req.answer = 'accepted' THEN 'unchanged' ELSE 'already_answered' END, false;
    RETURN;
  END IF;

  UPDATE public.guide_requests r
     SET answer = 'accepted', alt_dates = '{}', note = NULL, answered_at = now()
   WHERE r.id = v_req.id
  RETURNING r.answered_at INTO v_at;

  INSERT INTO public.inquiry_events (inquiry_id, type, actor_kind, actor_id, source, channel, payload)
  VALUES (v_req.inquiry_id, 'guide.request_answered', 'admin', p_admin_id, 'app', 'app',
          jsonb_build_object('request_id', v_req.id, 'guide_id', v_req.guide_id, 'answer', 'accepted',
                             'alt_dates', '[]'::jsonb, 'has_note', false, 'on_behalf_of_guide', true));

  -- Summary: same rule as guide_request_apply_answer (latest non-withdrawn request, summary still
  -- on this guide). guide_responded_at stays NULL — the guide did not respond; a response-time
  -- metric must not count the admin's click.
  UPDATE public.inquiries q
     SET guide_acceptance     = 'accepted',
         guide_decline_reason = NULL,
         guide_responded_at   = NULL
   WHERE q.id = v_req.inquiry_id
     AND q.assigned_guide_id = v_req.guide_id
     AND NOT EXISTS (
       SELECT 1 FROM public.guide_requests o
        WHERE o.inquiry_id = v_req.inquiry_id
          AND o.id <> v_req.id
          AND o.withdrawn_at IS NULL
          AND (o.sent_at, o.id) > (v_req.sent_at, v_req.id));

  RETURN QUERY SELECT 'answered'::text, FOUND;
END;
$$;

COMMENT ON FUNCTION public.accept_guide_request_on_behalf(uuid, uuid) IS
  'FA-M.05 D1 (b): admin records accepted for the guide; event actor = admin, on_behalf_of_guide; '
  'guide_responded_at stays NULL (response-time metrics count actor_kind guide only). service_role only.';

-- ─── unassign_guide_without_request (D3 a) ──────────────────────────────────
-- FA-M.05 D3 (a): detach a guide attached WITHOUT an open request — the assignments from before
-- FA-M.03 (43 on prod, 2026-11-23). A guide with an open (not withdrawn) request on the inquiry is
-- detached by withdrawing that request instead (withdraw_guide_request, D2 a).
-- outcome: unassigned | not_found | no_guide | has_open_request. Emits guide.unassigned (reserved
-- name in src/lib/events/types.ts, first emitter here).
CREATE FUNCTION public.unassign_guide_without_request(
  p_inquiry_id uuid,
  p_admin_id   uuid
) RETURNS text
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
AS $$
DECLARE
  v_guide uuid;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'unassign_guide_without_request: admin id is required' USING ERRCODE = '22004';
  END IF;

  SELECT q.assigned_guide_id INTO v_guide FROM public.inquiries q WHERE q.id = p_inquiry_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF v_guide IS NULL THEN
    RETURN 'no_guide';
  END IF;
  IF EXISTS (SELECT 1 FROM public.guide_requests r
              WHERE r.inquiry_id = p_inquiry_id AND r.guide_id = v_guide AND r.withdrawn_at IS NULL) THEN
    RETURN 'has_open_request';
  END IF;

  UPDATE public.inquiries q
     SET assigned_guide_id    = NULL,
         assigned_at          = NULL,
         guide_acceptance     = NULL,
         guide_decline_reason = NULL,
         guide_responded_at   = NULL,
         guide_offer_eta      = NULL
   WHERE q.id = p_inquiry_id;

  INSERT INTO public.inquiry_events (inquiry_id, type, actor_kind, actor_id, source, channel, payload)
  VALUES (p_inquiry_id, 'guide.unassigned', 'admin', p_admin_id, 'app', 'app',
          jsonb_build_object('guide_id', v_guide));

  RETURN 'unassigned';
END;
$$;


COMMENT ON FUNCTION public.unassign_guide_without_request(uuid, uuid) IS
  'FA-M.05 D3 (a): detach a guide attached without an open request + guide.unassigned. service_role only.';

-- ─── EXECUTE: service_role only ─────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.accept_guide_request_on_behalf(uuid, uuid)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unassign_guide_without_request(uuid, uuid)  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.accept_guide_request_on_behalf(uuid, uuid)  TO service_role;
GRANT  EXECUTE ON FUNCTION public.unassign_guide_without_request(uuid, uuid)  TO service_role;
