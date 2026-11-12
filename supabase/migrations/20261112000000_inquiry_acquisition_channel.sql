-- FA-1.87 — Organic attribution: first touch on the inquiry + acquisition channel view
--
-- Three nullable columns on inquiries, written by POST /api/inquiries from the visitor's
-- first-touch record (localStorage `fa_first_touch`, 90 days, never overwritten while valid):
--   first_referrer_host — host of document.referrer at the first visit (lower-case, no port,
--                         no path/query); NULL when there was no outside referrer
--   landing_path        — window.location.pathname of the first visit (no query string)
--   first_touch_at      — when that first visit happened
-- All three are analytics only: the server reduces/validates them and stores NULL for an odd
-- value, so the CHECKs below are a second line and must never be what rejects an inquiry.
--
-- Nullable, no default → adding them only changes the catalogue (no table rewrite).
-- tj decision 2026-11-12: columns (option A), not keys inside `utm`.

ALTER TABLE "public"."inquiries"
  ADD COLUMN "first_referrer_host" text,
  ADD COLUMN "landing_path"        text,
  ADD COLUMN "first_touch_at"      timestamptz;

ALTER TABLE "public"."inquiries"
  ADD CONSTRAINT "inquiries_first_referrer_host_format" CHECK (
    "first_referrer_host" IS NULL OR (
      char_length("first_referrer_host") <= 253
      AND "first_referrer_host" ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$'
    )
  ),
  ADD CONSTRAINT "inquiries_landing_path_format" CHECK (
    "landing_path" IS NULL OR (
      char_length("landing_path") <= 500
      AND "landing_path" ~ '^/([^/[:space:][:cntrl:]][^[:space:][:cntrl:]]*)?$'
    )
  );

COMMENT ON COLUMN "public"."inquiries"."first_referrer_host" IS
  'FA-1.87: host of document.referrer at the visitor''s first visit (lower-case, no port). '
  'NULL = no outside referrer, or no first-touch record. Analytics only.';
COMMENT ON COLUMN "public"."inquiries"."landing_path" IS
  'FA-1.87: path of the page the visitor first landed on (no query string). Analytics only.';
COMMENT ON COLUMN "public"."inquiries"."first_touch_at" IS
  'FA-1.87: time of the visitor''s first visit as recorded by the browser. '
  'NULL = no first-touch record reached the server (inquiry before FA-1.87, storage blocked, old cached page).';

-- inquiry_acquisition_channel: one row per inquiry, the channel it came through.
-- Rules, first match wins (tj decisions 2026-11-12):
--   source <> 'web_form'                                         → NULL (entered by an admin)
--   gclid, or utm_medium 'cpc'/'paid' (trimmed, any case)        → ads
--     (trim = ASCII whitespace, as String.prototype.trim does for ASCII; plain btrim() trims spaces only)
--     (must agree with isPaidAttributed in src/lib/metrics/weekly.ts — parity test)
--   referrer google.* / bing.* / yahoo.* / duckduckgo.com / ecosia.org / baidu.com → organic
--   referrer instagram.com / facebook.com, or utm_medium 'social' → social
--   no referrer and no utm_* key: first_touch_at NULL            → unknown
--                                 first_touch_at set             → direct
--   anything else                                                → referral
-- Not to be confused with inquiry_events.channel (how a message arrived: app / email / …).
CREATE VIEW "public"."inquiry_acquisition_channel" AS
SELECT
  i.id                  AS inquiry_id,
  i.created_at,
  i.source,
  i.first_referrer_host,
  i.landing_path,
  i.first_touch_at,
  CASE
    WHEN i.source IS DISTINCT FROM 'web_form' THEN NULL
    WHEN NULLIF(btrim(i.gclid, E' \t\n\r\f\v'), '') IS NOT NULL
      OR (jsonb_typeof(i.utm -> 'utm_medium') = 'string'
          AND lower(btrim(i.utm ->> 'utm_medium', E' \t\n\r\f\v')) IN ('cpc', 'paid'))
      THEN 'ads'
    WHEN i.first_referrer_host ~ '(^|\.)(google|bing|yahoo)\.[a-z]{2,}(\.[a-z]{2})?$'
      OR i.first_referrer_host ~ '(^|\.)(duckduckgo\.com|ecosia\.org|baidu\.com)$'
      THEN 'organic'
    WHEN i.first_referrer_host ~ '(^|\.)(instagram|facebook)\.com$'
      OR (jsonb_typeof(i.utm -> 'utm_medium') = 'string'
          AND lower(btrim(i.utm ->> 'utm_medium', E' \t\n\r\f\v')) = 'social')
      THEN 'social'
    WHEN i.first_referrer_host IS NULL
      -- COALESCE: with utm NULL the inner test is NULL, and NOT NULL would fall through to referral
      AND NOT COALESCE(jsonb_typeof(i.utm) = 'object'
               AND i.utm ?| ARRAY['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'], false)
      THEN CASE WHEN i.first_touch_at IS NULL THEN 'unknown' ELSE 'direct' END
    ELSE 'referral'
  END AS channel
FROM "public"."inquiries" i;

-- security_invoker: the view runs with the caller's rights, so the RLS on inquiries applies
-- (without it the view would run as its owner and bypass RLS).
ALTER VIEW "public"."inquiry_acquisition_channel" SET (security_invoker = true);

-- Admin / service role only, like web_funnel_daily: anglers and guides have no use for it.
REVOKE ALL ON "public"."inquiry_acquisition_channel" FROM anon, authenticated;

COMMENT ON VIEW "public"."inquiry_acquisition_channel" IS
  'FA-1.87: acquisition channel per inquiry (ads / organic / social / direct / referral / unknown; '
  'NULL for non-web_form). Rules in migration 20261112000000. Service role only.';
