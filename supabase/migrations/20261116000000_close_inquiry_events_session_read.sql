-- FA-1.95 — inquiry_events is server-only: no session reads the event log.
--
-- Why: the policy "authenticated reads events" (20260916201226_add_inquiry_events.sql) is
-- SELECT … TO authenticated USING (true). Since FA-M.08 guides have accounts, so every signed-in
-- user — angler or guide — could read the whole log of every inquiry. Prod read 2026-11-16:
-- 1809 events / 161 inquiries, payload keys include amounts, Stripe product names and session
-- ids, internal notes and the auto-send judge's reasons.
--
-- Nothing in the app reads this table with a session client (FA-M.03 read, 2026-11-16): the
-- admin inquiry card, the message actions and the queries helpers all use the service key.
-- So no admin policy replaces it (tj decision 2026-11-16): reads go through the server only.
--
-- Unchanged on purpose: the service_role policies ("service_role reads events",
-- "service_role writes events") and the append-only trigger inquiry_events_no_update.

DROP POLICY "authenticated reads events" ON public.inquiry_events;

-- anon never had a policy (RLS returned 0 rows) but still held the grant; with this the refusal
-- is a permission error before RLS, for both API roles.
REVOKE SELECT ON public.inquiry_events FROM anon, authenticated;
