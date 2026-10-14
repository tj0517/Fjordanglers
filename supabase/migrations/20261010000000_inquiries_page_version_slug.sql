-- FA-1.60: which version of which experience page an inquiry was sent from.
--
-- `page_version` is the template the visitor actually saw (1 = v1, 2 = v2) — what the
-- browser rendered, including an admin on ?preview=v2 — not `experience_pages.page_version`,
-- which is only the page's opt-in and says nothing about the global flag at that moment.
-- `page_slug` is the slug of the page the form was submitted on. Both are sent by the
-- public forms next to gclid/utm and stored as given, so the pilot (FA-1.57) can be read
-- per page and per version from the database, the same way GA4 reads it.
--
-- Nullable, no default, no backfill: NULL = sent before this column existed, or created
-- by a path that is not an experience page (manual admin form, e-mail, WhatsApp).
-- Safe to apply before the code that writes it is deployed.

ALTER TABLE "public"."inquiries"
  ADD COLUMN IF NOT EXISTS "page_version" smallint,
  ADD COLUMN IF NOT EXISTS "page_slug" "text";

ALTER TABLE "public"."inquiries"
  ADD CONSTRAINT "inquiries_page_version_check"
  CHECK ("page_version" IS NULL OR "page_version" IN (1, 2));

COMMENT ON COLUMN "public"."inquiries"."page_version" IS 'Experience page template the angler saw when sending the inquiry: 1 = v1, 2 = v2 (FA-1.60). NULL for rows before this column and for non-page sources.';
COMMENT ON COLUMN "public"."inquiries"."page_slug" IS 'Slug of the experience page the inquiry form was submitted on (FA-1.60). NULL for rows before this column and for non-page sources.';
