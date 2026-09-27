// PERMANENT shared helper — see facts.ts header.
import { describe, expect, it } from 'vitest'
import { STATUSES } from '@/lib/inquiries/state'
import { OPEN_DEAL_STATUSES, bookedAt, isBooked, type BookingRow } from './facts'

describe('isBooked', () => {
  it('is true only when deposit_paid_at is set', () => {
    expect(isBooked({ deposit_paid_at: '2026-05-10T10:00:00Z' })).toBe(true)
    expect(isBooked({ deposit_paid_at: null })).toBe(false)
  })

  // Acceptance criterion 1 (red proof): switching isBooked's body to a status check
  // (`row.status === 'paid'`) makes this fail, because deposit_paid_at is the only
  // fact allowed to decide a booking (CLAUDE.md rule 7).
  it('an inquiry with status `paid` and deposit_paid_at = null is not a booking', () => {
    const row: BookingRow & { status: string } = { status: 'paid', deposit_paid_at: null }
    expect(isBooked(row)).toBe(false)
  })

  it('is true for a deposit_paid_at row regardless of a non-paid status', () => {
    const row: BookingRow & { status: string } = { status: 'awaiting_payment', deposit_paid_at: '2026-05-10T10:00:00Z' }
    expect(isBooked(row)).toBe(true)
  })
})

describe('bookedAt', () => {
  it('returns deposit_paid_at, or null when unbooked', () => {
    expect(bookedAt({ deposit_paid_at: '2026-05-10T10:00:00Z' })).toBe('2026-05-10T10:00:00Z')
    expect(bookedAt({ deposit_paid_at: null })).toBeNull()
  })
})

describe('OPEN_DEAL_STATUSES', () => {
  it('is exactly the non-paid, non-terminal statuses', () => {
    expect([...OPEN_DEAL_STATUSES].sort()).toEqual(
      ['new', 'qualifying', 'waiting_guide', 'offer_presented', 'awaiting_payment'].sort(),
    )
  })

  it('excludes paid, handed_over, completed, lost and cancelled', () => {
    for (const closed of ['paid', 'handed_over', 'completed', 'lost', 'cancelled'] as const) {
      expect(OPEN_DEAL_STATUSES).not.toContain(closed)
    }
  })

  it('is a subset of STATUSES with no extra values', () => {
    for (const s of OPEN_DEAL_STATUSES) expect(STATUSES).toContain(s)
  })
})
