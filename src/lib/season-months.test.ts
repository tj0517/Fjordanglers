import { describe, it, expect } from 'vitest'
import { seasonLabel } from './season-months'

describe('seasonLabel', () => {
  it('reads a southern-hemisphere season as one run across the year end', () => {
    // The NZ seed page: {10,11,12,1,2,3,4}
    expect(seasonLabel([10, 11, 12, 1, 2, 3, 4])).toBe('Oct–Apr')
  })

  it('reads a northern season as a plain range', () => {
    // The Iceland seed page: {6,7,8,9}
    expect(seasonLabel([6, 7, 8, 9])).toBe('Jun–Sep')
  })

  it('does not care what order the column comes back in', () => {
    expect(seasonLabel([3, 12, 1, 11, 2, 4, 10])).toBe('Oct–Apr')
  })

  it('prints a single month as itself, not as a range', () => {
    expect(seasonLabel([7])).toBe('Jul')
  })

  it('keeps a split season as two runs', () => {
    expect(seasonLabel([1, 2, 6, 7, 8])).toBe('Jan–Feb, Jun–Aug')
  })

  it('twelve months is "all year", not "Jan–Dec"', () => {
    expect(seasonLabel([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('all year')
  })

  it('no months → no chip', () => {
    expect(seasonLabel([])).toBeNull()
  })

  it('ignores values that are not months instead of printing undefined', () => {
    expect(seasonLabel([0, 13, 6, 7, -1, 6])).toBe('Jun–Jul')
  })
})
