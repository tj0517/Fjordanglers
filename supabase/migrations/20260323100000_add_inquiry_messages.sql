-- ─── inquiry_messages ────────────────────────────────────────────────────────
-- Chat thread attached to a trip_inquiry.
-- Available from 'inquiry' status onwards — guide and angler can message each
-- other without waiting for the inquiry to be confirmed.

CREATE TABLE IF NOT EXISTS public.inquiry_messages (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_id  uuid        NOT NULL
                REFERENCES public.trip_inquiries(id) ON DELETE CASCADE,
  sender_id   uuid        NOT NULL
                REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Denormalised for display; set by the server action, not the client
  sender_role text        NOT NULL
                CHECK (sender_role IN ('angler', 'guide', 'admin')),
  body        text        NOT NULL
                CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 2000),
  created_at  timestamptz DEFAULT now() NOT NULL,
  read_at     timestamptz
);

-- Efficient per-inquiry list
CREATE INDEX idx_inquiry_messages_inquiry_created
  ON public.inquiry_messages (inquiry_id, created_at);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
ALTER publication supabase_realtime ADD TABLE public.inquiry_messages;

-- ─── Row-level security ───────────────────────────────────────────────────────
ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: angler owns the inquiry OR guide is assigned OR admin
CREATE POLICY "inquiry_messages_select"
  ON public.inquiry_messages
  FOR SELECT
  USING (
    -- Angler
    inquiry_id IN (
      SELECT id FROM public.trip_inquiries WHERE angler_id = auth.uid()
    )
    OR
    -- Assigned guide
    inquiry_id IN (
      SELECT ti.id
      FROM public.trip_inquiries ti
      JOIN public.guides g ON g.id = ti.assigned_guide_id
      WHERE g.user_id = auth.uid()
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- INSERT: sender must be the authenticated user; inquiry must be active
CREATE POLICY "inquiry_messages_insert"
  ON public.inquiry_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      -- Angler owns an active inquiry
      inquiry_id IN (
        SELECT id FROM public.trip_inquiries
        WHERE angler_id = auth.uid()
          AND status NOT IN ('cancelled')
      )
      OR
      -- Assigned guide, active inquiry
      inquiry_id IN (
        SELECT ti.id
        FROM public.trip_inquiries ti
        JOIN public.guides g ON g.id = ti.assigned_guide_id
        WHERE g.user_id = auth.uid()
          AND ti.status NOT IN ('cancelled')
      )
      OR
      -- Admin can always message
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- UPDATE: participants can mark messages as read (read_at only)
CREATE POLICY "inquiry_messages_update_read"
  ON public.inquiry_messages
  FOR UPDATE
  USING (
    inquiry_id IN (
      SELECT id FROM public.trip_inquiries WHERE angler_id = auth.uid()
    )
    OR
    inquiry_id IN (
      SELECT ti.id
      FROM public.trip_inquiries ti
      JOIN public.guides g ON g.id = ti.assigned_guide_id
      WHERE g.user_id = auth.uid()
    )
  );
