// PERMANENT shared helper — see gaps.ts header.
import { describe, expect, it } from 'vitest'
import {
  hasBookingWithoutAmount,
  hasBookingWithoutDate,
  hasLossWithoutReason,
  hasOfferWithoutDate,
  hasQualifiedUnknown,
  hasReceivedDateGap,
  type BookingWithoutAmountRow,
  type BookingWithoutDateRow,
  type LossWithoutReasonRow,
  type OfferWithoutDateRow,
  type QualifiedUnknownRow,
  type ReceivedDateGapRow,
} from './gaps'

const USD_EUR = 0.92

// ─── A. Booking without a payment date ─────────────────────────────────────────

const bookingDateRow = (over: Partial<BookingWithoutDateRow>): BookingWithoutDateRow => ({
  deposit_paid_at: '2026-05-10T10:00:00Z',
  status: 'paid',
  stage_reached: 'deposit_paid',
  ...over,
})

describe('hasBookingWithoutDate (category A)', () => {
  it('flags a paid row with no deposit_paid_at', () => {
    expect(hasBookingWithoutDate(bookingDateRow({ status: 'paid', deposit_paid_at: null }))).toBe(true)
  })

  it('flags a row whose stage_reached is deposit_paid but status is stale, with no deposit_paid_at', () => {
    expect(
      hasBookingWithoutDate(
        bookingDateRow({ status: 'awaiting_payment', stage_reached: 'deposit_paid', deposit_paid_at: null }),
      ),
    ).toBe(true)
  })

  it('does not flag a complete booking', () => {
    expect(hasBookingWithoutDate(bookingDateRow({}))).toBe(false)
  })

  it('does not flag an open deal that never reached booked', () => {
    expect(
      hasBookingWithoutDate(
        bookingDateRow({ status: 'qualifying', stage_reached: 'inquiry', deposit_paid_at: null }),
      ),
    ).toBe(false)
  })

  // Acceptance criterion 2 (red proof): a rule narrowed to `status` alone misses the row
  // above, because `stage_reached` is where "deposit_paid" landed while `status` sat on
  // an older value — exactly the class of row `hasBookingWithoutDate` must also catch.
  it('red proof — a status-only rule misses the stage_reached case this function catches', () => {
    const narrowedToStatusOnly = (row: BookingWithoutDateRow): boolean =>
      ['paid', 'handed_over', 'completed'].includes(row.status) && row.deposit_paid_at === null

    const row = bookingDateRow({ status: 'awaiting_payment', stage_reached: 'deposit_paid', deposit_paid_at: null })

    expect(hasBookingWithoutDate(row)).toBe(true)
    expect(narrowedToStatusOnly(row)).toBe(false)
  })
})

// ─── B. Booking without an amount ──────────────────────────────────────────────

const bookingAmountRow = (over: Partial<BookingWithoutAmountRow>): BookingWithoutAmountRow => ({
  deposit_paid_at: '2026-05-10T10:00:00Z',
  offer_deposit_eur: 300,
  deposit_amount: null,
  internal_commission_eur: null,
  deal_currency: 'EUR',
  deposit_amount_cents: null,
  deposit_currency: null,
  deposit_eur_rate: null,
  ...over,
})

describe('hasBookingWithoutAmount (category B)', () => {
  it('flags a booked row whose commission computes to zero', () => {
    expect(
      hasBookingWithoutAmount(bookingAmountRow({ offer_deposit_eur: null }), USD_EUR),
    ).toBe(true)
  })

  it('does not flag a booked row with a real amount', () => {
    expect(hasBookingWithoutAmount(bookingAmountRow({}), USD_EUR)).toBe(false)
  })

  it('does not flag an unbooked row even with a zero amount', () => {
    expect(
      hasBookingWithoutAmount(bookingAmountRow({ deposit_paid_at: null, offer_deposit_eur: null }), USD_EUR),
    ).toBe(false)
  })
})

// ─── C. Offer without a date ────────────────────────────────────────────────────

const offerDateRow = (over: Partial<OfferWithoutDateRow>): OfferWithoutDateRow => ({
  stage_reached: 'offer_sent',
  external_offer_sent: false,
  offer_sent_at: '2026-05-01T09:00:00Z',
  ...over,
})

describe('hasOfferWithoutDate (category C)', () => {
  it('flags an offered stage with no offer_sent_at', () => {
    expect(hasOfferWithoutDate(offerDateRow({ offer_sent_at: null }))).toBe(true)
  })

  it('flags external_offer_sent = true with no offer_sent_at, regardless of stage', () => {
    expect(
      hasOfferWithoutDate(
        offerDateRow({ stage_reached: 'inquiry', external_offer_sent: true, offer_sent_at: null }),
      ),
    ).toBe(true)
  })

  it('does not flag a complete offer', () => {
    expect(hasOfferWithoutDate(offerDateRow({}))).toBe(false)
  })

  it('does not flag a row that never reached an offer', () => {
    expect(
      hasOfferWithoutDate(offerDateRow({ stage_reached: 'inquiry', offer_sent_at: null })),
    ).toBe(false)
  })
})

// ─── D. Loss without a reason code ─────────────────────────────────────────────

const lossRow = (over: Partial<LossWithoutReasonRow>): LossWithoutReasonRow => ({
  status: 'lost',
  lost_reason_code: 'price',
  ...over,
})

describe('hasLossWithoutReason (category D)', () => {
  it('flags a lost row with no lost_reason_code', () => {
    expect(hasLossWithoutReason(lossRow({ lost_reason_code: null }))).toBe(true)
  })

  it('does not flag a lost row with a reason code', () => {
    expect(hasLossWithoutReason(lossRow({}))).toBe(false)
  })

  it('does not flag a non-lost row with no reason code', () => {
    expect(hasLossWithoutReason(lossRow({ status: 'qualifying', lost_reason_code: null }))).toBe(false)
  })
})

// ─── E. Inquiry dated later than its first message ─────────────────────────────

const receivedDateRow = (over: Partial<ReceivedDateGapRow>): ReceivedDateGapRow => ({
  created_at: '2026-05-10T10:00:00Z',
  firstMessageOccurredAt: '2026-05-10T08:00:00Z',
  ...over,
})

describe('hasReceivedDateGap (category E)', () => {
  it('flags created_at later than the first message', () => {
    expect(hasReceivedDateGap(receivedDateRow({}))).toBe(true)
  })

  it('does not flag created_at at or before the first message', () => {
    expect(
      hasReceivedDateGap(
        receivedDateRow({ created_at: '2026-05-10T07:00:00Z', firstMessageOccurredAt: '2026-05-10T08:00:00Z' }),
      ),
    ).toBe(false)
  })

  it('does not flag a row with no messages yet', () => {
    expect(hasReceivedDateGap(receivedDateRow({ firstMessageOccurredAt: null }))).toBe(false)
  })
})

// ─── F. qualified = unknown ─────────────────────────────────────────────────────

const qualifiedRow = (over: Partial<QualifiedUnknownRow>): QualifiedUnknownRow => ({
  qualified: 'unknown',
  ...over,
})

describe('hasQualifiedUnknown (category F)', () => {
  it('flags qualified = unknown', () => {
    expect(hasQualifiedUnknown(qualifiedRow({}))).toBe(true)
  })

  it('does not flag qualified = yes or no', () => {
    expect(hasQualifiedUnknown(qualifiedRow({ qualified: 'yes' }))).toBe(false)
    expect(hasQualifiedUnknown(qualifiedRow({ qualified: 'no' }))).toBe(false)
  })
})
