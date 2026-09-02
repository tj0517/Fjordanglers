# Architecture

Target state after the rebuild, and the rules that get us there. For *why*, see `adr/`.
For *when*, see `REBUILD_PLAN.md` §8. Stage numbers below refer to that plan.

## 1. Shape

```
fjordanglers/                           (monorepo from stage 2)
├── apps/
│   ├── web/      fjordanglers.com — (marketing) (angler) (guide) + api/webhooks
│   └── admin/    admin.fjordanglers.com — (review) (crm) (analytics) (supply) (content) + api/cron
├── packages/
│   ├── db/       Supabase: migrations, generated types, client factories, zod row schemas
│   ├── core/     domain: auth guards, repositories, use-cases, state machine, events, metrics catalogue
│   ├── ui/       brand tokens, primitives, Tailwind preset, chart components
│   └── config/   eslint / tsconfig / prettier
└── services/whatsapp-bridge/   legacy PM2 service, to be retired when Meta Cloud API covers all traffic
```

Until stage 2 the same responsibilities live in one Next.js app: `src/lib/supabase/*` is
`db`, `src/actions/*` + `src/lib/*` are `core`, `src/app/admin/*` is `admin`, the rest is
`web`. The rules below apply to those directories today with the same force.

## 2. Data-layer rules

- **Apps never talk to Supabase.** `apps/*` import from `@fa/core` only. `@fa/core`
  imports `@fa/db` only. ESLint enforces: `@supabase/*` allowed only in `packages/db`;
  the string `.from(` allowed only in `packages/core`.
- **One repository file per table.** `packages/core/<domain>/<table>.repo.ts`. A new
  `.from('x')` anywhere else fails lint. This is what makes "where is this table used"
  answerable in one grep.
- **Guards before service role.** Every use-case that writes starts with
  `const actor = await requireAdmin()` / `requireGuide()` / `requireToken(kind, token)`.
  Only after that does it obtain a service-role client. Server actions in apps are one-
  line wrappers around use-cases. Layout-level role checks are UX, not security.
- **Reads for public pages** use the anon client + RLS + cache tags
  (`experience:<slug>`, `guide:<slug>`); reads for admin use the service client after
  `requireAdmin()`. Same repository, different client passed in.
- **Types are generated in CI** from migrations. `as any` is a lint error in
  `packages/core`.

## 3. Events

Every domain mutation emits an `inquiry_events` row **in the same transaction**. The
emitter is part of the repository method, not something the caller remembers to do.

```
inquiry_events(id, inquiry_id, type, from_status, to_status,
               actor_kind ∈ {admin,guide,system,agent,angler}, actor_id,
               payload jsonb, occurred_at, created_at)      -- append-only, no UPDATE/DELETE policy
```

The event type catalogue is `REBUILD_PLAN.md` Appendix C. Adding a type means adding it
there and in `packages/core/events/types.ts` in the same PR. `occurred_at` is separate
from `created_at` so historical imports can carry their real time.

This table exists from stage 1 and is written to **before anything reads it**. Do not
"wait until the metrics screens exist" — the point is to have history when they do.

## 4. Inquiry state machine

Ten statuses, kept because they are the founders' operational vocabulary. Transitions
are restricted and go through one function:

```
pending ─▶ in_negotiation ─▶ waiting_for_guide_offer ─▶ offer_sent ─▶ waiting_for_deposit
        ─▶ deposit_sent ─▶ deposit_paid ─▶ completed
any non-terminal ─▶ lost | cancelled
```

`transition(inquiryId, to, { actor, reason })` in `packages/core/inquiries/state.ts`
validates the edge, updates `status`, recomputes `stage_reached`, emits
`status.changed`. Webhooks, the agent, the admin `StatusChanger` and any cron all call
the same function. If you find yourself writing `.update({ status: ... })` directly, stop.

## 5. Money

Integer cents + `currency` on every amount from stage 4 (`offers`, `payments`, `deals`,
`ad_campaigns`, `fixed_costs`, `manual_cost_entries`). `deals.fx_rate_pln` is frozen at
recognition (`recognized_at`) from `fx_rates` (daily NBP/ECB cron). Presentation converts;
storage never does. The commission counter toward 80 000 PLN must not move when EUR/PLN
moves.

## 6. Metrics layer

- `inquiry_events` — everything about time, funnel and effort.
- `metric_snapshots(metric_key, period_start, period_end, granularity, value, unit, source)`
  — everything the DB does not know (GA4, Instagram, manual). Unique per key/period/source
  so cron upserts are idempotent.
- Six materialised views refreshed nightly (`mv_inquiry_facts`, `mv_weekly_metrics`,
  `mv_monthly_cohorts`, `mv_guide_performance`, `mv_destination_status`,
  `mv_channel_costs`). Screens read views; they do not compute in TypeScript.
- `packages/core/metrics/` — the catalogue: key, name, unit, formula, target, source,
  FigJam section. Every number on every admin screen has a key here. The number in the
  panel, in a report and in Notion comes from the same definition.

Full metric list with formulas: `REBUILD_PLAN.md` §7.

## 7. Auth model

Supabase Auth. `profiles.role ∈ {admin, guide}` is the only thing `profiles` is for.
Guides are linked by `guides.user_id`; a guide row can exist without a user (beta
listing). Token pages (`/offers/[token]`, `/reviews/[token]`, `/guide-intake/[token]`)
authenticate by token + expiry, never by session. Admin app and web app share the
Supabase project; `apps/admin` refuses any session whose role is not `admin`.

## 8. Integrations and where their handlers live

| Integration | Entry point | Handler (core) | Notes |
|---|---|---|---|
| Stripe Checkout (deposit) | `apps/web/api/webhooks/stripe` | `core/payments/webhook.ts` | Idempotent on `payments.provider_session_id`; idempotency key must not include `Date.now()` |
| Resend inbound e-mail | `apps/web/api/webhooks/resend` | `core/messaging/inbound.ts` | Dedupe on `messages.external_id` |
| Meta WhatsApp Cloud | `apps/web/api/webhooks/whatsapp` | same | same |
| Anthropic inquiry agent | called from `core/agent/` | — | Gated by `AI_AUTO_REPLY_ENABLED` (strict `'true'`/`'false'` enum, not `z.coerce.boolean`) |
| Google Ads API | `apps/admin/api/cron/sync-google-ads` (GET) | `core/ads/sync.ts` | Vercel cron sends GET |
| GA4 Data API | `apps/admin/api/cron/sync-ga4` | `core/metrics/snapshots.ts` | stage 5 |
| NBP/ECB FX | `apps/admin/api/cron/fx-rates` | `core/finance/fx.ts` | stage 5 |

## 9. What is deliberately not in the architecture

Stripe Connect and payouts; a CMS in the database for blog or landing pages (they are
files); a CRM for brand partnerships (that is a Notion list); PostGIS (geo is computed
in JS on a handful of rows); real-time subscriptions (nothing needs them).
