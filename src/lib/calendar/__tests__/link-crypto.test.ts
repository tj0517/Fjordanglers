import { describe, expect, it } from 'vitest'
import { envSchema } from '@/lib/env'
import {
  CALENDAR_DISABLED_MESSAGE,
  calendarLinkKey,
  decryptCalendarLink,
  encryptCalendarLink,
} from '../link-crypto'
import { TEST_CALENDAR_LINK_KEY, TEST_CALENDAR_LINK_KEY_TEXT } from './test-key'

const LINK = 'webcal://p00-caldav.icloud.example/published/2/SYNTHETIC-SECRET-PATH'

function testKey(): Buffer {
  const state = calendarLinkKey(TEST_CALENDAR_LINK_KEY)
  if (!state.ok) throw new Error('test key rejected')
  return state.key
}

describe('CALENDAR_LINK_KEY is optional for the app (tj 2026-11-17)', () => {
  const base = envSchema.safeParse({ ...process.env, CALENDAR_LINK_KEY: undefined })

  it('the env schema accepts an environment without the key — the site starts', () => {
    expect(base.success).toBe(true)
  })

  it('the env schema accepts a malformed key too — the format is checked only where it is used', () => {
    expect(envSchema.safeParse({ ...process.env, CALENDAR_LINK_KEY: 'not-a-key' }).success).toBe(true)
  })

  it('missing key → calendar disabled with a reason, no throw', () => {
    expect(calendarLinkKey(undefined)).toEqual({ ok: false, reason: 'missing' })
    expect(calendarLinkKey('   ')).toEqual({ ok: false, reason: 'missing' })
  })

  it('malformed key → disabled (not base64, or not 32 bytes)', () => {
    expect(calendarLinkKey('not a key!')).toEqual({ ok: false, reason: 'malformed' })
    expect(calendarLinkKey(Buffer.alloc(16).toString('base64'))).toEqual({ ok: false, reason: 'malformed' })
  })

  it('the disabled message names the variable, never a value', () => {
    expect(CALENDAR_DISABLED_MESSAGE).toContain('CALENDAR_LINK_KEY')
    expect(CALENDAR_DISABLED_MESSAGE).not.toContain(TEST_CALENDAR_LINK_KEY)
  })
})

describe('link encryption', () => {
  it('the test key is 32 bytes and says it is a test value', () => {
    expect(Buffer.byteLength(TEST_CALENDAR_LINK_KEY_TEXT)).toBe(32)
    expect(TEST_CALENDAR_LINK_KEY_TEXT).toMatch(/^TEST-ONLY/)
  })

  it('round-trips, and the stored blob contains no part of the link', () => {
    const blob = encryptCalendarLink(LINK, testKey())
    expect(blob).toMatch(/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/)
    expect(blob).not.toContain('SYNTHETIC')
    expect(blob).not.toContain('icloud')
    expect(decryptCalendarLink(blob, testKey())).toBe(LINK)
  })

  it('the same link encrypts differently every time (fresh IV)', () => {
    expect(encryptCalendarLink(LINK, testKey())).not.toBe(encryptCalendarLink(LINK, testKey()))
  })

  it('RED: another key, a tampered blob or garbage → null, never the link', () => {
    const blob = encryptCalendarLink(LINK, testKey())
    const otherKey = Buffer.alloc(32, 7)
    expect(decryptCalendarLink(blob, otherKey)).toBeNull()
    const parts = blob.split(':')
    const flipped = Buffer.from(parts[3], 'base64url')
    flipped[0] ^= 1
    expect(decryptCalendarLink([parts[0], parts[1], parts[2], flipped.toString('base64url')].join(':'), testKey())).toBeNull()
    expect(decryptCalendarLink('v1:abc', testKey())).toBeNull()
  })
})
