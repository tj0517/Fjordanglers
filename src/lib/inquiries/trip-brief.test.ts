/**
 * FA-M.07 — the Trip Brief schema, labels and diff (pure; no database).
 * The save itself, against the local stack, is in src/actions/__tests__/saveTripDetails.test.ts.
 */

import { describe, it, expect } from 'vitest'
import {
  LICENCE_BUYER_LABELS,
  TRIP_BRIEF_COLUMNS,
  TRIP_BRIEF_FIELDS,
  changedTripBriefFields,
  licenceLine,
  tripBriefInputSchema,
  type TripBriefInput,
} from './trip-brief'

const EMPTY: TripBriefInput = {
  confirmed_date: null, confirmed_party_size: null, price_range: null, date_flexibility: null,
  target_species: null, accommodation: null, guide_notes: null, licence_buyer: null, licence_note: null,
}

const FULL: TripBriefInput = {
  confirmed_date: '14–15 Jan 2027', confirmed_party_size: 2, price_range: '€500/day',
  date_flexibility: 'fixed', target_species: 'Brown trout', accommodation: 'Client books — Tūrangi',
  guide_notes: 'Early start on day 1.', licence_buyer: 'client', licence_note: 'Taupō licence',
}

describe('tripBriefInputSchema', () => {
  it('accepts a full brief and an empty one', () => {
    expect(tripBriefInputSchema.parse(FULL)).toEqual(FULL)
    expect(tripBriefInputSchema.parse(EMPTY)).toEqual(EMPTY)
  })

  it('accepts every licence buyer, and empty as "not set"', () => {
    for (const v of ['client', 'guide', 'not_needed']) {
      expect(tripBriefInputSchema.parse({ ...EMPTY, licence_buyer: v }).licence_buyer).toBe(v)
    }
    expect(tripBriefInputSchema.parse({ ...EMPTY, licence_buyer: '' }).licence_buyer).toBeNull()
  })

  it('red proof: rejects a licence buyer outside the list (no "FA buys")', () => {
    for (const v of ['fa', 'FA', 'Client', 'client ', 'angler']) {
      const r = tripBriefInputSchema.safeParse({ ...EMPTY, licence_buyer: v })
      expect(r.success, v).toBe(false)
    }
  })

  it('limits: accommodation 300, FA note 2000, licence note 300, other text 300 — at the limit passes, one over fails', () => {
    const cases: [keyof TripBriefInput, number][] = [
      ['accommodation', 300], ['guide_notes', 2000], ['licence_note', 300],
      ['confirmed_date', 300], ['price_range', 300], ['target_species', 300],
    ]
    for (const [field, max] of cases) {
      expect(tripBriefInputSchema.safeParse({ ...EMPTY, [field]: 'x'.repeat(max) }).success, `${field}=${max}`).toBe(true)
      expect(tripBriefInputSchema.safeParse({ ...EMPTY, [field]: 'x'.repeat(max + 1) }).success, `${field}=${max + 1}`).toBe(false)
    }
  })

  it('the longest stored values in prod today (accommodation 205, FA note 976) pass', () => {
    expect(tripBriefInputSchema.safeParse({ ...EMPTY, accommodation: 'a'.repeat(205), guide_notes: 'n'.repeat(976) }).success).toBe(true)
  })

  it('trims, and an emptied field becomes null (tj decision 3)', () => {
    const out = tripBriefInputSchema.parse({ ...FULL, accommodation: '   ', guide_notes: '', licence_note: '  Taupō  ' })
    expect(out).toMatchObject({ accommodation: null, guide_notes: null, licence_note: 'Taupō' })
  })

  it('rejects an unknown date flexibility and a party size outside 1–20', () => {
    expect(tripBriefInputSchema.safeParse({ ...EMPTY, date_flexibility: 'whenever' }).success).toBe(false)
    expect(tripBriefInputSchema.safeParse({ ...EMPTY, confirmed_party_size: 0 }).success).toBe(false)
    expect(tripBriefInputSchema.safeParse({ ...EMPTY, confirmed_party_size: 21 }).success).toBe(false)
    expect(tripBriefInputSchema.safeParse({ ...EMPTY, confirmed_party_size: 2.5 }).success).toBe(false)
  })

  it('refuses any other key — guide_options is never written by the admin save (tj decision 2)', () => {
    expect(tripBriefInputSchema.safeParse({ ...EMPTY, guide_options: [] }).success).toBe(false)
    expect(tripBriefInputSchema.safeParse({ ...EMPTY, inquiry_id: 'x' }).success).toBe(false)
  })

  it('refuses a missing key (the Brief tab always sends the whole brief)', () => {
    const partial: Partial<TripBriefInput> = { ...EMPTY }
    delete partial.licence_note
    expect(tripBriefInputSchema.safeParse(partial).success).toBe(false)
  })

  it('TRIP_BRIEF_COLUMNS (the typed select list) names exactly the schema fields', () => {
    expect(TRIP_BRIEF_COLUMNS.split(',').map(c => c.trim())).toEqual(TRIP_BRIEF_FIELDS)
  })
})

describe('changedTripBriefFields', () => {
  const full = tripBriefInputSchema.parse(FULL)

  it('no row yet: every non-null field counts as changed', () => {
    expect(changedTripBriefFields(null, full)).toEqual(TRIP_BRIEF_FIELDS)
    expect(changedTripBriefFields(null, tripBriefInputSchema.parse(EMPTY))).toEqual([])
  })

  it('names only what differs, including a cleared field', () => {
    const after = tripBriefInputSchema.parse({ ...FULL, guide_notes: '', licence_buyer: 'guide' })
    expect(changedTripBriefFields(full, after)).toEqual(['guide_notes', 'licence_buyer'])
  })

  it('same values → nothing changed', () => {
    expect(changedTripBriefFields(full, full)).toEqual([])
  })
})

describe('licenceLine', () => {
  it('buyer label and note, either alone, or nothing', () => {
    expect(licenceLine('client', 'Taupō licence')).toBe('Client buys — Taupō licence')
    expect(licenceLine('not_needed', null)).toBe(LICENCE_BUYER_LABELS.not_needed)
    expect(licenceLine(null, 'Ranga beat permit')).toBe('Ranga beat permit')
    expect(licenceLine(null, '  ')).toBeNull()
    expect(licenceLine(null, null)).toBeNull()
  })

  it('an unknown stored buyer is not shown as a label', () => {
    expect(licenceLine('fa', null)).toBeNull()
  })
})
