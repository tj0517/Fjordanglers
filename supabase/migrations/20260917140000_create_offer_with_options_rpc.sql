-- FA-1.12 — create_offer_with_options: atomic offer + options insert
--
-- markAsGuideOffer uses two separate PostgREST calls (separate implicit
-- transactions). The DEFERRABLE INITIALLY DEFERRED trigger on offers fires
-- at commit of the first call — before the options are inserted — and raises
-- P0001. This RPC wraps both inserts in one server-side transaction so the
-- deferred trigger fires only after the options rows exist.

CREATE OR REPLACE FUNCTION create_offer_with_options(
  p_inquiry_id        uuid,
  p_guide_id          uuid,
  p_source_message_id uuid,
  p_created_by        uuid,
  p_options           jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer_id uuid;
BEGIN
  INSERT INTO offers (inquiry_id, guide_id, source_message_id, status, created_by)
  VALUES (p_inquiry_id, p_guide_id, p_source_message_id, 'draft', p_created_by)
  RETURNING id INTO v_offer_id;

  INSERT INTO offer_options (
    offer_id, label, price_cents, currency,
    date_from, date_to, party_size, includes, notes
  )
  SELECT
    v_offer_id,
    opt->>'label',
    (opt->>'price_cents')::int,
    COALESCE(opt->>'currency', 'eur'),
    NULLIF(opt->>'date_from', '')::date,
    NULLIF(opt->>'date_to', '')::date,
    NULLIF(opt->>'party_size', '')::int,
    COALESCE((opt->>'includes')::jsonb, '[]'::jsonb),
    NULLIF(opt->>'notes', '')
  FROM jsonb_array_elements(p_options) AS opt;

  RETURN v_offer_id;
END;
$$;

COMMENT ON FUNCTION create_offer_with_options IS
  'Inserts an offer + its options in one transaction so the deferred constraint passes.';
