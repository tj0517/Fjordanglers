import { describe, it, expect } from 'vitest'
import { applyBaseFilters } from './InquiriesClient'
import type { InquiryRow, BaseFilterParams } from './InquiriesClient'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<InquiryRow> = {}): InquiryRow {
  return {
    id:                      'row-1',
    status:                  'new',
    angler_name:             'Test Angler',
    angler_email:            'test@example.com',
    angler_phone:            null,
    requested_dates:         null,
    party_size:              1,
    created_at:              '2020-01-15',
    trip_id:                 null,
    experience_page_id:      null,
    internal_commission_eur: null,
    deal_currency:           null,
    lost_reason:             null,
    last_contact_at:         null,
    next_action:             null,
    assigned_guide_id:       null,
    guide_acceptance:        null,
    guide_decline_reason:    null,
    external_offer_sent:     false,
    offer_sent_at:           null,
    source:                  null,
    qualified:               'unknown',
    trip_country:            null,
    ...overrides,
  }
}

const BASE: BaseFilterParams = {
  mainFilter:      'lead',
  subFilter:       null,
  q:               '',
  countryFilter:   '',
  guideIdFilter:   '',
  guideRespFilter: '',
  sourceFilter:    '',
  qualifiedFilter: '',
  slaFilter:       false,
  tripMap:         {},
  countryMap:      {},
}

// ─── applyBaseFilters ─────────────────────────────────────────────────────────

describe('applyBaseFilters', () => {
  // Criterion 2: calendar rows must NOT be filtered by created_at date range.
  // If this test fails, it means from/to were accidentally added to base filters.
  it('does not exclude rows by created_at — from/to are list-only', () => {
    // Two rows: one far in the past, one recent.
    // A from='2024-01-01' filter would exclude the old row if it were in base filters.
    const oldRow  = makeRow({ id: 'old', created_at: '2020-03-15' })
    const newRow  = makeRow({ id: 'new', created_at: '2025-09-01' })

    const result = applyBaseFilters([oldRow, newRow], BASE)
    const ids = result.map(r => r.id)

    // Both rows must survive — date range is never applied in base filters.
    expect(ids).toContain('old')
    expect(ids).toContain('new')
  })

  it('filters by status group (mainFilter)', () => {
    const leadRow = makeRow({ id: 'lead', status: 'new' })
    const lostRow = makeRow({ id: 'lost', status: 'lost' })

    const result = applyBaseFilters([leadRow, lostRow], { ...BASE, mainFilter: 'lead' })
    const ids = result.map(r => r.id)

    expect(ids).toContain('lead')
    expect(ids).not.toContain('lost')
  })

  it('filters by country when countryFilter is set', () => {
    const norway  = makeRow({ id: 'no', trip_country: 'Norway' })
    const iceland = makeRow({ id: 'is', trip_country: 'Iceland' })

    const result = applyBaseFilters([norway, iceland], { ...BASE, countryFilter: 'Norway' })
    const ids = result.map(r => r.id)

    expect(ids).toContain('no')
    expect(ids).not.toContain('is')
  })
})
