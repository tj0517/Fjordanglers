-- FA-1.50: EXPAND — offer-centric schema, next to the old one.
-- docs/proposals/2026-10-05-experience-offer-centric.md §2.1–2.8, §3, §7 step 1.
--
-- Fully additive: nothing is dropped, renamed or re-typed. experience_pages.guide_id,
-- price_from, the boat_* columns etc. keep working; the CONTRACT step (drop + rename to
-- `experiences`) is stage 4. Every table/column below is "live, transitional until stage 4".
--
-- Decisions this file implements (docs/04-open-questions.md):
--   O-31 price shown to the angler is guide price + fee_pct, computed — schema stores
--        guide_price_cents and fee_pct, never the total.
--   O-32 a per-guide override may be at most 115% of the page's base price.
--   O-33 variants are separate pages — experience_prices has no option_id.
-- experience_prices is NOT backfilled (tj, 2026-10-06): whether price_from is net of the
-- FA fee and per person or flat is unresolved; the admin enters prices in FA-1.56.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. New columns on existing tables (all NULL or with a DEFAULT — safe on a live table)
-- ═════════════════════════════════════════════════════════════════════════════

-- 1a. experience_pages (§2.2, §2.5, page_version from §7)
ALTER TABLE public.experience_pages
  ADD COLUMN offer_mode             text         NOT NULL DEFAULT 'fixed'
    CONSTRAINT experience_pages_offer_mode_check CHECK (offer_mode IN ('fixed', 'custom')),
  ADD COLUMN price_from_cents       bigint
    CONSTRAINT experience_pages_price_from_cents_check CHECK (price_from_cents IS NULL OR price_from_cents >= 0),
  ADD COLUMN price_to_cents         bigint
    CONSTRAINT experience_pages_price_to_cents_check CHECK (price_to_cents IS NULL OR price_to_cents >= 0),
  ADD COLUMN fee_pct                numeric(5,4) NOT NULL DEFAULT 0.20
    CONSTRAINT experience_pages_fee_pct_check CHECK (fee_pct >= 0 AND fee_pct < 1),
  ADD COLUMN max_anglers_per_guide  integer      NOT NULL DEFAULT 2
    CONSTRAINT experience_pages_max_anglers_check CHECK (max_anglers_per_guide >= 1),
  ADD COLUMN min_days               integer      NOT NULL DEFAULT 1
    CONSTRAINT experience_pages_min_days_check CHECK (min_days >= 1),
  ADD COLUMN max_days               integer,
  ADD COLUMN page_version           smallint     NOT NULL DEFAULT 1
    CONSTRAINT experience_pages_page_version_check CHECK (page_version IN (1, 2)),
  ADD COLUMN suited_for             text[]       NOT NULL DEFAULT '{}',
  ADD COLUMN not_suited_for         text[]       NOT NULL DEFAULT '{}',
  ADD COLUMN expectations_text      text,
  ADD COLUMN skill_level            smallint
    CONSTRAINT experience_pages_skill_level_check CHECK (skill_level BETWEEN 1 AND 5),
  ADD COLUMN walking_km_min         numeric(4,1),
  ADD COLUMN walking_km_max         numeric(4,1),
  ADD COLUMN day_schedule           jsonb        NOT NULL DEFAULT '[]',
  ADD COLUMN nearest_airport        text,
  ADD COLUMN suggested_lodging      jsonb        NOT NULL DEFAULT '[]',
  ADD COLUMN license_info           jsonb,
  ADD COLUMN tip_guidance_text      text,
  ADD COLUMN weather_policy_text    text,
  ADD COLUMN response_sla_hours     integer      NOT NULL DEFAULT 24,
  ADD COLUMN offer_eta_text         text;

ALTER TABLE public.experience_pages
  ADD CONSTRAINT experience_pages_max_days_check CHECK (max_days IS NULL OR max_days >= min_days);

COMMENT ON COLUMN public.experience_pages.offer_mode IS
  'fixed = fixed price + calculator (NZ, Patagonia, Sweden); custom = price range + archetypes, "plan your trip" (Iceland, Norway, Finland). Independent of price_type (the unit of the price).';
COMMENT ON COLUMN public.experience_pages.price_from_cents IS
  'Integer minor units in experience_pages.currency. Replaces price_from (numeric) — both live until stage 4. Whether it is net of the FA fee and per person or flat is open (FA-1.50 notes, check before FA-1.57).';
COMMENT ON COLUMN public.experience_pages.fee_pct IS
  'FA fee on top of the guide price (ADR-0001); the deposit equals the fee. Frozen into the offer when it is created, never read live afterwards.';
COMMENT ON COLUMN public.experience_pages.page_version IS
  '1 = current page template, 2 = offer-centric template (FA-1.52). Per-page switch for the pilot.';

-- 1b. experience_page_options (§2.4)
ALTER TABLE public.experience_page_options
  ADD COLUMN kind               text    NOT NULL DEFAULT 'variant'
    CONSTRAINT experience_page_options_kind_check CHECK (kind IN ('variant', 'archetype', 'addon')),
  ADD COLUMN price_from_cents   bigint
    CONSTRAINT experience_page_options_price_from_cents_check CHECK (price_from_cents IS NULL OR price_from_cents >= 0),
  ADD COLUMN price_to_cents     bigint
    CONSTRAINT experience_page_options_price_to_cents_check CHECK (price_to_cents IS NULL OR price_to_cents >= 0),
  ADD COLUMN currency           char(3)
    CONSTRAINT experience_page_options_currency_check CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  ADD COLUMN duration_days_min  integer,
  ADD COLUMN duration_days_max  integer,
  ADD COLUMN sample_itinerary   jsonb   NOT NULL DEFAULT '[]';

COMMENT ON COLUMN public.experience_page_options.kind IS
  'archetype = custom pages (a card with an indicative price); variant = fixed pages; addon = priced extras (heli access, extra day, single supplement).';
COMMENT ON COLUMN public.experience_page_options.price_from_cents IS
  'Integer minor units in experience_page_options.currency. Replaces price_from (numeric) until stage 4.';

-- 1c. guides (§2.6)
ALTER TABLE public.guides
  ADD COLUMN association         text,
  ADD COLUMN response_time_hours integer,
  ADD COLUMN gear_text           text;

-- 1d. reviews (§2.7) — no backfill
ALTER TABLE public.reviews
  ADD COLUMN experience_id uuid
    CONSTRAINT reviews_experience_id_fkey
    REFERENCES public.experience_pages(id) ON DELETE SET NULL;

CREATE INDEX reviews_experience_id_idx ON public.reviews (experience_id);

-- 1e. inquiries — shape of the brief is validated in code (packages/core), not in the DB
ALTER TABLE public.inquiries
  ADD COLUMN brief jsonb;

COMMENT ON COLUMN public.inquiries.brief IS
  'Answers of the 3-step inquiry form (dates_mode, days, anglers, skill_level, priority, fitness, budget, selected_option_id, ...). Shape is validated in code, not in the DB (docs/proposals/2026-10-05-experience-offer-centric.md §2).';

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. New tables
-- ═════════════════════════════════════════════════════════════════════════════

-- 2a. experience_prices (§2.3) — created before experience_guides: its override trigger reads it
CREATE TABLE public.experience_prices (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id     uuid        NOT NULL REFERENCES public.experience_pages(id) ON DELETE CASCADE,
  days              integer     NOT NULL CHECK (days >= 1),
  anglers           integer     NOT NULL CHECK (anglers >= 1),
  guide_price_cents bigint      NOT NULL CHECK (guide_price_cents > 0),
  currency          char(3)     NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  valid_from        date,
  valid_to          date,
  CONSTRAINT experience_prices_valid_range CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_to >= valid_from),
  -- NULLS NOT DISTINCT: without it two undated rows for the same (page, days, anglers)
  -- would both be allowed, because NULL <> NULL in a plain UNIQUE.
  CONSTRAINT experience_prices_unique_slot UNIQUE NULLS NOT DISTINCT (experience_id, days, anglers, valid_from)
);

COMMENT ON TABLE public.experience_prices IS
  'Price table of a fixed-mode offer page: guide price per (days, anglers), optionally per season (valid_from/valid_to). The angler-facing total is guide_price_cents × (1 + experience_pages.fee_pct), computed, never stored. No option_id: variants are separate pages (O-33). Empty until the admin enters prices (FA-1.56). Transitional until stage 4.';
COMMENT ON COLUMN public.experience_prices.guide_price_cents IS
  'Guide''s price in integer minor units of `currency`, excluding the FA fee.';

-- 2b. experience_guides (§2.1)
CREATE TABLE public.experience_guides (
  experience_id              uuid        NOT NULL REFERENCES public.experience_pages(id) ON DELETE CASCADE,
  guide_id                   uuid        NOT NULL REFERENCES public.guides(id) ON DELETE RESTRICT,
  role                       text        NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'backup')),
  status                     text        NOT NULL DEFAULT 'active'  CHECK (status IN ('active', 'paused')),
  show_on_page               boolean     NOT NULL DEFAULT true,
  sort_order                 integer     NOT NULL DEFAULT 0,
  guide_price_override_cents bigint      CHECK (guide_price_override_cents IS NULL OR guide_price_override_cents > 0),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (experience_id, guide_id)
);

-- At most one active primary guide per page.
CREATE UNIQUE INDEX experience_guides_one_primary
  ON public.experience_guides (experience_id)
  WHERE role = 'primary' AND status = 'active';

-- PK leads with experience_id; this serves "which pages does this guide run" and the
-- ON DELETE RESTRICT check on guides.
CREATE INDEX experience_guides_guide_id_idx ON public.experience_guides (guide_id);

COMMENT ON TABLE public.experience_guides IS
  'Guides who run an offer page (N:M). Replaces experience_pages.guide_id, which stays until stage 4 (FA-1.51 keeps the two in sync). The inquiry''s assigned guide is chosen from the active rows. guide_price_override_cents: NULL = price from experience_prices; otherwise at most 115% of that base price (O-32), checked when written.';
COMMENT ON COLUMN public.experience_guides.guide_price_override_cents IS
  'Integer minor units, in the currency of the page''s base price. Enforced by trigger experience_guides_check_override: <= 115% of the base price (days = 1, anglers = max_anglers_per_guide, valid today). Not re-checked when prices change (known gap, FA-1.56 shows a warning).';

-- Override rule (O-32). A CHECK cannot query another table, hence a trigger.
-- SECURITY INVOKER: it reads experience_pages / experience_prices as the writer. The only
-- writers are admins (the admin policy can read every price row) and service_role (bypasses
-- RLS), so no definer rights are needed.
-- Checked only when the override is written (INSERT, or UPDATE that changes the override or
-- the page) — an unrelated UPDATE (role, sort_order) must not start failing because prices
-- moved afterwards.
CREATE FUNCTION public.experience_guides_check_override()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  base_cents bigint;
BEGIN
  IF NEW.guide_price_override_cents IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.guide_price_override_cents IS NOT DISTINCT FROM OLD.guide_price_override_cents
     AND NEW.experience_id = OLD.experience_id THEN
    RETURN NEW;
  END IF;

  SELECT p.guide_price_cents INTO base_cents
  FROM public.experience_prices p
  JOIN public.experience_pages e ON e.id = p.experience_id
  WHERE p.experience_id = NEW.experience_id
    AND p.days = 1
    AND p.anglers = e.max_anglers_per_guide
    AND (p.valid_from IS NULL OR p.valid_from <= current_date)
    AND (p.valid_to   IS NULL OR p.valid_to   >= current_date)
  ORDER BY p.valid_from DESC NULLS LAST
  LIMIT 1;

  IF base_cents IS NULL THEN
    RAISE EXCEPTION 'guide_price_override_cents rejected: page % has no valid base price row (days = 1, anglers = max_anglers_per_guide) in experience_prices',
      NEW.experience_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Integer arithmetic: override <= 1.15 × base  <=>  override × 100 <= base × 115
  IF NEW.guide_price_override_cents * 100 > base_cents * 115 THEN
    RAISE EXCEPTION 'guide_price_override_cents % exceeds 115%% of the base price % (limit %)',
      NEW.guide_price_override_cents, base_cents, (base_cents * 115) / 100
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER experience_guides_check_override
  BEFORE INSERT OR UPDATE ON public.experience_guides
  FOR EACH ROW EXECUTE FUNCTION public.experience_guides_check_override();

-- 2c. experience_slug_aliases (§2.8)
CREATE TABLE public.experience_slug_aliases (
  slug          text PRIMARY KEY,
  experience_id uuid NOT NULL REFERENCES public.experience_pages(id) ON DELETE CASCADE
);

CREATE INDEX experience_slug_aliases_experience_id_idx ON public.experience_slug_aliases (experience_id);

COMMENT ON TABLE public.experience_slug_aliases IS
  'Old page slugs that 301 to the current page after two per-guide pages are merged into one. Slugs are unique globally (also against experience_pages.slug — enforced in the admin, FA-1.56). Transitional until stage 4.';

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. RLS — public reads rows whose page is active; only admins write
-- ═════════════════════════════════════════════════════════════════════════════
-- The baseline's ALTER DEFAULT PRIVILEGES hands anon AND authenticated every privilege on
-- a new public table (TRUNCATE included, which RLS does not cover). Revoke first, grant
-- back only what is needed — same pattern as 20261005000000_add_agent_knowledge.sql.
-- Deliberately NOT the policy of experience_page_options, which is open to everyone.

ALTER TABLE public.experience_prices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_guides       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_slug_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads prices of active pages" ON public.experience_prices
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.experience_pages e
    WHERE e.id = experience_prices.experience_id AND e.status = 'active'));

CREATE POLICY "Public reads guides of active pages" ON public.experience_guides
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.experience_pages e
    WHERE e.id = experience_guides.experience_id AND e.status = 'active'));

CREATE POLICY "Public reads aliases of active pages" ON public.experience_slug_aliases
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.experience_pages e
    WHERE e.id = experience_slug_aliases.experience_id AND e.status = 'active'));

-- FOR ALL: USING covers SELECT/UPDATE/DELETE (an admin also reads draft pages' rows),
-- WITH CHECK covers INSERT/UPDATE. Same admin test as the rest of the baseline.
CREATE POLICY "Admins manage experience_prices" ON public.experience_prices
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins manage experience_guides" ON public.experience_guides
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins manage experience_slug_aliases" ON public.experience_slug_aliases
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

REVOKE ALL ON TABLE public.experience_prices, public.experience_guides, public.experience_slug_aliases
  FROM anon, authenticated;

GRANT SELECT ON TABLE public.experience_prices, public.experience_guides, public.experience_slug_aliases
  TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.experience_prices, public.experience_guides, public.experience_slug_aliases
  TO authenticated;
GRANT ALL ON TABLE public.experience_prices, public.experience_guides, public.experience_slug_aliases
  TO service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Backfill — idempotent: safe to run twice, second run changes nothing
-- ═════════════════════════════════════════════════════════════════════════════
-- experience_prices is deliberately NOT filled (see header).
-- Statement order matters: offer_mode first, because option.kind depends on it.

-- BACKFILL-BEGIN
-- (1) every page's current guide becomes its primary guide
INSERT INTO public.experience_guides (experience_id, guide_id, role)
SELECT id, guide_id, 'primary'
FROM public.experience_pages
WHERE guide_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- (2) custom offers: Iceland, Norway, Finland (case-insensitive); everything else stays 'fixed'
UPDATE public.experience_pages
SET offer_mode = 'custom'
WHERE lower(btrim(country)) IN ('iceland', 'norway', 'finland')
  AND offer_mode <> 'custom';

-- (3) pages: numeric price -> integer minor units, currency unchanged
UPDATE public.experience_pages
SET price_from_cents = round(price_from * 100)::bigint
WHERE price_from_cents IS NULL;

-- (4) options: kind from the parent's mode, cents, currency copied from the parent page
UPDATE public.experience_page_options o
SET kind = 'archetype'
FROM public.experience_pages p
WHERE o.experience_page_id = p.id
  AND p.offer_mode = 'custom'
  AND o.kind = 'variant';

UPDATE public.experience_page_options
SET price_from_cents = round(price_from * 100)::bigint
WHERE price_from_cents IS NULL;

UPDATE public.experience_page_options o
SET currency = p.currency
FROM public.experience_pages p
WHERE o.experience_page_id = p.id
  AND o.currency IS NULL;
-- BACKFILL-END
