/**
 * FA-M.06 — the reminder threshold: in season 12 h, outside 24 h, no data 24 h. Pure function.
 */
import { describe, it, expect } from 'vitest'
import { reminderThresholdHours, IN_SEASON_HOURS, OFF_SEASON_HOURS } from '../reminder-threshold'

const NZ_SEASON = [10, 11, 12, 1, 2, 3, 4]   // wraps the year end, as experience_pages stores it

describe('reminderThresholdHours', () => {
  it('in season → 12 h (New Zealand, January)', () => {
    expect(reminderThresholdHours(['2027-01-14', '2027-01-15'], NZ_SEASON)).toBe(12)
    expect(IN_SEASON_HOURS).toBe(12)
  })

  it('outside season → 24 h (New Zealand, July)', () => {
    expect(reminderThresholdHours(['2027-07-10'], NZ_SEASON)).toBe(24)
    expect(OFF_SEASON_HOURS).toBe(24)
  })

  it('no season data (guide without pages / empty season_months) → 24 h', () => {
    expect(reminderThresholdHours(['2027-01-14'], [])).toBe(24)
  })

  it('no dates (flexible) → 24 h', () => {
    expect(reminderThresholdHours([], NZ_SEASON)).toBe(24)
  })

  it('dates spanning the season end: one date in season is enough → 12 h', () => {
    expect(reminderThresholdHours(['2027-04-30', '2027-05-01'], NZ_SEASON)).toBe(12)
  })

  it('several pages merged: a month from any of them counts', () => {
    expect(reminderThresholdHours(['2027-06-20'], [...NZ_SEASON, 6, 7, 8])).toBe(12)
  })

  it('garbage is ignored, not trusted (bad dates, months outside 1–12) → 24 h', () => {
    expect(reminderThresholdHours(['14/01/2027', '2027-13-01'], [0, 13, 1.5])).toBe(24)
  })
})
