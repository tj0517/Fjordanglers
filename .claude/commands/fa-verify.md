---
description: Run the full verification suite and report red/green per check with evidence
---

Run every check below, in this order, and report each as ✅ / ❌ with the relevant
output excerpt (not the whole log). Do not fix anything in this command; report only.

1. `git status --porcelain` — expect empty or only intended changes; list unexpected files.
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm test` (Vitest) — list failing test names if any.
5. `pnpm build` — tail 30 lines on failure.
6. Data-layer boundaries:
   - `grep -rn "\.from(" src --include=*.ts --include=*.tsx | grep -v "src/actions\|src/lib/supabase\|src/lib/inquiries\|src/lib/events\|packages/core\|Array.from\|Buffer.from\|database.types"` — expect empty.
   - `grep -rn "as any" src --include=*.ts --include=*.tsx | grep -v database.types` — expect no NEW occurrences vs `main` (`git diff main -- src | grep "^+.*as any"`).
   - `grep -rn "update({ *status" src --include=*.ts --include=*.tsx | grep -v "state.ts"` — expect empty once FA-1.03 is done.
7. Schema drift (only if `supabase` CLI is available and a local/branch DB is linked):
   `supabase db diff` — expect "No schema changes found". If the CLI is not set up, say
   so explicitly instead of skipping silently.
8. Types freshness: `pnpm supabase:types` then `git diff --stat src/lib/supabase/database.types.ts` — expect no diff.
9. Secrets: `git diff main --name-only | xargs grep -l "sk_live\|sk_test\|service_role\|eyJhbGci" 2>/dev/null` — expect empty.
10. Docs: if the diff touches `inquiries.status` handling, events, or metrics — confirm
    `docs/REBUILD_PLAN.md` Appendix C / `packages/core/metrics` were updated in the same
    diff; if the diff touches schema — confirm a migration file is in the diff.

End with one line: **all green** or **N red — <names>**.
