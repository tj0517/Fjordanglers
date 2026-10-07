/**
 * FA-1.55 — `inquiries.brief`: the schema, the mapping onto the old columns, and the budget
 * bands a `custom` page cuts out of its own range.
 *
 * The endpoint that uses this schema is public, so the cases that matter are the ones that
 * must be rejected: an out-of-range level, a brief that describes two different trips at
 * once, and an unknown key (`.strict()` — the value is stored 1:1, so junk must not reach
 * the column).
 */

import { describe, it, expect } from 'vitest'
import {
  briefSchema,
  briefSummaryLines,
  budgetBandLabel,
  budgetBandOptions,
  composeBriefMessage,
  anglerTextFromMessage,
  partySizeFromBrief,
  requestedDatesFromBrief,
  tripLengthFromBrief,
  type Brief,
} from './brief'

const EXACT: Brief = {
  dates_mode:  'exact',
  date_from:   '2027-03-10',
  date_to:     '2027-03-12',
  days:        3,
  anglers:     2,
  non_anglers: 1,
  skill_level: 3,
  priority:    'trophy',
  fitness:     'mid',
  wading_ok:   true,
  budget_ack:  true,
}

const FLEXIBLE: Brief = {
  dates_mode:  'flexible',
  flex_month:  '2027-06',
  days:        2,
  anglers:     1,
  non_anglers: 0,
  skill_level: 5,
  priority:    'scenery',
  fitness:     'high',
  wading_ok:   false,
  budget_band: 'EUR:100000-200000',
}

describe('briefSchema — what it accepts', () => {
  it('accepts an exact-dates brief and a flexible one', () => {
    expect(briefSchema.safeParse(EXACT).success).toBe(true)
    expect(briefSchema.safeParse(FLEXIBLE).success).toBe(true)
  })

  it('accepts a one-day exact brief with no end date', () => {
    const { date_to: _unused, ...oneDay } = { ...EXACT, days: 1 }
    expect(briefSchema.safeParse(oneDay).success).toBe(true)
  })
})

describe('briefSchema — what it rejects (red cases)', () => {
  it('rejects skill_level 7 — the form offers 1–5', () => {
    const result = briefSchema.safeParse({ ...EXACT, skill_level: 7 })
    expect(result.success).toBe(false)
  })

  it('rejects skill_level 0 and a non-integer level', () => {
    expect(briefSchema.safeParse({ ...EXACT, skill_level: 0 }).success).toBe(false)
    expect(briefSchema.safeParse({ ...EXACT, skill_level: 2.5 }).success).toBe(false)
  })

  it('rejects a brief with no dates_mode', () => {
    const { dates_mode: _unused, ...without } = EXACT
    expect(briefSchema.safeParse(without).success).toBe(false)
  })

  it('rejects an unknown key rather than stripping it', () => {
    const result = briefSchema.safeParse({ ...EXACT, referral_code: 'FREE-TRIP' })
    expect(result.success).toBe(false)
    expect(JSON.stringify(result.error?.issues)).toContain('referral_code')
  })

  it('rejects exact dates without a start date, and flexible without a month', () => {
    const { date_from: _a, ...noStart } = EXACT
    expect(briefSchema.safeParse(noStart).success).toBe(false)
    const { flex_month: _b, ...noMonth } = FLEXIBLE
    expect(briefSchema.safeParse(noMonth).success).toBe(false)
  })

  it('rejects a brief that carries both a month and exact dates', () => {
    expect(briefSchema.safeParse({ ...EXACT, flex_month: '2027-03' }).success).toBe(false)
    expect(briefSchema.safeParse({ ...FLEXIBLE, date_from: '2027-06-01' }).success).toBe(false)
  })

  it('rejects an end date before the start, and a span over 30 days', () => {
    expect(briefSchema.safeParse({ ...EXACT, date_to: '2027-03-09' }).success).toBe(false)
    expect(briefSchema.safeParse({ ...EXACT, date_to: '2027-05-10' }).success).toBe(false)
  })

  it('rejects an unknown priority, fitness or dates_mode', () => {
    expect(briefSchema.safeParse({ ...EXACT, priority: 'relaxation' }).success).toBe(false)
    expect(briefSchema.safeParse({ ...EXACT, fitness: 'extreme' }).success).toBe(false)
    expect(briefSchema.safeParse({ ...EXACT, dates_mode: 'whenever' }).success).toBe(false)
  })

  it('rejects a malformed budget band', () => {
    expect(briefSchema.safeParse({ ...FLEXIBLE, budget_band: 'about two grand' }).success).toBe(false)
    expect(briefSchema.safeParse({ ...FLEXIBLE, budget_band: 'eur:1-2' }).success).toBe(false)
  })

  it('rejects more than 20 people on either count', () => {
    expect(briefSchema.safeParse({ ...EXACT, anglers: 21 }).success).toBe(false)
    expect(briefSchema.safeParse({ ...EXACT, non_anglers: 21 }).success).toBe(false)
  })
})

describe('the old columns, derived from the brief', () => {
  it('expands exact dates day by day, so a blocked-date check sees every day asked for', () => {
    expect(requestedDatesFromBrief(EXACT)).toEqual(['2027-03-10', '2027-03-11', '2027-03-12'])
  })

  it('derives the end of the range from `days` when only a start date is given', () => {
    const { date_to: _unused, ...noEnd } = EXACT
    expect(requestedDatesFromBrief(noEnd)).toEqual(['2027-03-10', '2027-03-11', '2027-03-12'])
  })

  it('leaves requested_dates empty for flexible dates rather than inventing the 1st', () => {
    expect(requestedDatesFromBrief(FLEXIBLE)).toEqual([])
  })

  it('never produces more dates than the API schema accepts', () => {
    const long = { ...EXACT, date_to: '2027-04-08', days: 30 }
    expect(briefSchema.safeParse(long).success).toBe(true)
    expect(requestedDatesFromBrief(long).length).toBeLessThanOrEqual(30)
  })

  it('maps days onto the trip_length buckets', () => {
    expect(tripLengthFromBrief({ ...EXACT, days: 1 })).toBe('1')
    expect(tripLengthFromBrief({ ...EXACT, days: 3 })).toBe('2-3')
    expect(tripLengthFromBrief({ ...EXACT, days: 7 })).toBe('4-7')
    expect(tripLengthFromBrief({ ...EXACT, days: 8 })).toBe('7+')
  })

  it('counts party_size in anglers — companions stay in the brief and the summary', () => {
    expect(partySizeFromBrief(EXACT)).toBe(2)
    expect(briefSummaryLines(EXACT).join('\n')).toContain('1 non-angler(s)')
  })
})

describe('the summary a person reads', () => {
  it('names the level, the priority, the fitness and the wading answer', () => {
    const text = briefSummaryLines(EXACT).join('\n')
    expect(text).toContain('Skill level: 3/5')
    expect(text).toContain('Intermediate')
    expect(text).toContain('One big fish')
    expect(text).toContain('A few kilometres')
    expect(text).toContain('happy to wade')
    expect(text).toContain('10 March 2027')
  })

  it('names the month, not a date, for a flexible brief', () => {
    const text = briefSummaryLines(FLEXIBLE).join('\n')
    expect(text).toContain('June 2027')
    expect(text).toContain('flexible')
  })

  it('composes the message from the angler\'s own text plus the summary', () => {
    const message = composeBriefMessage('  We are a father and son.  ', EXACT)
    expect(message.startsWith('We are a father and son.')).toBe(true)
    expect(message).toContain('Answers from the inquiry form')
    expect(message).toContain('Priority:')
  })

  it('composes a summary-only message when the angler typed nothing', () => {
    expect(composeBriefMessage(null, EXACT).startsWith('—')).toBe(true)
  })

  it('gives back only what the angler typed, so the agent is not told twice', () => {
    const message = composeBriefMessage('Two left-handed casters.', EXACT)
    expect(anglerTextFromMessage(message)).toBe('Two left-handed casters.')
    expect(anglerTextFromMessage(composeBriefMessage(null, EXACT))).toBeNull()
    // A v1 message has no marker and must come back untouched.
    expect(anglerTextFromMessage('Just a plain v1 message.')).toBe('Just a plain v1 message.')
  })
})

describe('budget bands of a custom page (tj 2026-10-07, option A)', () => {
  it('cuts the page\'s own range into four bands, in the page\'s currency', () => {
    // The Iceland seed page: €450.50 – €3,200.
    const bands = budgetBandOptions(45050, 320000, 'EUR')
    expect(bands.map(b => b.label)).toEqual([
      'under €1,400',
      '€1,400–€2,300',
      '€2,300–€3,200',
      'over €3,200',
    ])
    expect(bands.map(b => b.value)).toEqual([
      'EUR:0-140000',
      'EUR:140000-230000',
      'EUR:230000-320000',
      'EUR:320000+',
    ])
    // Every value the page offers must survive the schema.
    for (const band of bands) {
      expect(briefSchema.safeParse({ ...FLEXIBLE, budget_band: band.value }).success).toBe(true)
    }
  })

  it('offers no bands — and therefore no question — when the page has no usable range', () => {
    expect(budgetBandOptions(null, null, 'EUR')).toEqual([])
    expect(budgetBandOptions(65000, null, 'NZD')).toEqual([])
    expect(budgetBandOptions(320000, 45050, 'EUR')).toEqual([])
  })

  it('reads a stored band back as the label the angler saw', () => {
    expect(budgetBandLabel('NZD:0-50000')).toBe('under NZ$500')
    expect(budgetBandLabel('EUR:500000+')).toBe('over €5,000')
  })
})
