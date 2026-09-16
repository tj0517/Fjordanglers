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
Events are never a separate manual step: they are a side effect of sending, receiving,
transitioning or paying. If a fact can only reach the table by someone "logging it later",
the design is wrong — the action itself has to happen in the app.

```
inquiry_events(id, inquiry_id, type, from_status, to_status,
               actor_kind ∈ {admin,guide,system,agent,angler}, actor_id,
               channel ∈ {email,whatsapp,instagram,stripe,app} NULL,   -- where it happened
               source  ∈ {app,webhook,cron,backfill},                   -- how it got here
               message_id → messages.id NULL,                           -- for message.* types
               payload jsonb, occurred_at, created_at)      -- append-only, no UPDATE/DELETE policy
```

`source` matters for the next months: metrics must be able to tell an event the app
produced from one a backfill guessed. The event type catalogue is `REBUILD_PLAN.md`
Appendix C. Adding a type means adding it there and in `src/lib/events/types.ts` in the
same PR. `occurred_at` is separate from `created_at` so backfills can carry the real time.

This table exists from stage 1 and is written to **before anything reads it**.

## 3a. Messages — one thread per inquiry, every channel

```
messages(id, inquiry_id, channel ∈ {email,whatsapp,instagram},
         direction ∈ {inbound,outbound},
         counterpart ∈ {angler,guide}, counterpart_id NULL,     -- guide id when known
         external_id UNIQUE NULL,                                -- provider message id (idempotency)
         thread_key NULL,                                        -- email Message-ID chain / wa conversation
         body, subject NULL, media jsonb,
         status ∈ {draft,queued,sent,delivered,read,failed,received},
         sent_by NULL,                                           -- admin uid for outbound
         drafted_by ∈ {admin,agent} NULL,                        -- who wrote the text
         occurred_at, created_at)
```

The inquiry page shows this thread and is the only place messages are written or sent.
Channel adapters live in `src/lib/channels/<channel>.ts` and expose the same interface
(`send`, `parseInbound`, `canSendFreeform`); the WhatsApp adapter enforces Meta's 24-hour
window (outside it, `send` requires a template). The Instagram adapter implements the
interface but stays disabled until Meta app review — absence of keys is a config state,
not an error. Inbound that cannot be matched to an inquiry lands in `unmatched_messages`
and is matched from the app, which then moves it to `messages` and emits `message.received`.

`lead_messages` and `inquiry_messages` are migrated into `messages` and dropped in stage 1.

## 3b. Offers — a separate object, several options

An offer is what the guide proposed for this inquiry, and it usually comes with
variants (3 days / 5 days, lodge / camp). It is **not** a set of `offer_*` columns on
`inquiries` (those are legacy, dropped in stage 4).

```
offers(id, inquiry_id, guide_id NULL, source_message_id → messages.id NULL,
       status ∈ {draft,presented,accepted,declined,superseded}, notes, created_by, created_at)
offer_options(id, offer_id, label, price_cents, currency, date_from NULL, date_to NULL,
              party_size NULL, includes jsonb, notes, is_accepted bool default false)
```

Marking an inbound guide message as "this is the offer" creates an `offers` row with its
options typed in by the admin; presenting it to the angler emits `offer.presented`
(`payload.offer_id`); the angler's answer marks one option `is_accepted` and emits
`offer.accepted` (`payload.option_id`). A new offer for the same inquiry supersedes the
previous one; history stays.

## 4. Inquiry state machine

Statuses describe **who we are waiting for**, not a step in a linear pipeline, because the
angler and the guide conversations run in parallel and loop.

```
new ─▶ qualifying ◀─▶ waiting_guide ◀─▶ offer_presented ─▶ awaiting_payment ─▶ paid
 └─────────────────▶ waiting_guide  (lead arrives with a complete brief)          │
                                                                     handed_over ◀┘ ─▶ completed
any non-terminal ─▶ lost | cancelled
```

| status | meaning | typical trigger |
|---|---|---|
| `new` | landed, nobody replied yet | `inquiry.created` |
| `qualifying` | we asked the angler something (dates, party, budget) | outbound to angler |
| `waiting_guide` | we asked a guide for availability/price | outbound to guide |
| `offer_presented` | angler has a concrete offer | `offer.presented` |
| `awaiting_payment` | payment link sent | `payment.link_sent` |
| `paid` | deposit received | `payment.received` |
| `handed_over` | guide notified, contacts exchanged | `contacts.exchanged` |
| `completed` | trip happened | `trip.completed` |
| `lost` / `cancelled` | terminal | `inquiry.lost` / manual |

Loops between `qualifying`, `waiting_guide` and `offer_presented` are allowed in both
directions, all three ways (angler changes dates after seeing an offer → back to the
guide), and `awaiting_payment` can fall back into that loop while nobody has paid yet.
The money path is strict: `paid` is reachable **only** from `awaiting_payment`;
`awaiting_payment` only from `offer_presented`; `completed` only through `handed_over`.

`transition(client, inquiryId, to, { actor, reason, channel? })` in
`src/lib/inquiries/state.ts` validates the edge, updates `status`, recomputes
`stage_reached`, emits `status.changed`. Webhooks, the agent, the admin `StatusChanger`
and any cron call the same function. Sending a message from the thread may propose a
transition (outbound to guide → `waiting_guide`) but the admin confirms it in the same
click — no silent status changes from messaging.

### 4.1 Mapping from the ten legacy statuses (migration, one-off)

| legacy | new |
|---|---|
| `pending` | `new` |
| `in_negotiation` | `qualifying` |
| `waiting_for_guide_offer` | `waiting_guide` |
| `offer_sent` | `offer_presented` |
| `waiting_for_deposit`, `deposit_sent` | `awaiting_payment` |
| `deposit_paid` | `paid` |
| `completed` | `completed` |
| `lost`, `cancelled` | unchanged |

Legacy values are kept in the enum as deprecated until the backfill (FA-1.05) has run and
no row uses them; then dropped in stage 4.

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
