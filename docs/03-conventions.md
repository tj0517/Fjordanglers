# Conventions

Short, because the agent reads this before every task. If a rule needs a paragraph of
justification, it goes in an ADR and this file links to it.

## Repository

- `pnpm` only. Node 20. Never commit `pnpm-lock.yaml` changes you did not intend.
- Branch: `<type>/<short-slug>` where type ∈ `fix|feat|chore|refactor|db|docs`.
  The task file names the branch.
- Commit messages: imperative, ≤ 72 chars first line, body explains *why* when not obvious.
  End with the attribution block the session gives you.
- One task = one branch = one PR. The PR description links the task file and pastes the
  final report.

## TypeScript

- `strict` on. No `any`, no `as any`, no `!` non-null assertions in new code. If types
  are missing, regenerate (`pnpm supabase:types`); if a table is missing from the types,
  that is a migration-drift bug — report it, do not cast around it.
- Server components fetch through `@fa/core` (today `src/actions` / `src/lib/supabase/queries.ts`).
  Client components receive data as props; they do not create Supabase clients.
- `'use client'` only when the component needs state, effects or browser APIs.
- Zod at every boundary: API routes, server actions, webhook payloads, env.
- Env access only through `src/lib/env.ts` (later `packages/config/env.ts`). Booleans
  are `z.enum(['true','false'])`, never `z.coerce.boolean()`.

## Database

- Migrations: `supabase migration new <slug>` → file in `supabase/migrations/`
  (later `packages/db/supabase/migrations/`). Name says what it does:
  `20260901_add_inquiry_events`, not `20260901_update`.
  Stage-1 migrations after `20261001000000` use sequential timestamps (`20261002…`, `20261003…`) rather than the real date, so `db push` does not require `--include-all`.
- Every new table: RLS enabled + at least one policy in the **same** migration + a
  comment on the table saying what it is for.
- Every migration is reversible in intent: if it drops, the task has a `pg_dump` step
  before it and the PR says where the dump is.
- No DDL in the Supabase dashboard. Ever. CI runs `supabase db diff` and fails on drift.
  Since FA-1.01 (baseline `20260904165037_baseline_prod.sql`), production's SQL Editor is
  read-only in practice: every schema change goes through `supabase migration new` +
  `supabase db push`, never a manual statement run against `uwxrstbplaoxfghrchcy`.
- `apply_migration` via MCP assigns its own timestamp version (not the filename's). After
  using it, rename the local migration file to match the version from `list_migrations`,
  in the same PR. Default path to production is `supabase db push` done by tj — agents
  use `apply_migration` only when explicitly instructed and after a STOP-gate approval.
- Column naming: `snake_case`, `*_at` for timestamps, `*_cents` for money, `*_id` for FKs,
  booleans as adjectives (`qualified`, `is_hidden` is legacy).
- Money: `INTEGER` cents + `currency CHAR(3)`. Never `NUMERIC` euros in new columns.
- Constraints over application checks: `CHECK`, `UNIQUE`, `NOT NULL`, FK with explicit
  `ON DELETE`. A status list is a `CHECK (status IN (...))`, not an enum type (enums are
  painful to alter).
- Triggers only for invariants that must hold regardless of caller (`updated_at`,
  append-only guards). Business logic lives in `packages/core`, not in triggers.

## Events and state

- Any change to `inquiries.status` goes through `transition()`. Grep for
  `update({ status` in your diff before you open the PR; it should be empty.
- Any repository method that changes domain state calls `emitEvent()` inside the same
  transaction. Event types are enumerated in `packages/core/events/types.ts` and
  `REBUILD_PLAN.md` Appendix C — add to both in the same PR.

## Metrics

- A metric exists when it has an entry in `packages/core/metrics/` (key, name, unit,
  formula, target, source, FigJam section). No number appears on an admin screen without
  a key. `/fa-metric` walks the full path: definition → view → screen → test.
- Medians, not means, for durations. Cohorts, not period ratios, for conversion.
- Cost per anything is computed from `ad_campaigns.spend` and our own counts — never from
  the Google Ads "conversions" column (it triple-counts).

## Testing

- Vitest for `packages/core`: state machine edges, matchers, finance/metric formulas,
  guards (every use-case rejects a missing actor). Playwright for the one golden path:
  inquiry → offer → deposit in Stripe test mode.
- **Red proof**: any new guard, constraint, policy or trigger is demonstrated failing on
  a deliberately bad input in the PR (paste the error).
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green before "done".

## CI

`.github/workflows/ci.yml` runs on every PR to `main` and to `stage-1`, and on push to
`stage-1`. Three jobs; the exact names to require in branch protection are `check`, `db`
and `sync`. No secrets: every value comes from the committed `.env.test` (local Supabase
keys are deterministic, Stripe/Resend are placeholders), and `secrets.*` appears nowhere
in the workflow.

| job | when | what it proves | how to fix a red run |
|---|---|---|---|
| `check` | every PR + push to `stage-1` | `pnpm typecheck`, `pnpm build` pass; `pnpm test` runs in `db` | run the same command locally |
| `db` | PRs only | migrations apply to an empty database; `database.types.ts` matches the schema; tests pass against a fresh stack | see the three cases below |
| `sync` | PRs to `stage-1` only | merging this PR leaves `main` an ancestor of `stage-1`, and the PR branch already contains `main` | `git merge origin/main` into whichever the error names |

**Lint is deliberately not a gate** — `continue-on-error: true`, result in the job summary.
`main` carries 40 errors in files no current task touches (`src/emails/*.tsx`,
`whatsapp-bridge/poll-emails.mjs`); a gate today would be red forever and protect nothing.
When the `docs/deferred-tasks.md` entry for it is closed, drop `continue-on-error` from the
`lint` step. Until then the task criterion is "no worse than `main`", not "green".

Three ways `db` goes red, and the fix for each:

1. **`db reset` fails** — a migration does not apply to an empty database. Read the
   Postgres error in the step; fix the migration file, never the database.
2. **`gen types` diff is non-empty** — `src/lib/supabase/database.types.ts` is stale.
   Run `pnpm supabase:types:local` against a local stack that has just been reset, and
   commit the result. `--local` is the canonical generator: `--project-id` produces a
   different file skeleton for an identical schema, so the two cannot be mixed.
3. **`db diff --local` is non-empty** — the database holds objects the migrations do not
   describe. Note that straight after `db reset` this is close to a tautology (the
   database was built from those migrations); the honest catch for a bad migration is
   case 1.

`sync` checks two different things and says which one failed: the merge result still
missing a hotfix that landed on `main`, and a PR branch cut before that hotfix. Both are
fixed by a merge, not a force-push — `main` and `stage-1` are protected. The first check
looks at what `stage-1` *becomes*, not at what it is, so that the PR which merges `main`
into `stage-1` is not blocked by the very condition it removes.

## Admin UI

- Every number is clickable to the rows it came from.
- Week = Monday–Sunday. Default period on `/admin` is the last closed week.
- Currency display: PLN by default at frozen rates, toggle to EUR; never silently mix.
- Charts via `@fa/ui` chart components (Recharts under the hood); brand palette; no
  third colour beyond Navy / Glacier / Salmon without updating the brand doc.

## Naming across the codebase

`inquiry` (never `lead` for an angler request — `lead` is legacy and means a guide
application), `offer`, `deposit`, `booking` (= paid deposit), `deal`, `guide`,
`experience` (not `trip`, not `page`), `destination`, `customer` (not `angler` in code;
`angler` is fine in copy).

## Language

Code, comments, docs, ADRs, commit messages: English. Task files and human review notes
may be Polish. UI copy: English (site) — see brand voice in `CLAUDE.md`.

## Production verification

Pages that export `revalidate` serve an ISR render from before the last deploy until the
TTL expires — run a production `curl` only after a Vercel redeploy (or with a cache-bypass
header), otherwise the evidence refers to old code, not the current deployment.
