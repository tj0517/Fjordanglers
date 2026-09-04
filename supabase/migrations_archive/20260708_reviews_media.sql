-- Add media storage column to reviews + create bucket for trip photos/videos.

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]';

-- Public bucket — no file-size cap from our side.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('review-media', 'review-media', true, null, null)
ON CONFLICT (id) DO NOTHING;
