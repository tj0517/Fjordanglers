-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: seed guide_photos from existing photo tables
--
-- CONTEXT
-- The guide_photos table was created as the single source for the experience
-- page builder gallery picker.  It was empty because existing photos live in:
--
--   guide_images       — guide's own profile/gallery photos
--                        (identical schema to guide_photos + caption field)
--   experience_images  — photos attached to individual trips
--                        (linked to guide via experiences.guide_id)
--
-- This migration:
--   1. Adds a UNIQUE constraint on (guide_id, url) to prevent duplicates.
--   2. Copies all guide_images rows into guide_photos (preserving IDs and order).
--   3. Appends all experience_images into guide_photos per guide (no duplicates).
--
-- Idempotent: ON CONFLICT (guide_id, url) DO NOTHING — safe to run again.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add unique constraint (prevents duplicates on re-run + app-level) ────
-- PostgreSQL doesn't support ADD CONSTRAINT IF NOT EXISTS — use exception handler.
DO $$ BEGIN
  ALTER TABLE guide_photos
    ADD CONSTRAINT guide_photos_guide_url_unique UNIQUE (guide_id, url);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Copy guide_images → guide_photos ─────────────────────────────────────
-- guide_images has the identical schema (id, guide_id, url, is_cover,
-- sort_order, created_at).  Reuse the same UUIDs so nothing changes for
-- rows that are already synced.
INSERT INTO guide_photos (id, guide_id, url, is_cover, sort_order, created_at)
SELECT
  id,
  guide_id,
  url,
  is_cover,
  sort_order,
  created_at
FROM guide_images
ON CONFLICT (guide_id, url) DO NOTHING;

-- ── 3. Copy experience_images → guide_photos ────────────────────────────────
-- Each experience belongs to a guide; we pull the guide_id via the join.
-- sort_order continues from wherever guide_images left off per guide.
-- is_cover = false (experience photos are supplementary, not profile covers).
WITH ranked AS (
  SELECT
    e.guide_id,
    ei.url,
    ei.created_at,
    -- Rank within the guide, ordered by experience then original sort_order
    ROW_NUMBER() OVER (
      PARTITION BY e.guide_id
      ORDER BY e.created_at, ei.sort_order, ei.created_at
    ) AS rn
  FROM experience_images ei
  JOIN experiences e ON e.id = ei.experience_id
  WHERE e.guide_id IS NOT NULL
    AND ei.url IS NOT NULL
    AND ei.url <> ''
),
current_max AS (
  SELECT guide_id, COALESCE(MAX(sort_order), -1) AS max_sort
  FROM guide_photos
  GROUP BY guide_id
)
INSERT INTO guide_photos (guide_id, url, is_cover, sort_order, created_at)
SELECT
  r.guide_id,
  r.url,
  false,
  (COALESCE(cm.max_sort, -1) + r.rn)::integer,
  r.created_at
FROM ranked r
LEFT JOIN current_max cm ON cm.guide_id = r.guide_id
ON CONFLICT (guide_id, url) DO NOTHING;

-- ── Result check ────────────────────────────────────────────────────────────
-- After running, verify counts match expectations:
--
--   SELECT COUNT(*) FROM guide_photos;
--   SELECT guide_id, COUNT(*) FROM guide_photos GROUP BY guide_id ORDER BY 2 DESC;
--
-- You should see one row per unique (guide, photo URL) combination
-- across both guide_images and experience_images.
