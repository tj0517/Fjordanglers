/**
 * FA-1.87 — the first touch is written once and never overwritten while it is valid;
 * it expires after 90 days like `fa_utm`, and blocked storage never throws.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { firstTouchInquiryFields, getStoredFirstTouch, storeFirstTouchOnce } from './first-touch'

class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string): string | null { return this.m.get(k) ?? null }
  setItem(k: string, v: string): void { this.m.set(k, v) }
  removeItem(k: string): void { this.m.delete(k) }
}

const SITE = { hostname: 'www.fjordanglers.com' }

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-12T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('first touch', () => {
  it('the first visit is recorded: outside host, landing path without query, time', () => {
    storeFirstTouchOnce('https://www.google.com/search?q=norway+salmon', { ...SITE, pathname: '/norway' })
    expect(getStoredFirstTouch()).toEqual({
      referrer_host: 'www.google.com',
      landing_path:  '/norway',
      at:            '2026-11-12T12:00:00.000Z',
    })
  })

  it('a second visit with a different referrer does not overwrite it', () => {
    storeFirstTouchOnce('https://www.google.com/', { ...SITE, pathname: '/norway' })
    vi.setSystemTime(new Date('2026-11-20T12:00:00Z'))
    storeFirstTouchOnce('https://l.instagram.com/', { ...SITE, pathname: '/iceland' })
    expect(getStoredFirstTouch()).toEqual({
      referrer_host: 'www.google.com',
      landing_path:  '/norway',
      at:            '2026-11-12T12:00:00.000Z',
    })
  })

  it('after 90 days it expires and the next visit records a new first touch', () => {
    storeFirstTouchOnce('https://www.google.com/', { ...SITE, pathname: '/norway' })
    vi.setSystemTime(new Date('2027-02-11T12:00:01Z'))  // 90 days + 1 s
    expect(getStoredFirstTouch()).toBeNull()
    storeFirstTouchOnce('https://l.instagram.com/', { ...SITE, pathname: '/iceland' })
    expect(getStoredFirstTouch()?.referrer_host).toBe('l.instagram.com')
  })

  it('no referrer or our own site → referrer null, but the touch (path, time) is recorded', () => {
    storeFirstTouchOnce('', { ...SITE, pathname: '/' })
    expect(firstTouchInquiryFields()).toEqual({
      first_referrer_host: null, landing_path: '/', first_touch_at: '2026-11-12T12:00:00.000Z',
    })
    localStorage.removeItem('fa_first_touch')
    storeFirstTouchOnce('https://fjordanglers.com/trips', { ...SITE, pathname: '/norway' })
    expect(getStoredFirstTouch()?.referrer_host).toBeNull()
  })

  it('no first touch → all three inquiry fields null', () => {
    expect(firstTouchInquiryFields()).toEqual({ first_referrer_host: null, landing_path: null, first_touch_at: null })
  })

  it('a tampered entry is reduced again on read; garbage reads as no first touch', () => {
    localStorage.setItem('fa_first_touch', JSON.stringify({
      value: { referrer_host: 'https://evil.example/x?y', landing_path: '//evil.example', at: '2026-11-10T00:00:00Z' },
      expires: Date.now() + 1000,
    }))
    expect(getStoredFirstTouch()).toEqual({ referrer_host: 'evil.example', landing_path: null, at: '2026-11-10T00:00:00.000Z' })
    localStorage.setItem('fa_first_touch', '{not json')
    expect(getStoredFirstTouch()).toBeNull()
  })

  it('blocked storage never throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    })
    expect(() => storeFirstTouchOnce('https://www.google.com/', { ...SITE, pathname: '/' })).not.toThrow()
    expect(firstTouchInquiryFields()).toEqual({ first_referrer_host: null, landing_path: null, first_touch_at: null })
  })
})
