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

## 4. Inquiry state machine

Statuses describe **who we are waiting for**, not a step in a linear pipeline, because the
angler and the guide conversations run in parallel and loop.

```
new ─▶ qualifying ◀─▶ waiting_guide ◀─▶ offer_presented ─▶ awaiting_payment ─▶ paid
                                                                                  │
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
directions (angler changes dates after seeing an offer → back to the guide). The money
path is strict: `paid` is reachable **only** from `awaiting_payment`; `awaiting_payment`
only from `offer_presented`.

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
