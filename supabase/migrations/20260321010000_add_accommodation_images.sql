-- Migration: Add images column to guide_accommodations
-- Stores public CDN URLs for accommodation photos.

ALTER TABLE public.guide_accommodations
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';
