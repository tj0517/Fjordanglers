import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { InquiriesCalendar } from './InquiriesCalendar'
import type { InquiryRow } from './InquiriesClient'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<InquiryRow> = {}): InquiryRow {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: 'test-1',
    status: 'new',
    angler_name: 'Test Angler',
    angler_email: 'test@example.com',
    angler_phone: null,
    requested_dates: [today],
    party_size: 1,
    created_at: today,
    trip_id: null,
    experience_page_id: null,
    internal_commission_eur: null,
    deal_currency: null,
    lost_reason: null,
    last_contact_at: null,
    next_action: null,
    assigned_guide_id: null,
    guide_acceptance: null,
    guide_decline_reason: null,
    external_offer_sent: false,
    offer_sent_at: null,
    source: null,
    qualified: 'unknown',
    trip_country: null,
    ...overrides,
  }
}

describe('InquiriesCalendar', () => {
  // Criterion 6: calendar renders only what it receives, no internal filtering.
  it('renders a status dot for every row in the rows prop', () => {
    const row = makeRow({ status: 'lost' })
    const html = renderToStaticMarkup(
      <InquiriesCalendar rows={[row]} tripMap={{}} slugMap={{}} />
    )
    // The status dot for 'lost' must appear.
    // If the calendar filtered out 'lost' rows internally, this assertion would fail.
    expect(html).toContain('data-status="lost"')
  })

  it('renders no status dots when rows is empty', () => {
    const html = renderToStaticMarkup(
      <InquiriesCalendar rows={[]} tripMap={{}} slugMap={{}} />
    )
    expect(html).not.toContain('cal-status-dot')
  })

  it('renders a dot for each status without filtering by group or tab', () => {
    // One row per status, each on a distinct date in the current month.
    // If the calendar filtered by status/group internally, some would disappear.
    const statuses = ['new', 'qualifying', 'waiting_guide', 'paid', 'cancelled'] as const
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const rows = statuses.map((status, i) => {
      const day = String(i + 1).padStart(2, '0')
      return makeRow({ id: `row-${i}`, status, requested_dates: [`${year}-${month}-${day}`] })
    })
    const html = renderToStaticMarkup(
      <InquiriesCalendar rows={rows} tripMap={{}} slugMap={{}} />
    )
    for (const status of statuses) {
      expect(html).toContain(`data-status="${status}"`)
    }
  })
})
