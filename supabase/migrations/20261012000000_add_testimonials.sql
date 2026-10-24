-- FA-1.68 — client testimonials: Trustpilot quotes and ones sent to us directly
--
-- Why: `reviews` needs an inquiry and a link token, so a Trustpilot review, or a quote a
-- client e-mailed us with their own photo, has nowhere to live. tj wants to add, order and
-- switch testimonials on in the admin panel without a deploy (D1 b, 2026-10-23).
--
-- What: one table of testimonials. The database guarantees two things the form also
-- checks, so neither can be skipped by a different caller:
--   * a Trustpilot testimonial links to its review on trustpilot.com (or a subdomain);
--   * a testimonial cannot be active without a recorded publication consent.
-- The banner (FA-1.69) shows one testimonial per page: the first active row by
-- `sort_order` whose `trip_country` is the page's country, else the first active general
-- row (O-46 a). Photos live in the existing `guide-photos` bucket under `testimonials/`
-- (O-47 a) — no storage change here.
--
-- RLS: enabled with no policy at all, like `reviews` after FA-1.59. `consent_note` is
-- internal, so the anon key must not read the table; the public page reads public columns
-- only, through the service role on the server. The admin writes through the service role
-- after requireAdmin().

-- ────────────────────────────────────────────────────────
-- 1. Table
-- ────────────────────────────────────────────────────────
CREATE TABLE public.testimonials (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote                TEXT        NOT NULL,
  author_name          TEXT        NOT NULL,
  author_country       TEXT,
  trip_country         TEXT,
  rating               SMALLINT,
  photo_url            TEXT,
  source               TEXT        NOT NULL,
  source_url           TEXT,
  consent_confirmed_at TIMESTAMPTZ,
  consent_note         TEXT,
  is_active            BOOLEAN     NOT NULL DEFAULT false,
  sort_order           INTEGER     NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT testimonials_quote_not_blank  CHECK (btrim(quote) <> ''),
  CONSTRAINT testimonials_quote_length     CHECK (char_length(quote) <= 1000),
  CONSTRAINT testimonials_author_name_not_blank CHECK (btrim(author_name) <> ''),
  CONSTRAINT testimonials_author_name_length    CHECK (char_length(author_name) <= 80),

  -- Where the client lives: ISO 3166-1 alpha-2, the code `inquiries.angler_country` holds.
  CONSTRAINT testimonials_author_country_check
    CHECK (author_country IS NULL OR author_country ~ '^[A-Z]{2}$'),

  -- Where the trip was: the destination name as `experience_pages.country` stores it, from
  -- COUNTRIES (src/lib/countries.ts). NULL = a general testimonial, shown on any page.
  -- src/lib/__tests__/agentKnowledgeCountries.test.ts asserts this list still matches.
  CONSTRAINT testimonials_trip_country_check
    CHECK (trip_country IS NULL OR trip_country IN (
      'Norway', 'Sweden', 'Finland', 'Iceland', 'Denmark',
      'Argentina', 'Chile', 'New Zealand'
    )),

  CONSTRAINT testimonials_rating_check CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),

  -- A list of sources is a CHECK, never an enum type (docs/03-conventions.md).
  CONSTRAINT testimonials_source_check CHECK (source IN ('trustpilot', 'direct')),

  -- Any link we print is https — never `javascript:` or another scheme.
  CONSTRAINT testimonials_source_url_https
    CHECK (source_url IS NULL OR source_url ~ '^https://'),

  -- A Trustpilot testimonial links to its review: https, host trustpilot.com or a
  -- subdomain (uk.trustpilot.com, www.trustpilot.com), nothing after the host but a path.
  -- `IS NOT NULL` is load-bearing: without it a NULL url makes the CHECK NULL, which passes.
  CONSTRAINT testimonials_trustpilot_needs_url
    CHECK (source <> 'trustpilot'
           OR (source_url IS NOT NULL
               AND source_url ~* '^https://([a-z0-9-]+\.)*trustpilot\.com(/|$)')),

  CONSTRAINT testimonials_consent_note_length
    CHECK (consent_note IS NULL OR char_length(consent_note) <= 1000),

  -- No consent recorded → the testimonial cannot be shown.
  CONSTRAINT testimonials_active_needs_consent
    CHECK (NOT is_active OR consent_confirmed_at IS NOT NULL)
);

COMMENT ON TABLE public.testimonials IS
  'Client testimonials for the site banner (FA-1.68/1.69): Trustpilot quotes and ones sent to FA directly. Edited in /admin/testimonials. No RLS policy: read only through the service role.';
COMMENT ON COLUMN public.testimonials.author_name IS
  'Display name as the client agreed to show it — usually the first name.';
COMMENT ON COLUMN public.testimonials.author_country IS
  'Where the client lives, ISO 3166-1 alpha-2 (as inquiries.angler_country). Optional.';
COMMENT ON COLUMN public.testimonials.trip_country IS
  'Destination of the trip, as experience_pages.country. NULL = general testimonial (shown on pages without a country match).';
COMMENT ON COLUMN public.testimonials.source_url IS
  'Link to the original review. Required, on trustpilot.com, when source = trustpilot.';
COMMENT ON COLUMN public.testimonials.consent_confirmed_at IS
  'When the admin confirmed the client agreed to publication of their name and photo. Required for is_active.';
COMMENT ON COLUMN public.testimonials.consent_note IS
  'INTERNAL — how and when consent was given. Never sent to a public page.';
COMMENT ON COLUMN public.testimonials.sort_order IS
  'Manual order set in the admin (O-46 a). Lower comes first; the banner takes the first match.';

-- ────────────────────────────────────────────────────────
-- 2. updated_at
-- ────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER testimonials_set_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────
-- 3. RLS — enabled, no policy (as `reviews` after FA-1.59)
-- ────────────────────────────────────────────────────────
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- The baseline's ALTER DEFAULT PRIVILEGES grants anon and authenticated ALL on every new
-- `public` table. With RLS on and no policy they would already read nothing; the REVOKE
-- makes the table unreachable for them even if someone adds a policy by mistake.
-- service_role bypasses RLS (rolbypassrls); the GRANT is what lets it read and write.
REVOKE ALL ON TABLE public.testimonials FROM anon, authenticated;
GRANT  ALL ON TABLE public.testimonials TO service_role;
