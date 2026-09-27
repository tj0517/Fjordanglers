/**
 * Backfilled history — FA-1.37.
 *
 * `recordPastPayment` is the one way to tell the app about a deposit that was already
 * paid, with its real date, instead of every status click stamping "now". It bypasses
 * `transition()` and `ALLOWED_TRANSITIONS` on purpose: O-25 (tj, 2026-09-27) allows the
 * historical jump straight to `paid`/`completed` for every inquiry, marked `backfill`,
 * because a past booking did not travel through the app's own state machine.
 *
 * Order matches `transition()`: compare-and-set write → events → rollback on event
 * failure. `deposit_paid_at IS NULL` is the idempotency gate, same as the Stripe
 * webhook (src/app/api/webhooks/stripe-deposit/route.ts) — correcting an existing
 * payment is out of scope (separate task, docs/deferred-tasks.md).
 */

import { emitEvent, type EventActor, type EventClient } from '@/lib/events/emit'
import { fetchEurRateOn } from '@/lib/fx'
import { isDepositCurrency } from '@/lib/inquiries/deposit'
import { stageReachedFor, isLostReasonCode, LOST_REASON_CODE_KEYS } from '@/lib/inquiries/state'

type PastPaymentFinalStatus = 'paid' | 'completed'

export interface RecordPastPaymentInput {
  /** Warsaw calendar date the payment actually landed, 'YYYY-MM-DD'. Never in the future. */
  paidOn:      string
  amountCents: number
  currency:    string
  finalStatus: PastPaymentFinalStatus
  note?:       string | null
  actor:       EventActor
}

export interface RecordPastPaymentResult {
  from: string
  to:   PastPaymentFinalStatus
}

export class HistoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HistoryError'
  }
}

// ─── Stripe dependency (injected, never imported at module scope) ─────────────
//
// A live payment link (FA-1.29) surviving a backfilled payment would let the angler
// also pay through Stripe with nobody noticing (the webhook silently no-ops on an
// already-set deposit_paid_at). The Stripe call is a constructor parameter, not a
// top-level import, so a test can never reach the real network by omission — only by
// deliberately wiring the real implementation in.

export interface RecordPastPaymentDeps {
  deactivatePaymentLink: (linkId: string) => Promise<void>
}

const liveDeps: RecordPastPaymentDeps = {
  async deactivatePaymentLink(linkId) {
    const { stripe } = await import('@/lib/stripe/client')
    await stripe.paymentLinks.update(linkId, { active: false })
  },
}

// ─── Date helpers ───────────────────────────────────────────────────────────────
//
// Exported so every caller that stamps a historical date — recordPastPayment/Offer/Loss,
// correctReceivedDate, and createInquiry's optional receivedOn (FA-1.38) — shares one
// notion of "today" and one instant-of-a-calendar-day, instead of five reimplementations.

/** Today's calendar date in Europe/Warsaw, 'YYYY-MM-DD'. */
export function warsawToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
}

/** Strict 'YYYY-MM-DD' parse — rejects both malformed strings and non-existent dates (e.g. Feb 30). */
function parseIsoDateStrict(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (m == null) return false
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const dt = new Date(Date.UTC(year, month - 1, day))
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day
}

/** UTC noon on the given calendar date — always lands on the same Warsaw calendar day (offset ≤ +2). */
export function instantOf(paidOn: string): string {
  return new Date(`${paidOn}T12:00:00.000Z`).toISOString()
}

/** Throws HistoryError unless `dateStr` is a real calendar date not later than today (Warsaw). */
export function assertNotFutureDate(dateStr: string, label: string): void {
  if (!parseIsoDateStrict(dateStr)) {
    throw new HistoryError(`Invalid date ${JSON.stringify(dateStr)} — expected YYYY-MM-DD`)
  }
  const today = warsawToday()
  if (dateStr > today) {
    throw new HistoryError(`${label} ${dateStr} is in the future (today is ${today} in Europe/Warsaw)`)
  }
}

// ─── recordPastPayment ────────────────────────────────────────────────────────

export async function recordPastPayment(
  client: EventClient,
  inquiryId: string,
  input: RecordPastPaymentInput,
  deps: RecordPastPaymentDeps = liveDeps,
): Promise<RecordPastPaymentResult> {
  const { paidOn, amountCents, finalStatus, actor } = input
  const note = input.note?.trim() ?? ''

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new HistoryError('Amount must be a positive integer (minor units)')
  }
  if (finalStatus !== 'paid' && finalStatus !== 'completed') {
    throw new HistoryError(`Unknown final status ${JSON.stringify(finalStatus)} — must be paid or completed`)
  }
  const currency = input.currency.toUpperCase()
  if (!isDepositCurrency(currency)) {
    throw new HistoryError(`Currency ${currency} not supported (allowed: EUR, USD, ISK, NZD)`)
  }
  if (!parseIsoDateStrict(paidOn)) {
    throw new HistoryError(`Invalid date ${JSON.stringify(paidOn)} — expected YYYY-MM-DD`)
  }
  const today = warsawToday()
  if (paidOn > today) {
    throw new HistoryError(`Payment date ${paidOn} is in the future (today is ${today} in Europe/Warsaw)`)
  }

  const { data: current, error: readError } = await client
    .from('inquiries')
    .select('id, status, deposit_paid_at, deposit_payment_link_id, deposit_amount_cents, deposit_currency, deposit_eur_rate, deposit_eur_rate_at')
    .eq('id', inquiryId)
    .maybeSingle()

  if (readError != null) {
    throw new HistoryError(`Could not read inquiry ${inquiryId}: ${readError.message}`)
  }
  if (current == null) {
    throw new HistoryError(`Inquiry ${inquiryId} not found`)
  }
  if (current.deposit_paid_at != null) {
    throw new HistoryError(
      `Inquiry ${inquiryId} already has a deposit recorded (${current.deposit_paid_at}) — correcting an existing payment is out of scope`,
    )
  }

  const fromStatus = current.status
  const originalAmountCents = current.deposit_amount_cents
  const originalCurrency    = current.deposit_currency
  const originalEurRate     = current.deposit_eur_rate
  const originalEurRateAt   = current.deposit_eur_rate_at

  let eurRate: number
  if (currency === 'EUR') {
    eurRate = 1
  } else {
    const rate = await fetchEurRateOn(paidOn, currency)
    if (rate == null) {
      throw new HistoryError(`Could not fetch the EUR/${currency} rate for ${paidOn} — try again in a moment`)
    }
    eurRate = rate
  }

  // A live Stripe link must die before the DB write: once deposit_paid_at is set, the
  // stripe-deposit webhook silently no-ops on a real Stripe payment, so a still-active
  // link would let the angler pay twice with nobody noticing. If Stripe refuses, refuse
  // too — nothing has been written yet, so there is nothing to roll back.
  if (current.deposit_payment_link_id != null) {
    try {
      await deps.deactivatePaymentLink(current.deposit_payment_link_id)
    } catch (linkError) {
      throw new HistoryError(
        `Could not deactivate the active payment link — refusing to record the payment: ${(linkError as Error).message}`,
      )
    }
  }

  const paidOnInstant = instantOf(paidOn)
  const stage = stageReachedFor(finalStatus)

  // Compare-and-set on deposit_paid_at, same idempotency gate as the Stripe webhook.
  // stage_reached is deliberately NOT set here — it only advances (trigger
  // inquiries_stage_must_advance) so it cannot be undone if the events below fail;
  // it is written only once the events are safely in inquiry_events.
  const { data: updated, error: updateError } = await client
    .from('inquiries')
    .update({
      status:                    finalStatus,
      deposit_paid_at:           paidOnInstant,
      deposit_amount_cents:      amountCents,
      deposit_currency:          currency,
      deposit_eur_rate:          eurRate,
      deposit_eur_rate_at:       paidOnInstant,
      // The link (if any) is already dead in Stripe by this point — never restored.
      deposit_payment_link_id:   null,
      deposit_payment_link_url:  null,
    })
    .eq('id', inquiryId)
    .is('deposit_paid_at', null)
    .select('id')
    .maybeSingle()

  if (updateError != null) {
    throw new HistoryError(`Could not record the payment on ${inquiryId}: ${updateError.message}`)
  }
  if (updated == null) {
    throw new HistoryError(
      `Inquiry ${inquiryId} already has a deposit recorded — it changed underneath us. Reload and try again.`,
    )
  }

  try {
    await emitEvent(client, {
      inquiryId,
      type:       'status.changed',
      actor,
      source:     'backfill',
      channel:    'app',
      fromStatus,
      toStatus:   finalStatus,
      payload:    { historical: true, ...(note !== '' ? { note } : {}) },
      occurredAt: paidOnInstant,
    })
    await emitEvent(client, {
      inquiryId,
      type:       'payment.received',
      actor,
      source:     'backfill',
      channel:    'app',
      payload:    { amount_cents: amountCents, currency, historical: true },
      occurredAt: paidOnInstant,
    })
  } catch (eventError) {
    // Put the payment columns back exactly as they were — an awaiting_payment inquiry
    // often already has FA-1.28 amount columns set (setDepositAmount), so "back to
    // null" would destroy real data. The Stripe deactivation above is not undone: it
    // already happened for real, so leaving the link columns null still matches
    // reality. An unlogged payment would quietly corrupt every commission and booking
    // metric (CLAUDE.md rule 5), so the status/deposit_paid_at change cannot stand.
    await client
      .from('inquiries')
      .update({
        status:               fromStatus,
        deposit_paid_at:      null,
        deposit_amount_cents: originalAmountCents,
        deposit_currency:     originalCurrency,
        deposit_eur_rate:     originalEurRate,
        deposit_eur_rate_at:  originalEurRateAt,
      })
      .eq('id', inquiryId)
      .eq('status', finalStatus)
    throw new HistoryError(
      `Could not record the payment events, so it was rolled back: ${(eventError as Error).message}`,
    )
  }

  // Both events are durably written — now it is safe to advance the legacy
  // stage_reached cache. Best-effort: it is a read-only funnel cache (state.ts), not
  // part of the domain state the events above already made durable, so a failure here
  // is logged, not thrown.
  if (stage != null) {
    const { error: stageError } = await client
      .from('inquiries')
      .update({ stage_reached: stage })
      .eq('id', inquiryId)
    if (stageError != null) {
      console.error(`[recordPastPayment] Could not advance stage_reached for ${inquiryId}:`, stageError.message)
    }
  }

  return { from: fromStatus, to: finalStatus }
}

// ─── recordPastOffer — FA-1.38 ─────────────────────────────────────────────────

export interface RecordPastOfferInput {
  /** Warsaw calendar date the offer was actually sent, 'YYYY-MM-DD'. Never in the future. */
  sentOn: string
  actor:  EventActor
}

export interface RecordPastOfferResult {
  sentAt: string
}

/**
 * Admin tells the app a real offer date that the app never recorded (FA-1.05 audit:
 * 24 rows with `external_offer_sent=true` and `offer_sent_at IS NULL` — nothing in the
 * app writes this column today). `offer_sent_at IS NULL` is the idempotency gate;
 * correcting an already-recorded date is out of scope (separate task).
 */
export async function recordPastOffer(
  client: EventClient,
  inquiryId: string,
  input: RecordPastOfferInput,
): Promise<RecordPastOfferResult> {
  const { sentOn, actor } = input
  assertNotFutureDate(sentOn, 'Offer date')

  const { data: current, error: readError } = await client
    .from('inquiries')
    .select('id, offer_sent_at')
    .eq('id', inquiryId)
    .maybeSingle()

  if (readError != null) {
    throw new HistoryError(`Could not read inquiry ${inquiryId}: ${readError.message}`)
  }
  if (current == null) {
    throw new HistoryError(`Inquiry ${inquiryId} not found`)
  }
  if (current.offer_sent_at != null) {
    throw new HistoryError(
      `Inquiry ${inquiryId} already has an offer date recorded (${current.offer_sent_at}) — correcting an existing date is out of scope`,
    )
  }

  const sentAt = instantOf(sentOn)

  const { data: updated, error: updateError } = await client
    .from('inquiries')
    .update({ offer_sent_at: sentAt })
    .eq('id', inquiryId)
    .is('offer_sent_at', null)
    .select('id')
    .maybeSingle()

  if (updateError != null) {
    throw new HistoryError(`Could not record the offer date on ${inquiryId}: ${updateError.message}`)
  }
  if (updated == null) {
    throw new HistoryError(
      `Inquiry ${inquiryId} already has an offer date recorded — it changed underneath us. Reload and try again.`,
    )
  }

  try {
    await emitEvent(client, {
      inquiryId,
      type:       'offer.presented',
      actor,
      source:     'backfill',
      channel:    'app',
      payload:    { historical: true },
      occurredAt: sentAt,
    })
  } catch (eventError) {
    await client
      .from('inquiries')
      .update({ offer_sent_at: null })
      .eq('id', inquiryId)
      .eq('offer_sent_at', sentAt)
    throw new HistoryError(
      `Could not record the offer-presented event, so it was rolled back: ${(eventError as Error).message}`,
    )
  }

  // The event is durably written — now it is safe to advance the legacy stage_reached
  // cache. Best-effort, same reasoning as recordPastPayment: the trigger only ever lets
  // it move forward, so a failure here cannot undo the durable event above.
  const { error: stageError } = await client
    .from('inquiries')
    .update({ stage_reached: 'offer_sent' })
    .eq('id', inquiryId)
  if (stageError != null) {
    console.error(`[recordPastOffer] Could not advance stage_reached for ${inquiryId}:`, stageError.message)
  }

  return { sentAt }
}

// ─── recordPastLoss — FA-1.38 ──────────────────────────────────────────────────

export interface RecordPastLossInput {
  /** Warsaw calendar date the deal was actually lost, 'YYYY-MM-DD'. Never in the future. */
  lostOn:         string
  lostReasonCode: string
  note?:          string | null
  actor:          EventActor
}

export interface RecordPastLossResult {
  from: string
  to:   'lost'
}

/**
 * Admin marks a past loss with its real date, jumping straight to `lost` from any
 * status — bypassing `transition()` and `ALLOWED_TRANSITIONS` on purpose, same as
 * `recordPastPayment`: a past loss did not travel through the app's own state machine
 * either. Blocked once a deposit is already recorded (a paid deal cannot retroactively
 * become lost) or the inquiry is already lost.
 */
export async function recordPastLoss(
  client: EventClient,
  inquiryId: string,
  input: RecordPastLossInput,
): Promise<RecordPastLossResult> {
  const { lostOn, lostReasonCode, actor } = input
  const note = input.note?.trim() ?? ''

  assertNotFutureDate(lostOn, 'Loss date')
  if (!isLostReasonCode(lostReasonCode)) {
    throw new HistoryError(
      `Unknown loss reason ${JSON.stringify(lostReasonCode)} — must be one of ${LOST_REASON_CODE_KEYS.join(', ')}`,
    )
  }

  const { data: current, error: readError } = await client
    .from('inquiries')
    .select('id, status, deposit_paid_at, lost_reason_code, lost_reason')
    .eq('id', inquiryId)
    .maybeSingle()

  if (readError != null) {
    throw new HistoryError(`Could not read inquiry ${inquiryId}: ${readError.message}`)
  }
  if (current == null) {
    throw new HistoryError(`Inquiry ${inquiryId} not found`)
  }
  if (current.deposit_paid_at != null) {
    throw new HistoryError(
      `Inquiry ${inquiryId} already has a deposit recorded (${current.deposit_paid_at}) — cannot mark it lost`,
    )
  }
  if (current.status === 'lost') {
    throw new HistoryError(`Inquiry ${inquiryId} is already lost`)
  }

  const fromStatus         = current.status
  const originalReasonCode = current.lost_reason_code
  const originalReason     = current.lost_reason
  const lostAt             = instantOf(lostOn)

  const { data: updated, error: updateError } = await client
    .from('inquiries')
    .update({
      status:           'lost',
      lost_reason_code: lostReasonCode,
      lost_reason:      note !== '' ? note : null,
    })
    .eq('id', inquiryId)
    .eq('status', fromStatus)
    .is('deposit_paid_at', null)
    .select('id')
    .maybeSingle()

  if (updateError != null) {
    throw new HistoryError(`Could not mark ${inquiryId} lost: ${updateError.message}`)
  }
  if (updated == null) {
    throw new HistoryError(
      `Inquiry ${inquiryId} changed underneath us — it is no longer ${fromStatus}, or a deposit landed. Reload and try again.`,
    )
  }

  try {
    await emitEvent(client, {
      inquiryId,
      type:       'status.changed',
      actor,
      source:     'backfill',
      channel:    'app',
      fromStatus,
      toStatus:   'lost',
      payload:    { historical: true, ...(note !== '' ? { note } : {}) },
      occurredAt: lostAt,
    })
    await emitEvent(client, {
      inquiryId,
      type:       'inquiry.lost',
      actor,
      source:     'backfill',
      channel:    'app',
      payload:    { lost_reason_code: lostReasonCode, historical: true, ...(note !== '' ? { note } : {}) },
      occurredAt: lostAt,
    })
  } catch (eventError) {
    // Put the status and loss reason back exactly as they were — an unlogged loss would
    // quietly corrupt the loss-reason breakdown (CLAUDE.md rule 5).
    await client
      .from('inquiries')
      .update({
        status:           fromStatus,
        lost_reason_code: originalReasonCode,
        lost_reason:      originalReason,
      })
      .eq('id', inquiryId)
      .eq('status', 'lost')
    throw new HistoryError(
      `Could not record the loss events, so it was rolled back: ${(eventError as Error).message}`,
    )
  }

  // stage_reached is deliberately left untouched: lost/cancelled keep the funnel cache
  // where it was (state.ts STAGE_BY_STATUS), same as transition('lost').
  return { from: fromStatus, to: 'lost' }
}

// ─── correctReceivedDate — FA-1.38 ─────────────────────────────────────────────

export interface CorrectReceivedDateInput {
  /** Warsaw calendar date the inquiry actually arrived, 'YYYY-MM-DD'. Never in the
   *  future, and must be earlier than the current `created_at`. */
  receivedOn: string
  actor:      EventActor
}

export interface CorrectReceivedDateResult {
  from: string
  to:   string
}

/**
 * Corrects `created_at` to an earlier real date (FA-1.05 audit: 7 rows where the record
 * was typed in after the first message, so `created_at` reads later than the angler
 * actually arrived). Only allowed earlier than the current value — this is a one-way
 * correction toward the truth, not a general edit; moving it later is a different
 * mistake and out of scope.
 */
export async function correctReceivedDate(
  client: EventClient,
  inquiryId: string,
  input: CorrectReceivedDateInput,
): Promise<CorrectReceivedDateResult> {
  const { receivedOn, actor } = input
  assertNotFutureDate(receivedOn, 'Received date')

  const { data: current, error: readError } = await client
    .from('inquiries')
    .select('id, created_at')
    .eq('id', inquiryId)
    .maybeSingle()

  if (readError != null) {
    throw new HistoryError(`Could not read inquiry ${inquiryId}: ${readError.message}`)
  }
  if (current == null) {
    throw new HistoryError(`Inquiry ${inquiryId} not found`)
  }

  const originalCreatedAt = current.created_at
  const newCreatedAt      = instantOf(receivedOn)

  if (new Date(newCreatedAt).getTime() >= new Date(originalCreatedAt).getTime()) {
    throw new HistoryError(
      `Received date ${receivedOn} is not earlier than the current received date (${originalCreatedAt})`,
    )
  }

  const { data: updated, error: updateError } = await client
    .from('inquiries')
    .update({ created_at: newCreatedAt })
    .eq('id', inquiryId)
    .eq('created_at', originalCreatedAt)
    .select('id')
    .maybeSingle()

  if (updateError != null) {
    throw new HistoryError(`Could not correct the received date on ${inquiryId}: ${updateError.message}`)
  }
  if (updated == null) {
    throw new HistoryError(
      `Inquiry ${inquiryId} changed underneath us — it is no longer at ${originalCreatedAt}. Reload and try again.`,
    )
  }

  try {
    await emitEvent(client, {
      inquiryId,
      type:       'inquiry.history_corrected',
      actor,
      source:     'backfill',
      channel:    'app',
      payload:    { field: 'created_at', from: originalCreatedAt, to: newCreatedAt },
      occurredAt: newCreatedAt,
    })
  } catch (eventError) {
    await client
      .from('inquiries')
      .update({ created_at: originalCreatedAt })
      .eq('id', inquiryId)
      .eq('created_at', newCreatedAt)
    throw new HistoryError(
      `Could not record the correction event, so it was rolled back: ${(eventError as Error).message}`,
    )
  }

  return { from: originalCreatedAt, to: newCreatedAt }
}
