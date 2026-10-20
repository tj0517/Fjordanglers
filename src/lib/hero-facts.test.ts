import { describe, it, expect } from 'vitest'
import { parseHeroFacts } from './experience-v2-content'
import { formatIssues, heroFactsOrNullSchema } from './experiences/v2-editor'

/**
 * `experience_pages.hero_facts` (FA-1.63): the reader the public page uses and the schema
 * the admin form and its action share. Every key is optional; empty means "computed".
 */

const none = {
  location: null, dayLength: null, groupSize: null, season: null, gearIncluded: null, startPickup: null,
}

describe('parseHeroFacts', () => {
  it('reads a full row', () => {
    expect(parseHeroFacts({
      location: 'Tierra del Fuego', day_length: 'multi_day', group_size: '2–4 anglers',
      season: 'Nov–Apr', gear_included: true, start_pickup: 'Hotel in Río Grande\n7:00',
    })).toEqual({
      location: 'Tierra del Fuego', dayLength: 'multi_day', groupSize: '2–4 anglers',
      season: 'Nov–Apr', gearIncluded: true, startPickup: 'Hotel in Río Grande\n7:00',
    })
  })

  it('reads a partial row — the rest stay null, i.e. computed', () => {
    expect(parseHeroFacts({ location: 'X' })).toEqual({ ...none, location: 'X' })
    expect(parseHeroFacts({ day_length: 'half_day' })).toEqual({ ...none, dayLength: 'half_day' })
  })

  it('keeps gear_included: false — "Not included" is a value, not an absence', () => {
    expect(parseHeroFacts({ gear_included: false })).toEqual({ ...none, gearIncluded: false })
  })

  it('returns null for an empty row, and treats empty strings as absent', () => {
    expect(parseHeroFacts(null)).toBeNull()
    expect(parseHeroFacts(undefined)).toBeNull()
    expect(parseHeroFacts({})).toBeNull()
    expect(parseHeroFacts({ location: '', season: '   ', start_pickup: '' })).toBeNull()
    expect(parseHeroFacts({ location: '  Otago ', season: '' })).toEqual({ ...none, location: 'Otago' })
  })

  it('returns null for garbage', () => {
    expect(parseHeroFacts({ day_length: 'week' })).toBeNull()
    expect(parseHeroFacts('Tierra del Fuego')).toBeNull()
    expect(parseHeroFacts(42)).toBeNull()
    expect(parseHeroFacts(true)).toBeNull()
    expect(parseHeroFacts([{ location: 'X' }])).toBeNull()
    expect(parseHeroFacts({ location: 7, gear_included: 'yes', group_size: ['2'] })).toBeNull()
  })

  it('drops a key with the wrong type on its own — its chip falls back, the rest stay', () => {
    expect(parseHeroFacts({ location: 'X', day_length: 'week', gear_included: 'yes' }))
      .toEqual({ ...none, location: 'X' })
  })
})

describe('heroFactsOrNullSchema (admin form and saveExperienceV2HeroFacts)', () => {
  it('stores only the keys that say something, trimmed', () => {
    const parsed = heroFactsOrNullSchema.parse({
      location: ' Tierra del Fuego ', day_length: 'multi_day', group_size: '2–4 anglers',
      season: 'Nov–Apr', gear_included: true, start_pickup: '',
    })
    expect(parsed).toEqual({
      location: 'Tierra del Fuego', day_length: 'multi_day', group_size: '2–4 anglers',
      season: 'Nov–Apr', gear_included: true,
    })
  })

  it('stores NULL when nothing is typed', () => {
    expect(heroFactsOrNullSchema.parse({
      location: '', day_length: null, group_size: ' ', season: '', gear_included: null, start_pickup: '',
    })).toBeNull()
    expect(heroFactsOrNullSchema.parse({})).toBeNull()
    expect(heroFactsOrNullSchema.parse(null)).toBeNull()
  })

  it('keeps gear_included: false', () => {
    expect(heroFactsOrNullSchema.parse({ gear_included: false })).toEqual({ gear_included: false })
  })

  it("refuses day_length: 'week' with a message the form can show", () => {
    const parsed = heroFactsOrNullSchema.safeParse({ location: 'X', day_length: 'week' })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(formatIssues(parsed.error)).toBe('Day length must be full day, half day or multi-day')
  })

  it('refuses a non-boolean gear_included and over-long text', () => {
    expect(heroFactsOrNullSchema.safeParse({ gear_included: 'yes' }).success).toBe(false)
    expect(heroFactsOrNullSchema.safeParse({ location: 'x'.repeat(81) }).success).toBe(false)
    expect(heroFactsOrNullSchema.safeParse({ start_pickup: 'x'.repeat(501) }).success).toBe(false)
  })
})
