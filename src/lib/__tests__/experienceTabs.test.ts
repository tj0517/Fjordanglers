/**
 * experience-tabs — FA-1.08 regression proof.
 *
 * The bug this file pins down: `switchTab` derived the hash from a two-entry
 * table, so tab 3 and beyond produced no hash, `tabFromHash` read an empty
 * string and answered 0 — clicking those tabs bounced the reader back to
 * Overview. Experiences with 1–2 options were unaffected, which is why neither
 * CI nor a quick click-through caught it.
 */

import { describe, it, expect } from 'vitest'
import { hashForTab, tabFromHash } from '@/lib/experience-tabs'

describe('hashForTab', () => {
  it('gives Overview no hash', () => {
    expect(hashForTab(0)).toBeNull()
  })

  it('keeps the historical names for tabs 1 and 2', () => {
    expect(hashForTab(1)).toBe('day-trip')
    expect(hashForTab(2)).toBe('multi-day')
  })

  it('addresses every further tab as option-N', () => {
    expect(hashForTab(3)).toBe('option-3')
    expect(hashForTab(5)).toBe('option-5')
    expect(hashForTab(12)).toBe('option-12')
  })

  it('has no hash for a nonsensical index', () => {
    expect(hashForTab(-1)).toBeNull()
    expect(hashForTab(1.5)).toBeNull()
    expect(hashForTab(Number.NaN)).toBeNull()
  })
})

describe('tabFromHash — round trip', () => {
  for (const optionCount of [1, 2, 3, 5]) {
    it(`every tab of an experience with ${optionCount} option(s) maps back to itself`, () => {
      for (let idx = 1; idx <= optionCount; idx++) {
        const hash = hashForTab(idx)
        expect(hash).not.toBeNull()
        expect(tabFromHash(hash as string, optionCount)).toBe(idx)
      }
    })
  }
})

describe('tabFromHash — out of range', () => {
  it('rejects a tab the experience does not have', () => {
    expect(tabFromHash('option-9', 3)).toBe(0)
    expect(tabFromHash('option-4', 3)).toBe(0)
    expect(tabFromHash('option-99', 5)).toBe(0)
  })

  it('keeps multi-day off an experience with a single option', () => {
    expect(tabFromHash('multi-day', 1)).toBe(0)
    expect(tabFromHash('day-trip',  0)).toBe(0)
  })

  it('never answers with a tab beyond the option count', () => {
    for (const hash of ['day-trip', 'multi-day', 'option-3', 'option-5', 'option-50']) {
      for (const optionCount of [0, 1, 2, 3, 5]) {
        expect(tabFromHash(hash, optionCount)).toBeLessThanOrEqual(optionCount)
      }
    }
  })
})

describe('tabFromHash — junk', () => {
  it('falls back to Overview', () => {
    for (const junk of ['', 'option-', 'option-abc', 'option-0', 'option-03', 'Day-Trip', 'faq', '#day-trip']) {
      expect(tabFromHash(junk, 5)).toBe(0)
    }
  })

  it('does not accept option-1 / option-2 — tabs 1 and 2 have their own names', () => {
    expect(tabFromHash('option-1', 5)).toBe(0)
    expect(tabFromHash('option-2', 5)).toBe(0)
  })
})
