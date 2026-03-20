-- ─── booking_messages ─────────────────────────────────────────────────────────
-- One thread per booking. Both the angler and guide can read/write messages.
-- Realtime enabled so the chat component receives live updates.

CREATE TABLE public.booking_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID        NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id  UUID        NOT NULL REFERENCES auth.users(id),
  body       TEXT        NOT NULL,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_messages_body_length CHECK (char_length(body) BETWEEN 1 AND 2000)
);

-- Perf index
CREATE INDEX booking_messages_booking_created_idx
  ON public.booking_messages (booking_id, created_at);

-- ─── Realtime ──────────────────────────────────────────────────────────────────
-- Add to the Supabase Realtime publication so clients receive INSERT events.
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_messages;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.booking_messages ENABLE ROW LEVEL SECURITY;

-- Guide of the booking can SELECT and INSERT
CREATE POLICY "Guide can read booking messages"
  ON public.booking_messages
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN  public.guides g ON g.id = b.guide_id
      WHERE b.id = booking_messages.booking_id
        AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "Guide can send booking messages"
  ON public.booking_messages
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN  public.guides g ON g.id = b.guide_id
      WHERE b.id = booking_messages.booking_id
        AND g.user_id = auth.uid()
    )
  );

-- Angler of the booking can SELECT and INSERT
CREATE POLICY "Angler can read booking messages"
  ON public.booking_messages
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_messages.booking_id
        AND b.angler_id = auth.uid()
    )
  );

CREATE POLICY "Angler can send booking messages"
  ON public.booking_messages
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_messages.booking_id
        AND b.angler_id = auth.uid()
    )
  );
