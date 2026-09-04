-- Grants for public-facing tables.
--
-- anon / authenticated : SELECT only — row visibility controlled by RLS.
-- service_role         : full access — used by server actions and admin panel,
--                        bypasses RLS but still needs explicit GRANT.
-- postgres             : already owns the tables (superuser).

-- ── guides ────────────────────────────────────────────────────────────────────

GRANT SELECT                          ON guides TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON guides TO service_role;

-- ── experience_pages ──────────────────────────────────────────────────────────

GRANT SELECT                          ON experience_pages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON experience_pages TO service_role;

-- ── experience_page_options ───────────────────────────────────────────────────

GRANT SELECT                          ON experience_page_options TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON experience_page_options TO service_role;
