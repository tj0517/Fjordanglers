# CLAUDE.md — FjordAnglers

Read this first. It is short on purpose: it tells you what the product is, what we are
building right now, and the rules that never bend. Everything else is in `docs/` and is
referenced by path — read those files, do not rely on memory of them.

## What FjordAnglers is

An **agency** for guided fishing trips (Iceland, New Zealand, Nordics). An angler sends an
inquiry on fjordanglers.com; an AI agent qualifies it; the founders (FA) match a guide and
send an offer; the angler pays a **deposit to FA's own Stripe account** — that deposit *is*
FA's fee (20% on top of the guide's price); the angler pays the rest directly to the guide.
FA never holds money that is not its own. Offers go out in the guide's name; the service
contract is between angler and guide.

It is **not** a marketplace and **not** Stripe Connect. The old `CLAUDE.md` that described
payment tiers, destination charges and a cancellation engine is archived at
`docs/archive/CLAUDE-v1-marketplace.md` — it describes a product that was never built.
See `docs/adr/0001-agency-model-not-marketplace.md`.

## What we are building right now

A staged rebuild — not a rewrite — of the existing Next.js 16 + Supabase app:
clean schema, one shared data layer, a monorepo with `apps/web` + `apps/admin`, an
event log that makes every metric on the FigJam plan computable, and an admin panel with
seven screens. The full plan with stages 0–8 is `docs/REBUILD_PLAN.md`. The state of the
code and database it starts from is in `docs/audit/`.

Work is organised as tasks in `docs/tasks/` (one file each, numbered `FA-<stage>.<nn>`).
**One task = one branch = one PR.** You never pick up a second task in the same PR.

## Stack (as it actually is)

Next.js 16 App Router (`src/proxy.ts` is the middleware) · TypeScript strict · Supabase
(Postgres 17, Auth, Storage) project `uwxrstbplaoxfghrchcy` · Stripe Checkout on FA's
account (no Connect) · Resend (transactional + inbound) · Anthropic SDK (inquiry agent) ·
Vercel (hosting + cron) · Meta WhatsApp Cloud API · Google Ads API · pnpm.
Target layout after stage 2: `apps/web`, `apps/admin`, `packages/{db,core,ui,config}`.

## Rules that never bend

1. **Schema changes only through migrations** in `supabase/migrations/` (later
   `packages/db/supabase/migrations/`). Never through the Supabase dashboard. Never
   `db push` to production without an explicit STOP approval in the task.
2. **Production state is established by reading it now**, never from memory, notes, or
   the types file. The types file was stale for three months once; assume it can be again.
3. **No `.from(...)` outside the data layer.** Today that is `src/actions/*` and
   `src/lib/supabase/queries.ts`; after stage 2 it is `packages/core` only. Pages and
   components never query Supabase directly.
4. **Every mutation checks who is calling.** `requireAdmin()` / `requireGuide()` /
   `requireToken()` before any service-role write. A layout check is not authorisation.
5. **Every domain state change emits an event** (`inquiry_events`) in the same
   transaction. A mutation without an event is a bug of the same class as a write
   without auth.
6. **Money is integer cents + currency** in new code. Never float. FX rate frozen at the
   moment of the event, never recomputed from today's rate.
7. **Booking = paid deposit** (`deposit_paid_at` / `payments.status='paid'`). Not "offer
   sent", not a status someone set by hand.
8. **No `as any`** in new code. If the types are missing, regenerate them
   (`pnpm supabase:types`) — that is the task, not the workaround.
9. **Dead code is deleted in the PR that replaces it.** No "leave it for now".
10. **Stay inside the task's scope.** Things you notice on the way go to
    `docs/deferred-tasks.md`, not into this PR.

## Where things live

| Question | File |
|---|---|
| What do the words mean (inquiry, offer, deal, qualified, live destination…) | `docs/00-glossary.md` |
| Target architecture, data-layer rules, state machine, event log | `docs/01-architecture.md` |
| Target schema, current schema, what is being dropped, column mapping | `docs/02-data-model.md` |
| Coding, migration, testing, PR and naming conventions | `docs/03-conventions.md` |
| Decisions not yet made — do not decide them yourself | `docs/04-open-questions.md` |
| How agents work here: models, effort, STOP gates, report format | `docs/05-agent-operations.md` |
| Why we decided what we decided | `docs/adr/` |
| The plan, stage by stage, with metric catalogue and admin screens | `docs/REBUILD_PLAN.md` |
| What the code and DB looked like before the rebuild | `docs/audit/` |
| Things noticed and deliberately not done | `docs/deferred-tasks.md` |
| Business metrics we must be able to compute | `docs/REBUILD_PLAN.md` §7 |
| Brand, positioning, business model, voice | `docs/brand/` |

## How to work on a task

1. Read the task file in `docs/tasks/` and every file it lists under "Context".
2. Read the current state of whatever the task touches (code, and DB by query) before
   changing anything. The task's first checklist item always says this.
3. Work on a branch named in the task. Commit small.
4. Verify with the commands the task lists. For any new guard, trigger, constraint or
   policy, **also show it failing on a deliberately broken case**.
5. Report in the format in `docs/05-agent-operations.md`: done · not done · noticed-and-
   deferred · needs a decision. Claims about the database come with the query output.

Slash commands: `/fa-task <id>` builds the working prompt for a task, `/fa-verify` runs the
full check suite, `/fa-migrate` walks a schema change safely, `/fa-metric` adds a metric
end-to-end, `/fa-review` audits a finished task against its acceptance criteria.
Subagents in `.claude/agents/`: `fa-architect`, `fa-db`, `fa-core`, `fa-admin`, `fa-web`,
`fa-reviewer` — each states when it should be used.

## Brand (for anything user-facing)

Fjord Navy `#0A2E4D` · Glacier White `#F8FAFB` · Salmon `#E67E50` (accent only, one
moment per page) · Fraunces (display) · DM Sans (body) · tagline *"Wild Nordic. Real
guides."* · voice: warm, direct, no marketing jargon. Founders: Tymon, Krzychu, Lukas.
