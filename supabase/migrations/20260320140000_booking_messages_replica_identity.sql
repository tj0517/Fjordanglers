-- REPLICA IDENTITY FULL on booking_messages
--
-- Required for Supabase Realtime to properly evaluate Row Level Security
-- policies when delivering postgres_changes events to clients.
-- Without FULL, only the primary key is available in the WAL payload, which
-- means Supabase cannot check the booking_id-based RLS SELECT policies and
-- silently drops events for subscribers other than the sender.

ALTER TABLE public.booking_messages REPLICA IDENTITY FULL;
