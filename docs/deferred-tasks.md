# Deferred tasks

Things noticed during a task and deliberately not done there. One line each: what,
where, why it matters, which task noticed it. Promote to `docs/tasks/` when scheduled.

| Noticed in | What | Where | Why it matters |
|---|---|---|---|
| audit 2026-08-31 | `robots.ts` disallows ghost routes `/account/`, `/book/`, `/invite/` | `src/app/robots.ts` | cosmetic; clean with stage 7 |
| audit 2026-08-31 | `docs/01-05` duplicated in `head/` with two diverged copies | `docs/`, `head/` | one source of brand truth; fold into `docs/brand/` |
| audit 2026-08-31 | `.claude/settings.local.json` holds live secrets | `.claude/` | O-11 |
| audit 2026-08-31 | `review-media` bucket has no policy migration | Supabase storage | record in stage-1 baseline |
| audit 2026-08-31 | `guides.iban` stored plaintext (`field-encryption.ts` never called) | `guides` | drop the column in stage 4; until then do not add more |
| FA-0.03 | Google Ads token/credentials broken — API call throws `Cannot read properties of undefined (reading 'get')`; underlying cause is a gRPC error from Google (`No data type found for reason/domain/metadata` — `google-ads-api` lib fails to decode Google's ErrorInfo, likely expired refresh token or missing `login_customer_id` for MCC-managed account) | `src/lib/google-ads/client.ts`, `GOOGLE_ADS_REFRESH_TOKEN` | cron will keep returning 500 until credentials are refreshed; confirmed via real curl 2026-09-03, not a routing bug |
