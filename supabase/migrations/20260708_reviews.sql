-- Post-trip review links. FA generates a token per inquiry;
-- angler clicks the link after their trip and submits rating + feedback.

CREATE TABLE IF NOT EXISTS reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id       UUID REFERENCES inquiries(id) ON DELETE CASCADE NOT NULL,
  token            TEXT UNIQUE NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '60 days'),

  -- Submitted by angler
  overall_rating   SMALLINT CHECK (overall_rating BETWEEN 1 AND 5),
  would_recommend  BOOLEAN,
  comment          TEXT,
  submitted_at     TIMESTAMPTZ,

  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone with the token URL can load the review page (anon read).
-- Service role (server actions) bypasses RLS for writes.
CREATE POLICY "Public read reviews" ON reviews
  FOR SELECT TO anon USING (true);
