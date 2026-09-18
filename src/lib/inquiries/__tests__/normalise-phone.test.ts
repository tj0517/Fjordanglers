/**
 * FA-1.13 — normalisePhoneForStorage unit tests.
 *
 * Mirrors the 4 rules in the 20260918135418 migration DO block.
 */

import { describe, it, expect } from 'vitest'
import { normalisePhoneForStorage } from '@/lib/inquiries/create'

describe('normalisePhoneForStorage', () => {
  // Rule 1: starts with + → already E.164, strip formatting only
  it('leaves a clean E.164 number unchanged', () => {
    expect(normalisePhoneForStorage('+48698936563')).toBe('+48698936563')
  })

  it('strips formatting chars from a +48 number with spaces', () => {
    expect(normalisePhoneForStorage('+48 698 936 563')).toBe('+48698936563')
  })

  // Rule 2: 00-prefix → replace with +
  it('converts 00-prefix to +', () => {
    expect(normalisePhoneForStorage('0048698936563')).toBe('+48698936563')
  })

  // Rule 3: exactly 9 stripped digits → +48 (Polish local)
  it('prepends +48 for a 9-digit local number', () => {
    expect(normalisePhoneForStorage('698936563')).toBe('+48698936563')
  })

  // Rule 4: ambiguous length → leave original unchanged
  it('leaves an 11-digit number unchanged (US/CA without +)', () => {
    expect(normalisePhoneForStorage('19529138811')).toBe('19529138811')
  })

  it('leaves a 10-digit number unchanged (NANP local)', () => {
    expect(normalisePhoneForStorage('9418754191')).toBe('9418754191')
  })

  it('leaves a short unrecognised number unchanged', () => {
    expect(normalisePhoneForStorage('12345')).toBe('12345')
  })

  // Null / empty
  it('returns null for empty string', () => {
    expect(normalisePhoneForStorage('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(normalisePhoneForStorage('   ')).toBeNull()
  })

  it('returns null for null', () => {
    expect(normalisePhoneForStorage(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(normalisePhoneForStorage(undefined)).toBeNull()
  })
})
