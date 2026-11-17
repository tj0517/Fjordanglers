/**
 * ICS → busy days on the synthetic fixtures in ./fixtures (FA-M.09). Every expected list was
 * worked out by hand from the fixture before the run; the reasoning sits next to each case.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { busyDaysFromIcs, horizonInZone, NotACalendarError, resolveGuideZone } from '../ics'

const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf8')
const HORIZON = { from: '2026-12-01', to: '2027-11-30' }
const busy = (name: string, guideCountry: string | null = 'Norway', horizon = HORIZON) =>
  busyDaysFromIcs({ ics: fixture(name), guideCountry, ...horizon })

describe('all-day events', () => {
  it('single, multi-day (end exclusive) and no-DTEND (one day)', () => {
    expect(busy('all-day.ics').dates).toEqual([
      '2027-01-10',
      '2027-02-01', '2027-02-02', '2027-02-03', // DTEND 02-04 is exclusive
      '2027-02-20',
    ])
  })

  it('clipped to the horizon', () => {
    expect(busy('all-day.ics', 'Norway', { from: '2027-02-02', to: '2027-02-02' }).dates).toEqual(['2027-02-02'])
  })
})

describe('"free" (TRANSP:TRANSPARENT) — tj 2026-11-17 (b)', () => {
  it('all-day marked free → busy; timed marked free → skipped; timed OPAQUE → busy', () => {
    expect(busy('free.ics').dates).toEqual(['2027-05-01', '2027-05-03'])
  })
})

describe('timed events in the guide zone (Norway → Europe/Oslo)', () => {
  it('morning, over midnight, ending at midnight, cancelled, multi-day, DURATION', () => {
    expect(busy('timed.ics').dates).toEqual([
      '2027-03-05',                                         // 10–12
      '2027-03-07', '2027-03-08',                           // 22:00 → 02:00
      '2027-03-09',                                         // 20:00 → 00:00 does not touch 03-10
      // 03-11 cancelled → skipped
      '2027-03-20', '2027-03-21', '2027-03-22', '2027-03-23', // 4-day expedition
      '2027-03-26', '2027-03-27',                           // 23:00 + PT2H
    ])
  })
})

describe('time zones', () => {
  // UTC 04-15 15:00Z · New York 04-10 21:00 EDT (= 04-11 01:00Z) · floating 04-20 23:30 ·
  // non-IANA "Synthetic Fixed +14" defined in the file, 04-25 01:00 (= 04-24 11:00Z).
  it('guide in Norway (CEST +2): 04-11 03:00, 04-15 17:00, 04-20 floating, 04-24 13:00', () => {
    const r = busy('timezones.ics', 'Norway')
    expect(r.zone).toBe('Europe/Oslo')
    expect(r.dates).toEqual(['2027-04-11', '2027-04-15', '2027-04-20', '2027-04-24'])
  })

  it('guide in Chile (−4 after 4 Apr): NY event lands on 04-10 21:00', () => {
    const r = busy('timezones.ics', 'Chile')
    expect(r.zone).toBe('America/Santiago')
    expect(r.dates).toEqual(['2027-04-10', '2027-04-15', '2027-04-20', '2027-04-24'])
  })

  it('no country → the calendar\'s own X-WR-TIMEZONE (Pacific/Auckland, +12): UTC event lands on 04-16', () => {
    const r = busy('timezones.ics', '')
    expect(r.zone).toBe('Pacific/Auckland')
    expect(r.dates).toEqual(['2027-04-11', '2027-04-16', '2027-04-20', '2027-04-24'])
  })

  it('zone chain D3 (a): country → calendar zone → UTC', () => {
    expect(resolveGuideZone('Iceland', 'Pacific/Auckland')).toBe('Atlantic/Reykjavik')
    expect(resolveGuideZone('', 'Pacific/Auckland')).toBe('Pacific/Auckland')
    expect(resolveGuideZone(null, 'Not/AZone')).toBe('UTC')
    expect(resolveGuideZone('Atlantis', null)).toBe('UTC')
  })
})

describe('recurring events', () => {
  it('weekly with EXDATE, a moved occurrence and one marked free; daily all-day UNTIL; yearly since 2015', () => {
    expect(busy('recurring.ics').dates).toEqual([
      '2027-01-05', '2027-01-12',   // 01-19 excluded (EXDATE)
      '2027-01-27',                 // 01-26 moved to 01-27
      // 02-02 marked free (timed) → skipped
      '2027-02-09',
      '2027-03-01', '2027-03-02', '2027-03-03', // daily, UNTIL inclusive
      '2027-06-07',                 // yearly; 2026-06-07 is before the horizon
    ])
  })
})

describe('default horizon: 12 months from today in the guide zone', () => {
  it('today in Auckland is already tomorrow in UTC', () => {
    const now = new Date('2026-11-17T20:00:00Z')            // 09:00 on 11-18 in Auckland
    expect(horizonInZone('Pacific/Auckland', now)).toEqual({ from: '2026-11-18', to: '2027-11-17' })
    expect(horizonInZone('Europe/Oslo', now)).toEqual({ from: '2026-11-17', to: '2027-11-16' })
  })

  it('without from/to the fixture is clipped to that horizon', () => {
    const r = busyDaysFromIcs({ ics: fixture('recurring.ics'), guideCountry: 'Norway', now: new Date('2027-02-01T12:00:00Z') })
    expect(r.dates).toEqual(['2027-02-09', '2027-03-01', '2027-03-02', '2027-03-03', '2027-06-07'])
  })
})

describe('not a calendar', () => {
  it('RED: an HTML page or garbage → NotACalendarError', () => {
    expect(() => busyDaysFromIcs({ ics: '<html><body>Sign in</body></html>', guideCountry: 'Norway', ...HORIZON }))
      .toThrow(NotACalendarError)
    expect(() => busyDaysFromIcs({ ics: 'BEGIN:VCALENDAR\nthis is not ics', guideCountry: 'Norway', ...HORIZON }))
      .toThrow(NotACalendarError)
  })

  it('the result carries dates and a zone only — nothing from SUMMARY', () => {
    expect(JSON.stringify(busy('all-day.ics'))).not.toContain('Synthetic')
  })
})
