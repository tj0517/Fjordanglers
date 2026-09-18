/**
 * FA-1.13 — normalisePhoneForStorage unit tests (libphonenumber-js).
 *
 * Rule 1: starts with '+' → validate/normalise with libphonenumber.
 * Rule 2: starts with '00' → convert to + then validate/normalise.
 * Rule 3: defaultCountry provided → country-aware parse.
 * Rule 4: no match → return original unchanged.
 */

import { describe, it, expect } from 'vitest'
import { normalisePhoneForStorage } from '@/lib/inquiries/create'

describe('normalisePhoneForStorage', () => {
  // Rule 1: starts with + → validate/normalise
  it('leaves a clean E.164 number unchanged', () => {
    expect(normalisePhoneForStorage('+48698936563')).toBe('+48698936563')
  })

  it('strips formatting chars from a +48 number with spaces', () => {
    expect(normalisePhoneForStorage('+48 698 936 563')).toBe('+48698936563')
  })

  it('leaves clean E.164 unchanged when defaultCountry is also provided', () => {
    expect(normalisePhoneForStorage('+48698936563', undefined)).toBe('+48698936563')
  })

  // Rule 2: 00-prefix → convert to +
  it('converts 00-prefix to +', () => {
    expect(normalisePhoneForStorage('0048698936563')).toBe('+48698936563')
  })

  // Rule 3: defaultCountry provided → country-aware parse
  it('normalises 9-digit local number with PL defaultCountry', () => {
    expect(normalisePhoneForStorage('698936563', 'PL')).toBe('+48698936563')
  })

  it('normalises 10-digit NANP number with US defaultCountry', () => {
    expect(normalisePhoneForStorage('9418754191', 'US')).toBe('+19418754191')
  })

  it('normalises 11-digit US number (with leading 1) with US defaultCountry', () => {
    expect(normalisePhoneForStorage('19529138811', 'US')).toBe('+19529138811')
  })

  // Rule 4: no country, ambiguous → leave original unchanged
  it('leaves a 9-digit number unchanged when no defaultCountry', () => {
    expect(normalisePhoneForStorage('698936563')).toBe('698936563')
  })

  it('leaves a 10-digit number unchanged when no defaultCountry', () => {
    expect(normalisePhoneForStorage('9418754191')).toBe('9418754191')
  })

  it('leaves an 11-digit number unchanged when no defaultCountry', () => {
    expect(normalisePhoneForStorage('19529138811')).toBe('19529138811')
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
