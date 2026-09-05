-- FA-0.05: single inquiry creation path — attribution columns.
-- `source` records which path created the row (web_form | manual | email | whatsapp).
-- Historical rows predate this column and stay NULL — no backfill in this migration.
-- `utm` records the utm_source/medium/campaign/content/term captured client-side,
-- mirroring how `gclid` is already captured (see src/lib/gclid.ts / src/lib/utm.ts).

ALTER TABLE "public"."inquiries"
  ADD COLUMN IF NOT EXISTS "source" "text",
  ADD COLUMN IF NOT EXISTS "utm" "jsonb";

ALTER TABLE "public"."inquiries"
  ADD CONSTRAINT "inquiries_source_check"
  CHECK ("source" IS NULL OR "source" = ANY (ARRAY['web_form'::"text", 'manual'::"text", 'email'::"text", 'whatsapp'::"text"]));

COMMENT ON COLUMN "public"."inquiries"."source" IS 'Which path created this inquiry: web_form (public widget) or manual (admin form). NULL for rows created before this column existed.';
COMMENT ON COLUMN "public"."inquiries"."utm" IS 'utm_source/medium/campaign/content/term captured client-side at submission time, if present in the URL.';
