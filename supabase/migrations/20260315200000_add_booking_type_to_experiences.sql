ALTER TABLE experiences
  ADD COLUMN IF NOT EXISTS booking_type text NOT NULL DEFAULT 'classic'
    CHECK (booking_type IN ('classic', 'icelandic'));
