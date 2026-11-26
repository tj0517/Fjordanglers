-- FA-M.06 — the admin records a manual WhatsApp reminder to a guide who has not opened a request
-- (tj 2026-11-25 D1 a / D2 a; STOP 1 approved with changes 2026-11-26).
--
--   record_guide_request_reminder  NEW: sets guide_requests.reminded_at and emits
--                                  guide.request_reminded in the same transaction. FA sends
--                                  nothing: the admin sends the wa.me text from tj's phone.
--
-- When the flag shows (12 h in season / 24 h otherwise) is decided in the app at read time
-- (src/lib/guide-requests/reminder.ts); this function only guards the write: one reminder per
-- request, never for a request that is answered, opened, withdrawn, not on WhatsApp or expired.
--
-- Refusals (fixed order, no write): guide_request_refusal(p_req, false) → not_found > guide_removed
-- > withdrawn; then already_answered > already_opened > already_reminded > wrong_channel > expired.
-- expired is last, so an answered request whose link has expired still says already_answered.
--
-- The payload carries request_id and guide_id only — no token, link, phone number or message text.
-- Event types: src/lib/events/types.ts. Existing functions are not touched.

CREATE FUNCTION public.record_guide_request_reminder(
  p_request_id uuid,
  p_admin_id   uuid
) RETURNS TABLE (outcome text, reminded_at timestamptz)
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
    RAISE EXCEPTION 'record_guide_request_reminder: admin id is required' USING ERRCODE = '22004';
  END IF;

  -- The row lock serialises two clicks at the same moment: the second one reads reminded_at set.
  SELECT * INTO v_req FROM public.guide_requests r WHERE r.id = p_request_id FOR UPDATE;
  v_reason := public.guide_request_refusal(v_req, false);
  IF v_reason IS NOT NULL THEN
    RETURN QUERY SELECT v_reason, NULL::timestamptz;
    RETURN;
  END IF;
  v_reason := CASE
    WHEN v_req.answered_at     IS NOT NULL   THEN 'already_answered'
    WHEN v_req.first_opened_at IS NOT NULL   THEN 'already_opened'
    WHEN v_req.reminded_at     IS NOT NULL   THEN 'already_reminded'
    WHEN v_req.channel <> 'whatsapp'         THEN 'wrong_channel'
    WHEN v_req.token_expires_at <= now()     THEN 'expired'
    ELSE NULL
  END;
  IF v_reason IS NOT NULL THEN
    RETURN QUERY SELECT v_reason, v_req.reminded_at;
    RETURN;
  END IF;

  UPDATE public.guide_requests r
     SET reminded_at = now()
   WHERE r.id = v_req.id
     AND r.reminded_at IS NULL          -- second guard behind the lock
  RETURNING r.reminded_at INTO v_at;
  IF v_at IS NULL THEN
    RETURN QUERY SELECT 'already_reminded'::text, NULL::timestamptz;
    RETURN;
  END IF;

  INSERT INTO public.inquiry_events (inquiry_id, type, actor_kind, actor_id, source, channel, payload)
  VALUES (v_req.inquiry_id, 'guide.request_reminded', 'admin', p_admin_id, 'app', 'whatsapp',
          jsonb_build_object('request_id', v_req.id, 'guide_id', v_req.guide_id));

  RETURN QUERY SELECT 'reminded'::text, v_at;
END;
$$;

COMMENT ON FUNCTION public.record_guide_request_reminder(uuid, uuid) IS
  'FA-M.06: admin records the one manual WhatsApp reminder for a never-opened request — sets reminded_at '
  '+ guide.request_reminded (payload request_id, guide_id). Refuses not_found > guide_removed > withdrawn > '
  'already_answered > already_opened > already_reminded > wrong_channel > expired. service_role only.';

COMMENT ON COLUMN public.guide_requests.reminded_at IS
  'FA-M.06: when the admin recorded the manual WhatsApp reminder (record_guide_request_reminder). One per request.';

-- ─── EXECUTE: service_role only ─────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.record_guide_request_reminder(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.record_guide_request_reminder(uuid, uuid) TO service_role;
