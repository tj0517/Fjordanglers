// TEMPORARY — replaced by stage 6 Przegląd (REBUILD_PLAN §6). Delete, don't refactor.
import { describe, expect, it } from 'vitest'
import {
  isoWeekKey,
  isoWeekKeyOfDate,
  isoWeekStart,
  lastWeeks,
  monthKey,
  previousMonthKey,
  warsawDateString,
  warsawYmd,
} from './weeks'

describe('warsawYmd', () => {
  it('returns the Warsaw calendar date of a Date and of an ISO string', () => {
    expect(warsawYmd('2026-06-15T10:00:00Z')).toEqual({ year: 2026, month: 6, day: 15 })
    expect(warsawYmd(new Date('2026-06-15T10:00:00Z'))).toEqual({ year: 2026, month: 6, day: 15 })
  })

  it('rolls over midnight in summer (CEST, +2): 22:30Z is already next day', () => {
    expect(warsawYmd('2026-09-20T22:30:00Z')).toEqual({ year: 2026, month: 9, day: 21 })
    expect(warsawYmd('2026-09-20T21:59:59Z')).toEqual({ year: 2026, month: 9, day: 20 })
  })

  it('rolls over midnight in winter (CET, +1): 23:30Z is already next day', () => {
    expect(warsawYmd('2026-12-27T23:30:00Z')).toEqual({ year: 2026, month: 12, day: 28 })
    expect(warsawYmd('2026-12-27T22:59:59Z')).toEqual({ year: 2026, month: 12, day: 27 })
  })

  it('understands explicit offsets', () => {
    expect(warsawYmd('2026-09-21T00:30:00+02:00')).toEqual({ year: 2026, month: 9, day: 21 })
    expect(warsawYmd('2026-12-31T23:30:00-05:00')).toEqual({ year: 2027, month: 1, day: 1 })
  })

  it('throws a clear error on an invalid date', () => {
    expect(() => warsawYmd('not a date')).toThrow(RangeError)
  })

  it('formats as YYYY-MM-DD', () => {
    expect(warsawDateString('2026-03-05T12:00:00Z')).toBe('2026-03-05')
  })
})

describe('isoWeekKey', () => {
  it('puts 2026-12-31 and 2027-01-01 both in ISO 2026-W53', () => {
    expect(isoWeekKey('2026-12-31T12:00:00Z')).toBe('2026-W53')
    expect(isoWeekKey('2027-01-01T12:00:00Z')).toBe('2026-W53')
    expect(isoWeekStart('2026-12-31T12:00:00Z')).toBe('2026-12-28')
    expect(isoWeekStart('2027-01-01T12:00:00Z')).toBe('2026-12-28')
  })

  it('starts 2027-W01 on Monday 2027-01-04, zero-padded', () => {
    expect(isoWeekKey('2027-01-03T12:00:00Z')).toBe('2026-W53')
    expect(isoWeekKey('2027-01-04T12:00:00Z')).toBe('2027-W01')
    expect(isoWeekStart('2027-01-04T12:00:00Z')).toBe('2027-01-04')
  })

  it('treats Sunday as the last day of the week', () => {
    expect(isoWeekKey('2026-09-20T12:00:00Z')).toBe('2026-W38')
    expect(isoWeekKey('2026-09-21T12:00:00Z')).toBe('2026-W39')
  })

  it('uses the Warsaw date, not the UTC date (summer, CEST)', () => {
    // Sunday 22:30Z == Monday 00:30 Warsaw: already the next ISO week.
    expect(isoWeekKey('2026-09-20T22:30:00Z')).toBe('2026-W39')
    expect(isoWeekStart('2026-09-20T22:30:00Z')).toBe('2026-09-21')
    expect(isoWeekKey('2026-09-20T21:30:00Z')).toBe('2026-W38')
  })

  it('uses the Warsaw date, not the UTC date (winter, CET)', () => {
    // 2026-12-27 is a Sunday; 23:30Z == Monday 2026-12-28 00:30 Warsaw = start of W53.
    expect(isoWeekKey('2026-12-27T23:30:00Z')).toBe('2026-W53')
    expect(isoWeekStart('2026-12-27T23:30:00Z')).toBe('2026-12-28')
    expect(isoWeekKey('2026-12-27T22:30:00Z')).toBe('2026-W52')
  })

  it('handles a year that starts on Monday (2029-01-01 is ISO 2029-W01)', () => {
    expect(isoWeekKey('2029-01-01T12:00:00Z')).toBe('2029-W01')
    expect(isoWeekKey('2028-12-31T12:00:00Z')).toBe('2028-W52')
  })
})

describe('isoWeekKeyOfDate', () => {
  it('buckets a plain date without timezone shifting', () => {
    expect(isoWeekKeyOfDate('2026-12-31')).toBe('2026-W53')
    expect(isoWeekKeyOfDate('2027-01-01')).toBe('2026-W53')
    expect(isoWeekKeyOfDate('2027-01-04')).toBe('2027-W01')
    expect(isoWeekKeyOfDate('2026-09-20')).toBe('2026-W38')
    expect(isoWeekKeyOfDate('2026-09-21')).toBe('2026-W39')
  })

  it('throws on garbage', () => {
    expect(() => isoWeekKeyOfDate('nope')).toThrow(RangeError)
  })
})

describe('lastWeeks', () => {
  it('returns newest first, index 0 = current week, Monday to Sunday', () => {
    const weeks = lastWeeks(new Date('2026-09-20T10:00:00Z'), 5)
    expect(weeks).toEqual([
      { key: '2026-W38', start: '2026-09-14', end: '2026-09-20' },
      { key: '2026-W37', start: '2026-09-07', end: '2026-09-13' },
      { key: '2026-W36', start: '2026-08-31', end: '2026-09-06' },
      { key: '2026-W35', start: '2026-08-24', end: '2026-08-30' },
      { key: '2026-W34', start: '2026-08-17', end: '2026-08-23' },
    ])
  })

  it('uses the Warsaw week for "now" (Sunday 22:30Z is already Monday in Warsaw)', () => {
    expect(lastWeeks(new Date('2026-09-20T22:30:00Z'), 1)).toEqual([
      { key: '2026-W39', start: '2026-09-21', end: '2026-09-27' },
    ])
  })

  it('crosses the ISO year boundary with W53', () => {
    const weeks = lastWeeks(new Date('2027-01-05T10:00:00Z'), 3)
    expect(weeks.map(w => w.key)).toEqual(['2027-W01', '2026-W53', '2026-W52'])
    expect(weeks[1]).toEqual({ key: '2026-W53', start: '2026-12-28', end: '2027-01-03' })
  })

  it('crosses the DST change (2026-10-25) without drifting a day', () => {
    const weeks = lastWeeks(new Date('2026-10-28T10:00:00Z'), 2)
    expect(weeks).toEqual([
      { key: '2026-W44', start: '2026-10-26', end: '2026-11-01' },
      { key: '2026-W43', start: '2026-10-19', end: '2026-10-25' },
    ])
  })

  it('returns an empty array for n = 0', () => {
    expect(lastWeeks(new Date('2026-09-20T10:00:00Z'), 0)).toEqual([])
  })
})

describe('monthKey / previousMonthKey', () => {
  it('uses the Warsaw month', () => {
    expect(monthKey('2026-09-15T10:00:00Z')).toBe('2026-09')
    // 2026-08-31 22:30Z == 2026-09-01 00:30 Warsaw
    expect(monthKey('2026-08-31T22:30:00Z')).toBe('2026-09')
    expect(monthKey('2026-08-31T21:30:00Z')).toBe('2026-08')
  })

  it('rolls January back to the previous December', () => {
    expect(previousMonthKey('2027-01')).toBe('2026-12')
    expect(previousMonthKey('2026-10')).toBe('2026-09')
    expect(previousMonthKey('2026-02')).toBe('2026-01')
  })

  it('throws on a malformed key', () => {
    expect(() => previousMonthKey('2026-9')).toThrow(RangeError)
  })
})
