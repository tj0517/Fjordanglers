-- Add photo marketing consent to guides.
-- Guide explicitly opts in (or out) to FjordAnglers using their photos
-- for platform marketing (social, ads, website), with attribution to their name.
-- Default false — consent must be actively given.

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS photo_marketing_consent boolean NOT NULL DEFAULT false;
