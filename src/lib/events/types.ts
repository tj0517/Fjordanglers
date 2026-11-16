/**
 * Event type catalogue for `inquiry_events`.
 *
 * The canonical list is `docs/REBUILD_PLAN.md` Appendix C. Adding a type means adding
 * it there and here in the same PR (docs/01-architecture.md §3).
 *
 * Every event carries `channel` (where it happened) and `source` (how it reached the
 * table). An event is always a side effect of an action in the app — never a separate
 * "log it afterwards" step.
 */

// ─── Actor, channel, source ───────────────────────────────────────────────────

/** Who caused it. `actor_id` is the admin uid or the guide id; null for system/agent. */
export const ACTOR_KINDS = ['admin', 'guide', 'system', 'agent', 'angler'] as const
export type ActorKind = typeof ACTOR_KINDS[number]

/** Where it happened. Null for events with no channel of their own. */
export const EVENT_CHANNELS = ['email', 'whatsapp', 'instagram', 'stripe', 'app'] as const
export type EventChannel = typeof EVENT_CHANNELS[number]

/**
 * How the row got here. Metrics must be able to tell an event the app produced from
 * one a backfill guessed, so this is never optional.
 */
export const EVENT_SOURCES = ['app', 'webhook', 'cron', 'backfill'] as const
export type EventSource = typeof EVENT_SOURCES[number]

// ─── Types emitted from stage 1 ───────────────────────────────────────────────

const EMITTED_EVENT_TYPES = [
  'inquiry.created',          // core.inquiries.create
  'inquiry.qualified_set',    // classification + correction (FA-1.04)
  'message.sent',             // sending from the thread (FA-1.12)
  'message.received',         // webhooks + matching from unmatched_messages (FA-1.12)
  'guide.contacted',          // first outbound message to a guide on this inquiry (FA-1.12)
  'guide.offer_received',     // admin marks an inbound guide message as "this is the offer" (FA-1.12)
  'offer.presented',          // outbound message to the angler marked "presents an offer" (FA-1.12)
  'offer.accepted',           // admin marks the angler's answer (FA-1.12)
  'offer.declined',           // as above; leads to inquiry.lost (FA-1.12)
  'offer.updated',            // admin edits the offer's options in place (FA-1.74); payload: offer_id, before, after
  'offer.reverted',           // admin steps the offer back (FA-1.76): accepted→presented, presented→draft, declined→draft; payload: offer_id, from, to (+ option_id, link_id, deposit_cleared)
  'offer.superseded',         // admin replaces a declined offer with a new one (FA-1.76); payload: offer_id, superseded_by
  'payment.link_sent',        // Stripe Payment Link generated from the app (FA-1.12); payload: amount_cents, currency, link_id (+ product_id, name, description from FA-1.77)
  'payment.link_details_updated', // admin renames the active link's Stripe product, URL unchanged (FA-1.77); payload: link_id, product_id, before, after
  'payment.received',         // checkout.session.completed webhook; UnmatchedLinker as fallback
  'guide.notified_paid',      // message to the guide marked "told about the deposit" (FA-1.12)
  'contacts.exchanged',       // contacts sent to both sides (FA-1.12)
  'status.changed',           // transition()
  'inquiry.lost',             // transition('lost') with a lost_reason_code
  'trip.completed',           // trip finished
  'agent.auto_send_decided',  // hybrid auto-send decision: score, send, reasons (FA-1.27)
  'deposit.amount_set',       // admin sets deposit amount (FA-1.28); payload: amount_cents, currency, eur_rate, eur_rate_at
  'inquiry.history_corrected', // admin corrects a past fact by hand (FA-1.38, correctReceivedDate); payload: field, from, to
  'review.requested',         // admin generates a review link (FA-1.59); payload: experience_id
  'review.submitted',         // angler submits the review (FA-1.59); payload: publish_consent
  // Guide requests (FA-M.03) — written by the DB functions in 20261117000000_add_guide_requests.sql,
  // in the same transaction as the change (tj D3 a). No token or link in any payload; the guide's
  // note never leaves guide_requests (only has_note).
  'guide.request_sent',       // create_guide_request; actor admin, channel = request channel; payload: request_id, guide_id, channel, expires_at
  'guide.request_opened',     // first opening of the link only; actor guide, channel app; payload: request_id, guide_id
  'guide.request_answered',   // actor guide, channel app; payload: request_id, guide_id, answer (accepted|declined|other_dates), alt_dates, has_note.
                              // Variant WITHOUT request_id (allowed): dashboard answer to an assignment from before FA-M.03 (no request record; tj D2 b) — payload: guide_id, answer, alt_dates ([]), has_note
  'guide.request_withdrawn',  // withdraw_guide_request (FA-M.05 calls it); actor admin, channel app; payload: request_id, guide_id, was_answered
] as const

// ─── Reserved — no emitter yet ────────────────────────────────────────────────
//
// Listed so the catalogue is one list, not two. The stage comments say where the
// emitter is planned in REBUILD_PLAN.md §8; they are a plan, not a promise.

const RESERVED_EVENT_TYPES = [
  'agent.round_completed',   // stage 1 — FA-1.14 (agent in the thread)
  'offer.viewed',            // stage 1 — FA-1.12 (offers table)
  'inquiry.brief_completed', // stage 4 — brief replaces inquiry_trip_details
  'guide.assigned',          // stage 4
  'guide.unassigned',        // stage 4
  'guide.accepted',          // not emitted — FA-M.03 D1 (a): guide.request_answered carries the answer
  'guide.declined',          // not emitted — FA-M.03 D1 (a): guide.request_answered carries the answer
  'incident.opened',         // stage 6 — /quality (M16)
  'incident.resolved',       // stage 6 — /quality (M16)
] as const

export const EVENT_TYPES = [...EMITTED_EVENT_TYPES, ...RESERVED_EVENT_TYPES] as const

export type EventType = typeof EVENT_TYPES[number]

const EVENT_TYPE_SET: ReadonlySet<string> = new Set<string>(EVENT_TYPES)

export function isEventType(value: string): value is EventType {
  return EVENT_TYPE_SET.has(value)
}

/**
 * A "manual touch" (metric M11): an admin doing one of these by hand on an inquiry.
 * Reads and page views are not touches.
 */
export const MANUAL_TOUCH_EVENT_TYPES: readonly EventType[] = [
  'message.sent',
  'status.changed',
  'payment.link_sent',
  'contacts.exchanged',
  'offer.updated',            // tj D-B 2026-10-27 — REBUILD_PLAN M11 "edycja oferty"
]
