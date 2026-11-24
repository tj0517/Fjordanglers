/**
 * FA-M.05 (D4 a) — parseGuidePhone: admin input → E.164 (`+`, 8–15 digits, no leading 0 in the
 * country code) or "clear". No country guessing.
 */
import { describe, it, expect } from 'vitest'
import { parseGuidePhone } from '@/lib/guide-contacts'

describe('parseGuidePhone', () => {
  it.each([
    ['+64211234567', '+64211234567'],
    [' +47 (912) 34-567 ', '+4791234567'],
    ['+354.555.1234', '+3545551234'],
    ['+12345678', '+12345678'],                  // 8 digits — lower bound
    ['+123456789012345', '+123456789012345'],    // 15 digits — upper bound
  ])('accepts %j → %s', (raw, expected) => {
    expect(parseGuidePhone(raw)).toEqual({ ok: true, phoneE164: expected })
  })

  it.each(['', '   '])('empty %j clears the number', raw => {
    expect(parseGuidePhone(raw)).toEqual({ ok: true, phoneE164: null })
  })

  it.each([
    '0211234567',            // no '+'
    '0047 912 34 567',       // 00 prefix — not guessed
    '+1234567',              // 7 digits
    '+1234567890123456',     // 16 digits
    '+0211234567',           // country code starting with 0
    '+64 21 abc',            // letters
    '+64/211234567',         // other separators
  ])('rejects %j', raw => {
    expect(parseGuidePhone(raw)).toEqual({ ok: false })
  })
})
