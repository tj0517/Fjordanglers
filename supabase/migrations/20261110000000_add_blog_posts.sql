-- FA-1.83 — blog posts in a table instead of code
--
-- Why: today an article is an entry in src/lib/blog-data.ts plus a JSX component, and
-- publishing means a PR and a deploy; 5 of 6 entries are empty `noindex` stubs. The
-- founders write in Notion and must be able to publish without a developer (D4, O-49 a).
--
-- What: one table of posts. The page builds its <title>, description, dates and Open
-- Graph image from a row; the blog list and the sitemap read published rows only. The
-- database guarantees what the SEO audit asks of a published post (SEO title ≤ 60,
-- description ≤ 155, body, image with alt text, a publication date) so no caller can
-- publish an incomplete row. A draft may be half-empty.
--
-- RLS: the browser keys (anon, authenticated) can read published rows and nothing else.
-- There is no write policy and the write privileges are revoked: writes go through the
-- service role after requireAdmin() (admin editor: FA-1.84; tj decision C1, 2026-11-10).
-- Unlike `testimonials` there is no internal column, so a public read policy is safe.

-- ────────────────────────────────────────────────────────
-- 1. Table
-- ────────────────────────────────────────────────────────
CREATE TABLE public.blog_posts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  seo_title    TEXT,
  description  TEXT,
  body_md      TEXT        NOT NULL DEFAULT '',
  image_url    TEXT,
  image_alt    TEXT,
  category     TEXT        NOT NULL DEFAULT 'Planning',
  country      TEXT,
  guide_id     UUID        REFERENCES public.guides(id) ON DELETE SET NULL,
  status       TEXT        NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT blog_posts_slug_key UNIQUE (slug),
  -- The slug is the URL: lower-case words joined by single hyphens.
  CONSTRAINT blog_posts_slug_format
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 100),
  CONSTRAINT blog_posts_title_not_blank
    CHECK (btrim(title) <> '' AND char_length(title) <= 200),
  CONSTRAINT blog_posts_seo_title_length
    CHECK (seo_title IS NULL OR char_length(seo_title) <= 60),
  CONSTRAINT blog_posts_description_length
    CHECK (description IS NULL OR char_length(description) <= 155),
  CONSTRAINT blog_posts_body_length CHECK (char_length(body_md) <= 200000),
  -- A site path ('/fish_catalog/x.png') or an https URL — never `javascript:`, `data:` or
  -- a protocol-relative '//host'.
  CONSTRAINT blog_posts_image_url_shape
    CHECK (image_url IS NULL OR image_url ~ '^(/[^/]|https://)'),
  -- Free text for now; a closed list comes with the admin editor (tj decision C3).
  CONSTRAINT blog_posts_category_length
    CHECK (btrim(category) <> '' AND char_length(category) <= 40),
  -- Same list as testimonials.trip_country / COUNTRIES (src/lib/countries.ts).
  -- NULL = a general article. A new location needs a migration.
  CONSTRAINT blog_posts_country_check
    CHECK (country IS NULL OR country IN (
      'Norway', 'Sweden', 'Finland', 'Iceland', 'Denmark',
      'Argentina', 'Chile', 'New Zealand'
    )),
  -- A list of states is a CHECK, never an enum type (docs/03-conventions.md).
  CONSTRAINT blog_posts_status_check CHECK (status IN ('draft', 'published')),

  -- A published post is complete. `IS NOT NULL` is load-bearing: a NULL operand makes the
  -- CHECK NULL, which passes.
  CONSTRAINT blog_posts_published_complete
    CHECK (status <> 'published' OR (
          published_at IS NOT NULL
      AND seo_title   IS NOT NULL AND btrim(seo_title)   <> ''
      AND description IS NOT NULL AND btrim(description) <> ''
      AND btrim(body_md) <> ''
      AND image_url   IS NOT NULL
      AND image_alt   IS NOT NULL AND btrim(image_alt)   <> ''
    ))
);

COMMENT ON TABLE public.blog_posts IS
  'Blog articles (FA-1.83). Public reads published rows only (RLS); writes only through the service role after requireAdmin() — admin editor is FA-1.84.';
COMMENT ON COLUMN public.blog_posts.slug IS
  'URL segment: /blog/<slug>. Lower-case words joined by hyphens. Never changed after publication (indexed URL).';
COMMENT ON COLUMN public.blog_posts.title IS
  'The article H1 and list title. May be longer than seo_title.';
COMMENT ON COLUMN public.blog_posts.seo_title IS
  'The <title> tag, at most 60 characters. Required when published.';
COMMENT ON COLUMN public.blog_posts.description IS
  'Meta description and list excerpt, at most 155 characters. Required when published.';
COMMENT ON COLUMN public.blog_posts.body_md IS
  'Markdown (GFM tables) plus the named blocks :::warning, :::info, :::stat, :::photo. Rendered to React components — never as raw HTML. Read time is computed from it, not stored.';
COMMENT ON COLUMN public.blog_posts.image_url IS
  'Hero and Open Graph image: a site path or an https URL. Required when published.';
COMMENT ON COLUMN public.blog_posts.image_alt IS
  'Alt text for image_url. Required when published.';
COMMENT ON COLUMN public.blog_posts.category IS
  'Free-text label shown on the list card (Planning, Species, …).';
COMMENT ON COLUMN public.blog_posts.country IS
  'Destination the article is about, as experience_pages.country. NULL = general. Ties the article to a hub (derived from the country group).';
COMMENT ON COLUMN public.blog_posts.guide_id IS
  'Optional guide the article features (links from articles to guides: FA-1.90).';
COMMENT ON COLUMN public.blog_posts.status IS
  'draft | published. Only published rows are visible to the browser keys and listed in the sitemap.';
COMMENT ON COLUMN public.blog_posts.published_at IS
  'When the post went live; datePublished in the Article JSON-LD. Required when published.';
COMMENT ON COLUMN public.blog_posts.updated_at IS
  'Set by trigger on every UPDATE; dateModified in the Article JSON-LD and lastModified in the sitemap.';

-- ────────────────────────────────────────────────────────
-- 2. updated_at
-- ────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER blog_posts_set_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────
-- 3. RLS — public read of published rows, no write path for the browser keys
-- ────────────────────────────────────────────────────────
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads published blog posts" ON public.blog_posts
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

-- The baseline's ALTER DEFAULT PRIVILEGES grants anon and authenticated ALL on every new
-- `public` table. With RLS on and no write policy they could not write anyway; the REVOKE
-- makes the write path closed even if someone adds a policy by mistake. service_role
-- bypasses RLS; the GRANT is what lets it read and write.
REVOKE ALL    ON TABLE public.blog_posts FROM anon, authenticated;
GRANT  SELECT ON TABLE public.blog_posts TO   anon, authenticated;
GRANT  ALL    ON TABLE public.blog_posts TO   service_role;
