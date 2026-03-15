-- Migration: 20260316000001_add_social_urls_to_guides.sql
-- Description: Adds website_url and facebook_url columns to guides table

ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS website_url  text NULL,
  ADD COLUMN IF NOT EXISTS facebook_url text NULL;
