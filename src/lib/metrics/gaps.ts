// Pure gap-detection functions for /admin/data-gaps (FA-1.36).
//
// "History is filled in" must be checkable, not judged by eye — these six functions are
// that check. A–D are the completion measure for FA-1.39 (0 = history complete); E and F
// are informational. No database access in this file (CLAUDE.md rule 3); rows in,
// booleans out. Booking is decided only via isBooked/rowCommissionEur from ./facts and
// ./commission (CLAUDE.md rule 7) — this file does not redefine either fact.

import type { Database } from '@/lib/supabase/database.types'
import { isBooked, type BookingRow } from './facts'
import { rowCommissionEur, type CommissionRow } from './commission'

type InquiryRow = Database['public']['Tables']['inquiries']['Row']

// Statuses/stages that mean "money moved" or "deal is over, but got this far" — the same
// vocabulary transition() and stageReachedFor() use (src/lib/inquiries/state.ts).
const BOOKED_STATUSES = new Set(['paid', 'handed_over', 'completed'])
const BOOKED_STAGES = new Set(['deposit_paid', 'completed'])
const OFFERED_STAGES = new Set(['offer_sent', 'deposit_paid', 'completed'])

// ─── A. Booking without a payment date ─────────────────────────────────────────

export type BookingWithoutDateRow = BookingRow &
  Pick<InquiryRow, 'status' | 'stage_reached'>

/**
 * A row that has reached a paid/booked state by status or by stage_reached, but carries
 * no deposit_paid_at. Checking `stage_reached` too (not just `status`) matters: a row can
 * sit on an old status while `stage_reached` already recorded `deposit_paid` (round-2 red
 * proof in gaps.test.ts).
 */
export function hasBookingWithoutDate(row: BookingWithoutDateRow): boolean {
  const reachedBooked = BOOKED_STATUSES.has(row.status) || BOOKED_STAGES.has(row.stage_reached)
  return reachedBooked && !isBooked(row)
}

// ─── B. Booking without an amount ──────────────────────────────────────────────

export type BookingWithoutAmountRow = BookingRow & CommissionRow

/** A paid booking whose commission computes to exactly zero — an amount nobody entered. */
export function hasBookingWithoutAmount(row: BookingWithoutAmountRow, usdEur: number): boolean {
  return isBooked(row) && rowCommissionEur(row, usdEur) === 0
}

// ─── C. Offer without a date ────────────────────────────────────────────────────

export type OfferWithoutDateRow = Pick<InquiryRow, 'stage_reached' | 'external_offer_sent' | 'offer_sent_at'>

/** An offer was reached (by stage or by the manual "sent externally" flag) but has no date. */
export function hasOfferWithoutDate(row: OfferWithoutDateRow): boolean {
  const offered = OFFERED_STAGES.has(row.stage_reached) || row.external_offer_sent
  return offered && row.offer_sent_at === null
}

// ─── D. Loss without a reason code ─────────────────────────────────────────────

export type LossWithoutReasonRow = Pick<InquiryRow, 'status' | 'lost_reason_code'>

export function hasLossWithoutReason(row: LossWithoutReasonRow): boolean {
  return row.status === 'lost' && row.lost_reason_code === null
}

// ─── E. Inquiry dated later than its first message ─────────────────────────────

export type ReceivedDateGapRow = Pick<InquiryRow, 'created_at'> & {
  /** occurred_at of the earliest non-draft message, or null when there is none. */
  firstMessageOccurredAt: string | null
}

/**
 * Same rule the inquiry card uses to show "This looks later than the first message —
 * correct the received date?" (src/app/admin/inquiries/[id]/page.tsx, FA-1.05 audit /
 * FA-1.38) — reused here rather than redefined, so the card and the counter can never
 * disagree.
 */
export function hasReceivedDateGap(row: ReceivedDateGapRow): boolean {
  return row.firstMessageOccurredAt !== null
    && new Date(row.firstMessageOccurredAt).getTime() < new Date(row.created_at).getTime()
}

// ─── F. Qualified = unknown ─────────────────────────────────────────────────────

export type QualifiedUnknownRow = Pick<InquiryRow, 'qualified'>

export function hasQualifiedUnknown(row: QualifiedUnknownRow): boolean {
  return row.qualified === 'unknown'
}
