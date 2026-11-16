/**
 * FA-M.03 — request link token and trip-country time zones (no database).
 */

import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { generateGuideRequestToken, hashGuideRequestToken, isGuideRequestToken } from '../token'
import { COUNTRIES, COUNTRY_TIMEZONE, tripTimezone } from '@/lib/countries'

describe('generateGuideRequestToken', () => {
  it('is 32 CSPRNG bytes as base64url (43 chars, [A-Za-z0-9_-]) and its hash is sha256 hex', () => {
    const { token, tokenHash } = generateGuideRequestToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(tokenHash).toBe(createHash('sha256').update(token, 'utf8').digest('hex'))
    expect(hashGuideRequestToken(token)).toBe(tokenHash)
    expect(isGuideRequestToken(token)).toBe(true)
  })

  it('never repeats (1000 draws) and the hash never equals the token', () => {
    const draws = Array.from({ length: 1000 }, () => generateGuideRequestToken())
    expect(new Set(draws.map(d => d.token)).size).toBe(1000)
    for (const d of draws) expect(d.tokenHash).not.toBe(d.token)
  })

  it('isGuideRequestToken rejects anything not shaped like a token', () => {
    for (const bad of ['', 'a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}=`, `${'a'.repeat(42)}+`, `${'a'.repeat(42)}/`]) {
      expect(isGuideRequestToken(bad)).toBe(false)
    }
  })
})

describe('COUNTRY_TIMEZONE / tripTimezone', () => {
  it('every entry in COUNTRIES has a valid IANA zone', () => {
    for (const c of COUNTRIES) {
      const zone = COUNTRY_TIMEZONE[c]
      expect(zone, c).toBeTruthy()
      expect(() => new Intl.DateTimeFormat('en-CA', { timeZone: zone }), `${c} → ${zone}`).not.toThrow()
    }
    expect(Object.keys(COUNTRY_TIMEZONE).sort()).toEqual([...COUNTRIES].sort())
  })

  it('maps the trip country (case/space-insensitive); "Other", null and unknown → UTC', () => {
    expect(tripTimezone('New Zealand')).toBe('Pacific/Auckland')
    expect(tripTimezone(' iceland ')).toBe('Atlantic/Reykjavik')
    expect(tripTimezone('Chile')).toBe('America/Santiago')
    expect(tripTimezone('Other')).toBe('UTC')
    expect(tripTimezone(null)).toBe('UTC')
    expect(tripTimezone('Atlantis')).toBe('UTC')
  })
})
