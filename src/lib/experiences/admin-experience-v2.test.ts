/**
 * FA-1.56 — pure rules of the "Offer v2" editor (src/lib/experiences/v2-editor.ts).
 * The same rules against a real database are in src/actions/__tests__/experience-pages-v2.test.ts.
 */

import { describe, it, expect } from 'vitest'
import {
  basePriceCents,
  centsToMoneyText,
  guidesSchema,
  missingForV2,
  overrideExceedsCap,
  overrideLimitCents,
  parseMoneyToCents,
  slugSchema,
  type EditorPriceCell,
  type GuideRowInput,
} from './v2-editor'

describe('parseMoneyToCents — text to integer cents, no float in between', () => {
  it.each([
    ['1250',      125000],
    ['1250.5',    125050],
    ['1250.50',   125050],
    ['1 250,50',  125050],
    ['0.07',      7],
    // 19.99 * 100 is 1998.9999999999998 in IEEE-754 — the reason digits are read as text.
    ['19.99',     1999],
    ['1.15',      115],
    ['0',         0],
  ])('%s → %i', (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents)
  })

  it.each(['', 'abc', '-5', '1e3', '1.005', '12.', '.5', '1,250.50', '12345678901'])('%s is not an amount', input => {
    expect(parseMoneyToCents(input)).toBeNull()
  })

  it('round-trips through centsToMoneyText', () => {
    for (const cents of [0, 7, 99, 100, 1999, 125000, 125050, 999999999]) {
      expect(parseMoneyToCents(centsToMoneyText(cents))).toBe(cents)
    }
    expect(centsToMoneyText(125000)).toBe('1250')
    expect(centsToMoneyText(125050)).toBe('1250.50')
    expect(centsToMoneyText(7)).toBe('0.07')
    expect(centsToMoneyText(null)).toBe('')
  })
})

describe('basePriceCents — the row the override trigger measures against', () => {
  const today = '2026-10-07'
  const cell = (over: Partial<EditorPriceCell>): EditorPriceCell => ({
    days: 1, anglers: 2, guidePriceCents: 100000, validFrom: null, validTo: null, ...over,
  })

  it('is the 1 day × max-anglers row, and nothing else', () => {
    expect(basePriceCents([cell({ days: 2 }), cell({ anglers: 1 })], 2, today)).toBeNull()
    expect(basePriceCents([cell({ days: 2 }), cell({})], 2, today)).toBe(100000)
    expect(basePriceCents([cell({})], 3, today)).toBeNull()
  })

  it('ignores rows that are not valid today', () => {
    const expired = cell({ guidePriceCents: 1, validFrom: '2024-01-01', validTo: '2024-12-31' })
    const future  = cell({ guidePriceCents: 2, validFrom: '2027-10-01', validTo: null })
    expect(basePriceCents([expired, future], 2, today)).toBeNull()
    expect(basePriceCents([expired, future, cell({})], 2, today)).toBe(100000)
  })

  it('prefers the newest dated row over an undated one (ORDER BY valid_from DESC NULLS LAST)', () => {
    const undated = cell({ guidePriceCents: 100000 })
    const older   = cell({ guidePriceCents: 110000, validFrom: '2026-01-01' })
    const newer   = cell({ guidePriceCents: 120000, validFrom: '2026-10-01', validTo: '2027-04-30' })
    expect(basePriceCents([undated, older, newer], 2, today)).toBe(120000)
    expect(basePriceCents([newer, undated, older], 2, today)).toBe(120000)
    expect(basePriceCents([undated, older], 2, today)).toBe(110000)
  })

  it('counts the first and the last day of a season as valid', () => {
    expect(basePriceCents([cell({ validFrom: today, validTo: today })], 2, today)).toBe(100000)
  })
})

describe('override cap — override × 100 > base × 115, in integers', () => {
  it('115% exactly is allowed, one cent more is not', () => {
    expect(overrideExceedsCap(115000, 100000)).toBe(false)
    expect(overrideExceedsCap(115001, 100000)).toBe(true)
    expect(overrideExceedsCap(130000, 100000)).toBe(true)
  })

  it('rounds the limit down when 115% is not a whole cent', () => {
    // 33333 × 1.15 = 38332.95
    expect(overrideLimitCents(33333)).toBe(38332)
    expect(overrideExceedsCap(38332, 33333)).toBe(false)
    expect(overrideExceedsCap(38333, 33333)).toBe(true)
  })
})

describe('guidesSchema', () => {
  const G1 = '56a00000-0000-4000-8000-000000000001'
  const G2 = '56a00000-0000-4000-8000-000000000002'
  const row = (guideId: string, over: Partial<GuideRowInput> = {}): GuideRowInput => ({
    guideId, role: 'backup', status: 'active', showOnPage: true, sortOrder: 0, overrideCents: null, ...over,
  })

  it('checks an override only when it is new or changed — like the trigger', () => {
    const stored = new Map<string, number | null>([[G1, 130000]])
    const schema = guidesSchema({ baseCents: 100000, storedOverrides: stored })

    // Stored at 130000 when prices were higher; untouched now → not this save's business.
    expect(schema.safeParse([row(G1, { overrideCents: 130000 })]).success).toBe(true)
    // Changed to another value above the cap → refused.
    expect(schema.safeParse([row(G1, { overrideCents: 129000 })]).success).toBe(false)
    // A new row with the same too-high value → refused.
    expect(schema.safeParse([row(G2, { overrideCents: 130000 })]).success).toBe(false)
    // Clearing it is always allowed.
    expect(schema.safeParse([row(G1, { overrideCents: null })]).success).toBe(true)
  })

  it('a paused primary next to an active primary is one active primary', () => {
    const schema = guidesSchema({ baseCents: null, storedOverrides: new Map() })
    expect(schema.safeParse([row(G1, { role: 'primary', status: 'paused' }), row(G2, { role: 'primary' })]).success).toBe(true)
    expect(schema.safeParse([row(G1, { role: 'primary' }), row(G2, { role: 'primary' })]).success).toBe(false)
  })

  it('refuses a zero, negative or fractional override', () => {
    const schema = guidesSchema({ baseCents: 100000, storedOverrides: new Map() })
    for (const overrideCents of [0, -1, 100.5]) {
      expect(schema.safeParse([row(G1, { overrideCents })]).success, String(overrideCents)).toBe(false)
    }
  })
})

describe('missingForV2', () => {
  it('is empty only when all three are present', () => {
    expect(missingForV2({ priceFromCents: 1, activePrimaryGuides: 1, suitedFor: ['x'] })).toEqual([])
  })

  it('names each gap', () => {
    expect(missingForV2({ priceFromCents: 0, activePrimaryGuides: 1, suitedFor: ['x'] }))
      .toEqual(['a "from" price greater than 0 (Mode and price)'])
    expect(missingForV2({ priceFromCents: null, activePrimaryGuides: 0, suitedFor: [] })).toEqual([
      'a "from" price greater than 0 (Mode and price)',
      'an active primary guide (Guides)',
      'at least one "Suited for" line (Content)',
    ])
  })
})

describe('slugSchema — the format the page form has always produced', () => {
  it.each(['the-gaula-run', 'a--b', 'nz-2026', '-leading'])('accepts %s', slug => {
    expect(slugSchema.safeParse(slug).success).toBe(true)
  })

  it.each(['The-Gaula-Run', 'a b', 'a_b', 'a/b', 'ø', ''])('refuses "%s"', slug => {
    expect(slugSchema.safeParse(slug).success).toBe(false)
  })
})
