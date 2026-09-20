// TEMPORARY — replaced by stage 6 Przegląd (REBUILD_PLAN §6). Delete, don't refactor.
import { describe, expect, it } from 'vitest'
import type { Json } from '@/lib/supabase/database.types'
import {
  COMMISSION_TARGET_PLN,
  adSpendPerWeek,
  bookingsInMonth,
  commissionToDate,
  costPerWeek,
  cumulativeConversion,
  inquiriesPerWeek,
  isPaidAttributed,
  lastAdDate,
  lostReasons,
  qualifiedPerWeek,
  type WeeklyAdRow,
  type WeeklyInquiryRow,
} from './weekly'
import { lastWeeks } from './weeks'

const row = (over: Partial<WeeklyInquiryRow> = {}): WeeklyInquiryRow => ({
  offer_deposit_eur: null,
  deposit_amount: null,
  internal_commission_eur: null,
  deal_currency: 'EUR',
  created_at: '2026-09-15T10:00:00Z',
  deposit_paid_at: null,
  status: 'pending',
  qualified: 'unknown',
  gclid: null,
  utm: null,
  lost_reason_code: null,
  updated_at: '2026-09-15T10:00:00Z',
  ...over,
})

// Current week W38: Mon 2026-09-14 – Sun 2026-09-20; W37 before it.
const NOW = new Date('2026-09-20T10:00:00Z')
const weeks = lastWeeks(NOW, 5) // W38, W37, W36, W35, W34
const rates = { eurPln: 4, usdEur: 0.5 }

describe('commissionToDate', () => {
  it('counts only paid rows on or after `since`, USD converted', () => {
    const rows = [
      row({ offer_deposit_eur: 100, deposit_paid_at: '2026-03-01T10:00:00Z' }),
      row({ offer_deposit_eur: 200, deal_currency: 'USD', deposit_paid_at: '2026-06-01T10:00:00Z' }), // 100 EUR
      row({ offer_deposit_eur: 999 }), // not paid → ignored
      row({ offer_deposit_eur: 500, deposit_paid_at: '2025-12-31T10:00:00Z' }), // before since → ignored
    ]
    // (100 + 100) EUR * 4 = 800 PLN, two deals
    expect(commissionToDate(rows, rates, '2026-01-01')).toEqual({
      pln: 800,
      deals: 2,
      targetPln: COMMISSION_TARGET_PLN,
    })
    expect(COMMISSION_TARGET_PLN).toBe(80000)
  })

  it('compares the Warsaw date of deposit_paid_at with `since`', () => {
    // 2025-12-31 23:30Z is 2026-01-01 00:30 in Warsaw → inside the window.
    const rows = [row({ offer_deposit_eur: 10, deposit_paid_at: '2025-12-31T23:30:00Z' })]
    expect(commissionToDate(rows, rates, '2026-01-01').deals).toBe(1)
  })

  it('returns zeros for no rows', () => {
    expect(commissionToDate([], rates, '2026-01-01')).toEqual({ pln: 0, deals: 0, targetPln: 80000 })
  })
})

describe('bookingsInMonth', () => {
  it('counts deposit_paid_at by Warsaw month, current and previous', () => {
    const rows = [
      row({ deposit_paid_at: '2026-09-02T10:00:00Z' }),
      row({ deposit_paid_at: '2026-09-18T10:00:00Z' }),
      row({ deposit_paid_at: '2026-08-31T10:00:00Z' }),
      row({ deposit_paid_at: '2026-07-10T10:00:00Z' }), // older → neither
      row({ deposit_paid_at: null }),
    ]
    expect(bookingsInMonth(rows, NOW)).toEqual({
      current: 2,
      previous: 1,
      currentKey: '2026-09',
      previousKey: '2026-08',
    })
  })

  it('rolls January back to December of the previous year', () => {
    const rows = [
      row({ deposit_paid_at: '2026-12-20T10:00:00Z' }),
      row({ deposit_paid_at: '2027-01-05T10:00:00Z' }),
    ]
    expect(bookingsInMonth(rows, new Date('2027-01-15T10:00:00Z'))).toEqual({
      current: 1,
      previous: 1,
      currentKey: '2027-01',
      previousKey: '2026-12',
    })
  })

  it('returns zeros for no rows', () => {
    expect(bookingsInMonth([], NOW)).toEqual({
      current: 0,
      previous: 0,
      currentKey: '2026-09',
      previousKey: '2026-08',
    })
  })
})

describe('inquiriesPerWeek', () => {
  it('counts by Warsaw week of created_at, aligned with the weeks array', () => {
    const rows = [
      row({ created_at: '2026-09-14T08:00:00Z' }), // W38
      row({ created_at: '2026-09-20T21:30:00Z' }), // Sun 23:30 Warsaw → W38
      row({ created_at: '2026-09-20T22:30:00Z' }), // Mon 00:30 Warsaw → W39, outside → ignored
      row({ created_at: '2026-09-10T08:00:00Z' }), // W37
      row({ created_at: '2026-06-01T08:00:00Z' }), // way older → ignored
    ]
    const result = inquiriesPerWeek(rows, weeks)
    expect(result.map(w => w.key)).toEqual(weeks.map(w => w.key))
    expect(result.map(w => w.count)).toEqual([2, 1, 0, 0, 0])
    expect(result[0]).toEqual({ ...weeks[0], count: 2 })
  })

  it('returns zeros for no rows', () => {
    expect(inquiriesPerWeek([], weeks).map(w => w.count)).toEqual([0, 0, 0, 0, 0])
  })
})

describe('qualifiedPerWeek', () => {
  it('splits yes / no / unknown and treats unexpected values as unknown', () => {
    const rows = [
      row({ qualified: 'yes' }),
      row({ qualified: 'yes' }),
      row({ qualified: 'no' }),
      row({ qualified: 'unknown' }),
      row({ qualified: 'maybe' }),
      row({ qualified: null }),
      row({ qualified: 'yes', created_at: '2026-09-10T10:00:00Z' }), // W37
    ]
    const result = qualifiedPerWeek(rows, weeks)
    expect(result[0]).toMatchObject({ yes: 2, no: 1, unknown: 3, total: 6 })
    expect(result[1]).toMatchObject({ yes: 1, no: 0, unknown: 0, total: 1 })
    expect(result[2]).toMatchObject({ yes: 0, no: 0, unknown: 0, total: 0 })
  })

  it('returns zeros for no rows', () => {
    for (const w of qualifiedPerWeek([], weeks)) {
      expect(w).toMatchObject({ yes: 0, no: 0, unknown: 0, total: 0 })
    }
  })
})

describe('adSpendPerWeek / lastAdDate', () => {
  const ads: WeeklyAdRow[] = [
    { date: '2026-09-14', spend: 100.5 }, // W38 (Monday)
    { date: '2026-09-20', spend: 50 }, // W38 (Sunday)
    { date: '2026-09-13', spend: 30 }, // W37 (Sunday)
    { date: '2026-05-01', spend: 999 }, // outside
  ]

  it('sums PLN spend per ISO week straight from the column (no conversion)', () => {
    const result = adSpendPerWeek(ads, weeks)
    expect(result.map(w => w.spendPln)).toEqual([150.5, 30, 0, 0, 0])
    expect(result[0]).toEqual({ ...weeks[0], spendPln: 150.5 })
  })

  it('ignores non-finite spend values', () => {
    expect(adSpendPerWeek([{ date: '2026-09-14', spend: Number.NaN }], weeks)[0]?.spendPln).toBe(0)
  })

  it('returns zeros for no rows', () => {
    expect(adSpendPerWeek([], weeks).map(w => w.spendPln)).toEqual([0, 0, 0, 0, 0])
  })

  it('lastAdDate is the maximum date, or null for no rows', () => {
    expect(lastAdDate(ads)).toBe('2026-09-20')
    expect(lastAdDate([])).toBeNull()
  })
})

describe('isPaidAttributed', () => {
  it('is true for a gclid alone', () => {
    expect(isPaidAttributed({ gclid: 'abc', utm: null })).toBe(true)
  })

  it('is true for utm_medium cpc / paid alone, case-insensitive and trimmed', () => {
    expect(isPaidAttributed({ gclid: null, utm: { utm_medium: 'CPC' } })).toBe(true)
    expect(isPaidAttributed({ gclid: null, utm: { utm_medium: ' Paid ' } })).toBe(true)
    expect(isPaidAttributed({ gclid: '', utm: { utm_medium: 'cpc' } })).toBe(true)
  })

  it('is false for neither', () => {
    expect(isPaidAttributed({ gclid: null, utm: null })).toBe(false)
    expect(isPaidAttributed({ gclid: '  ', utm: { utm_medium: 'organic' } })).toBe(false)
    expect(isPaidAttributed({ gclid: null, utm: { utm_source: 'google' } })).toBe(false)
    expect(isPaidAttributed({ gclid: null, utm: { utm_medium: 5 } })).toBe(false)
  })

  it('does not throw on non-object JSON in utm', () => {
    const weird: Json[] = ['cpc', 42, true, ['cpc'], []]
    for (const utm of weird) {
      expect(isPaidAttributed({ gclid: null, utm })).toBe(false)
    }
  })
})

describe('costPerWeek', () => {
  const ads: WeeklyAdRow[] = [{ date: '2026-09-15', spend: 300 }] // W38
  const rows = [
    row({ gclid: 'g1', qualified: 'yes' }), // attributed via gclid
    row({ utm: { utm_medium: 'CPC' }, qualified: 'no' }), // attributed via utm only
    row({ qualified: 'yes' }), // organic
    row({ qualified: 'unknown' }), // organic
  ]

  it('divides spend by attributed and by all inquiries / qualified', () => {
    const [current] = costPerWeek(rows, ads, weeks)
    expect(current).toMatchObject({ key: '2026-W38', spendPln: 300 })
    expect(current?.attributed).toEqual({ inquiries: 2, qualified: 1, perInquiry: 150, perQualified: 300 })
    expect(current?.all).toEqual({ inquiries: 4, qualified: 2, perInquiry: 75, perQualified: 150 })
  })

  it('returns null ratios (not NaN/Infinity) on zero denominators', () => {
    // Attributed rows exist, none qualified → perQualified null; other weeks have no rows at all.
    const result = costPerWeek([row({ gclid: 'g1', qualified: 'no' })], ads, weeks)
    expect(result[0]?.attributed).toEqual({ inquiries: 1, qualified: 0, perInquiry: 300, perQualified: null })
    expect(result[1]?.attributed).toEqual({ inquiries: 0, qualified: 0, perInquiry: null, perQualified: null })
    expect(result[1]?.all).toEqual({ inquiries: 0, qualified: 0, perInquiry: null, perQualified: null })
  })

  it('spend with no inquiries yields null, and inquiries with no spend yield 0', () => {
    const noRows = costPerWeek([], ads, weeks)
    expect(noRows[0]?.all.perInquiry).toBeNull()
    const noAds = costPerWeek(rows, [], weeks)
    expect(noAds[0]?.spendPln).toBe(0)
    expect(noAds[0]?.all.perInquiry).toBe(0)
  })

  it('returns zeros/nulls for empty input', () => {
    for (const w of costPerWeek([], [], weeks)) {
      expect(w.spendPln).toBe(0)
      expect(w.attributed).toEqual({ inquiries: 0, qualified: 0, perInquiry: null, perQualified: null })
      expect(w.all).toEqual({ inquiries: 0, qualified: 0, perInquiry: null, perQualified: null })
    }
  })
})

describe('cumulativeConversion', () => {
  it('divides booked by inquiries created on or after `since`', () => {
    const rows = [
      row({ created_at: '2026-02-01T10:00:00Z', deposit_paid_at: '2026-03-01T10:00:00Z' }),
      row({ created_at: '2026-04-01T10:00:00Z' }),
      row({ created_at: '2026-05-01T10:00:00Z' }),
      row({ created_at: '2026-06-01T10:00:00Z' }),
      row({ created_at: '2025-11-01T10:00:00Z', deposit_paid_at: '2026-02-01T10:00:00Z' }), // before since
    ]
    expect(cumulativeConversion(rows, '2026-01-01')).toEqual({ inquiries: 4, booked: 1, rate: 0.25 })
  })

  it('returns rate null (not NaN) for no rows', () => {
    expect(cumulativeConversion([], '2026-01-01')).toEqual({ inquiries: 0, booked: 0, rate: null })
  })
})

describe('lostReasons', () => {
  const lost = (code: string | null, updated_at = '2026-09-01T10:00:00Z') =>
    row({ status: 'lost', lost_reason_code: code, updated_at })

  it('groups by code, keeps NULL as its own entry, sorts by count desc then code asc, null last', () => {
    const rows = [
      lost('price'),
      lost('price'),
      lost('client_silent'),
      lost('guide_slow'),
      lost(null),
      lost(null),
      lost(null),
    ]
    expect(lostReasons(rows, NOW)).toEqual([
      { code: null, count: 3 },
      { code: 'price', count: 2 },
      { code: 'client_silent', count: 1 },
      { code: 'guide_slow', count: 1 },
    ])
  })

  it('puts null last among equal counts', () => {
    expect(lostReasons([lost(null), lost('price')], NOW)).toEqual([
      { code: 'price', count: 1 },
      { code: null, count: 1 },
    ])
  })

  it('ignores non-lost rows and rows older than the window', () => {
    const rows = [
      row({ status: 'pending', lost_reason_code: 'price' }),
      lost('price', '2026-06-01T10:00:00Z'), // 111 days before NOW
      lost('price', '2026-06-22T10:00:00Z'), // 90 days before NOW exactly → included
    ]
    expect(lostReasons(rows, NOW)).toEqual([{ code: 'price', count: 1 }])
    expect(lostReasons(rows, NOW, 30)).toEqual([])
  })

  it('returns an empty array for no rows', () => {
    expect(lostReasons([], NOW)).toEqual([])
  })
})
