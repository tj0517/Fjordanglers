-- Migration: 20260316180000_fix_published_has_image_constraint.sql
-- Description: Drop the broken experiences_published_has_image CHECK constraint.
--
-- Why broken:
--   The constraint checked experiences.images (a legacy TEXT[] column) and
--   experiences.landscape_url. However, actual gallery images are stored in
--   the separate `experience_images` table (FK → experiences.id), which a
--   simple CHECK constraint cannot reference.
--
--   Result: every new trip insert with published=TRUE failed with
--   "violates check constraint experiences_published_has_image"
--   even when images had been uploaded to experience_images.
--
-- Fix: drop the constraint entirely. Image presence is validated at the
--   application layer (ExperienceForm) before the insert, so this constraint
--   adds no safety that isn't already covered.

BEGIN;

ALTER TABLE public.experiences
  DROP CONSTRAINT IF EXISTS experiences_published_has_image;

COMMIT;
