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
| FA-0.04 | `next build` skips env validation entirely (`NEXT_PHASE === 'phase-production-build'` branch returns raw `process.env` cast as `Env`) — so the type system promises `boolean` for `AI_AUTO_REPLY_ENABLED` (and every other field) but the actual value at that phase is whatever string Vercel injects, unvalidated. Both current reads of the flag are in request handlers (not module scope), so runtime is safe today — but any future module-level read of `env` would silently get a raw string instead of the typed value, defeating the whole point of this task's fix | `src/lib/env.ts:149-152` | not fixed here — out of scope per FA-0.04; needs its own task if a module-level env read is ever added |
| FA-0.02 | Duplicate breadcrumb: "Guides" and guide-name crumb both link to `/admin/guides/[id]` | `src/app/admin/guides/[id]/trips/[expId]/edit/page.tsx:121,125` | minor UX noise; fix when redesigning admin breadcrumbs in stage 7 |
