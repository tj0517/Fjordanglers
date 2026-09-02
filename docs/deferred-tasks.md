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
