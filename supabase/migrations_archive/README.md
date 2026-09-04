# Archived migrations (pre-baseline)

These 60 files are the migration history of the app up to 2026-09-04. They are kept for
reading only: their date-only prefixes (`YYYYMMDD_`) mean several files share one version
number, and after 2026-07-08 they reached production outside the CLI's push flow, so the
CLI can neither apply nor track them. Production schema from that date on is captured in
`supabase/migrations/<timestamp>_baseline_prod.sql` (FA-1.01), and the Supabase CLI only
reads `supabase/migrations/` — nothing in this directory is ever pushed anywhere.
