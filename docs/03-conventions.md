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
- Every new table: RLS enabled + at least one policy in the **same** migration + a
  comment on the table saying what it is for.
- Every migration is reversible in intent: if it drops, the task has a `pg_dump` step
  before it and the PR says where the dump is.
- No DDL in the Supabase dashboard. Ever. CI runs `supabase db diff` and fails on drift.
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
