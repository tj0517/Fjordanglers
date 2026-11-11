-- FA-1.85 — editorial content of the country hubs in a table instead of code
--
-- Why: since FA-1.82 the copy of the six hubs (h1, intro, season, FAQ, meta) lives in
-- src/lib/destinations.ts, so every correction is a PR and a deploy. The founders must be able
-- to edit it in the admin panel (O-42 → (b), tj D2).
--
-- What: one row per hub. The code keeps only the skeleton (slug, region group, countries) and,
-- until FA-1.90, the article list. This migration only creates the table; the six rows are in
-- the next migration. Application code reads the table in the follow-up PR.
--
-- RLS: the browser keys (anon, authenticated) can read every row and nothing else — a hub row
-- has no internal column, every row is a public page. There is no write policy and the write
-- privileges are revoked: writes go through the service role after requireAdmin() (admin editor,
-- one audit_log row per save; tj decision 1, 2026-11-11 — same pattern as blog_posts).

-- ────────────────────────────────────────────────────────
-- 1. Table
-- ────────────────────────────────────────────────────────
CREATE TABLE public.destination_hubs (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),  -- audit_log.record_id is a uuid
  slug               TEXT        NOT NULL,
  h1                 TEXT        NOT NULL,
  intro              TEXT        NOT NULL,
  meta_title         TEXT        NOT NULL,
  meta_description   TEXT        NOT NULL,
  season_months      SMALLINT[]  NOT NULL DEFAULT '{}',
  peak_months        SMALLINT[]  NOT NULL DEFAULT '{}',
  season_note        TEXT,
  species            TEXT[]      NOT NULL DEFAULT '{}',
  faq                JSONB       NOT NULL DEFAULT '[]',
  hero_quote_text    TEXT,
  hero_quote_author  TEXT,
  hero_quote_country TEXT,
  proof_note         TEXT,
  contact_name       TEXT,
  contact_email      TEXT,
  contact_whatsapp   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT destination_hubs_slug_key UNIQUE (slug),
  -- The slug is the URL: lower-case words joined by single hyphens.
  CONSTRAINT destination_hubs_slug_format
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 60),
  CONSTRAINT destination_hubs_h1_length
    CHECK (btrim(h1) <> '' AND char_length(h1) <= 120),
  CONSTRAINT destination_hubs_intro_length
    CHECK (btrim(intro) <> '' AND char_length(intro) <= 1500),
  CONSTRAINT destination_hubs_meta_title_length
    CHECK (btrim(meta_title) <> '' AND char_length(meta_title) <= 60),
  -- 160, not the blog's 155: three live hub descriptions are 158–160 characters and the pages
  -- must not change (tj decision, 2026-11-11).
  CONSTRAINT destination_hubs_meta_description_length
    CHECK (btrim(meta_description) <> '' AND char_length(meta_description) <= 160),
  CONSTRAINT destination_hubs_season_note_length
    CHECK (season_note IS NULL OR (btrim(season_note) <> '' AND char_length(season_note) <= 600)),
  CONSTRAINT destination_hubs_proof_note_length
    CHECK (proof_note IS NULL OR (btrim(proof_note) <> '' AND char_length(proof_note) <= 60)),
  -- Months 1–12; the best weeks lie inside the season. A repeated month is refused by the
  -- action's zod schema (Postgres does not allow a subquery in a CHECK, and a repeat would
  -- change nothing on the page).
  CONSTRAINT destination_hubs_season_months_valid
    CHECK (season_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[] AND cardinality(season_months) <= 12),
  CONSTRAINT destination_hubs_peak_months_valid
    CHECK (peak_months <@ season_months AND cardinality(peak_months) <= 12),
  CONSTRAINT destination_hubs_species_count
    CHECK (cardinality(species) <= 20),
  -- Element shape (both halves non-blank, lengths) is checked by the action's zod schema and on read.
  CONSTRAINT destination_hubs_faq_shape
    CHECK (jsonb_typeof(faq) = 'array' AND jsonb_array_length(faq) <= 12),
  -- The quote and the contact are all-or-nothing. `IS NOT NULL` is load-bearing: a NULL operand
  -- makes the CHECK NULL, which passes — without it a half-filled quote would be accepted.
  CONSTRAINT destination_hubs_hero_quote_complete CHECK (
    (hero_quote_text IS NULL AND hero_quote_author IS NULL AND hero_quote_country IS NULL)
    OR (hero_quote_text    IS NOT NULL AND btrim(hero_quote_text)    <> ''
        AND hero_quote_author  IS NOT NULL AND btrim(hero_quote_author)  <> ''
        AND hero_quote_country IS NOT NULL AND btrim(hero_quote_country) <> '')
  ),
  CONSTRAINT destination_hubs_contact_complete CHECK (
    (contact_name IS NULL AND contact_email IS NULL AND contact_whatsapp IS NULL)
    OR (contact_name IS NOT NULL AND btrim(contact_name) <> ''
        AND contact_email    IS NOT NULL AND contact_email    ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        AND contact_whatsapp IS NOT NULL AND contact_whatsapp ~ '^[0-9]{6,15}$')
  )
);

COMMENT ON TABLE public.destination_hubs IS
  'Editorial content of the country hubs (FA-1.85): one row per hub, keyed by slug. The skeleton (slug, group, countries) and the article list stay in src/lib/destinations.ts. Public reads (RLS); writes only through the service role after requireAdmin().';
COMMENT ON COLUMN public.destination_hubs.slug IS
  'URL segment: /<slug>. Must match a hub in src/lib/destinations.ts; a new hub needs a code change and a migration.';
COMMENT ON COLUMN public.destination_hubs.h1 IS
  'The page H1, the ItemList name in JSON-LD and the label in "More destinations".';
COMMENT ON COLUMN public.destination_hubs.meta_title IS
  'The <title> before the " | FjordAnglers" suffix; at most 60 characters.';
COMMENT ON COLUMN public.destination_hubs.meta_description IS
  'Meta description and Open Graph / Twitter description; at most 160 characters (the blog limit is 155).';
COMMENT ON COLUMN public.destination_hubs.season_months IS
  'Month numbers (1–12) the season is open. Empty = no season section.';
COMMENT ON COLUMN public.destination_hubs.peak_months IS
  'Month numbers of the best weeks, a subset of season_months; drawn darker in the season bar.';
COMMENT ON COLUMN public.destination_hubs.season_note IS
  'One or two sentences under the season bar. NULL = none.';
COMMENT ON COLUMN public.destination_hubs.species IS
  'Species chips. Non-empty overrides the list derived from the hub''s offers; empty = derived.';
COMMENT ON COLUMN public.destination_hubs.faq IS
  'JSON array of {"question","answer"} in display order, at most 12. Rendered as text and as FAQPage JSON-LD.';
COMMENT ON COLUMN public.destination_hubs.hero_quote_text IS
  'Hero quote (with author and country, all three or none).';
COMMENT ON COLUMN public.destination_hubs.proof_note IS
  'Third part of the hero proof line, e.g. "gear included". NULL = the line ends after the price.';
COMMENT ON COLUMN public.destination_hubs.contact_whatsapp IS
  'International format, digits only (as wa.me takes it). Set together with contact_name and contact_email, or not at all.';
COMMENT ON COLUMN public.destination_hubs.updated_at IS
  'Set by trigger on every UPDATE.';

-- ────────────────────────────────────────────────────────
-- 2. updated_at
-- ────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER destination_hubs_set_updated_at
  BEFORE UPDATE ON public.destination_hubs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────
-- 3. RLS — public read, no write path for the browser keys
-- ────────────────────────────────────────────────────────
ALTER TABLE public.destination_hubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads destination hubs" ON public.destination_hubs
  FOR SELECT TO anon, authenticated
  USING (true);

-- The baseline's ALTER DEFAULT PRIVILEGES grants anon and authenticated ALL on every new
-- `public` table. With RLS on and no write policy they could not write anyway; the REVOKE
-- makes the write path closed even if someone adds a policy by mistake. service_role
-- bypasses RLS; the GRANT is what lets it read and write.
REVOKE ALL    ON TABLE public.destination_hubs FROM anon, authenticated;
GRANT  SELECT ON TABLE public.destination_hubs TO   anon, authenticated;
GRANT  ALL    ON TABLE public.destination_hubs TO   service_role;
