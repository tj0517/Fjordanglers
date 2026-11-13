/**
 * FA-1.87 — the reducers that turn untrusted referrer / landing path / time into what we store.
 * Every hostile value must come out as null (or as its harmless part), never throw.
 */
import { describe, it, expect } from 'vitest'
import { normaliseFirstTouchAt, normaliseLandingPath, normaliseReferrerHost, outsideReferrerHost } from './attribution'

describe('normaliseReferrerHost', () => {
  it.each([
    ['https://www.google.com/', 'www.google.com'],
    ['https://www.google.com/search?q=salmon+norway&client=x', 'www.google.com'],
    ['https://user:secret@Search.Yahoo.COM:8443/path#frag', 'search.yahoo.com'],
    ['http://l.instagram.com/?u=https%3A%2F%2Ffjordanglers.com', 'l.instagram.com'],
    ['www.bing.com', 'www.bing.com'],
    ['WWW.BING.COM', 'www.bing.com'],
    ['www.example.com.', 'www.example.com'],
    ['https://bücher.example/', 'xn--bcher-kva.example'],
  ])('%j → %j', (input, host) => {
    expect(normaliseReferrerHost(input)).toBe(host)
  })

  it.each([
    ['empty', ''],
    ['javascript URL', 'javascript:alert(1)'],
    ['data URL', 'data:text/html,<script>alert(1)</script>'],
    ['android-app URL', 'android-app://com.google.android.googlequicksearchbox/'],
    ['ftp URL', 'ftp://files.example.com/'],
    ['markup', '<script>alert(1)</script>'],
    ['host with a space', 'www.goo gle.com'],
    ['host with a port, no scheme', 'google.com:443'],
    ['path without scheme', 'www.google.com/search'],
    ['over-long host', 'a'.repeat(254)],
    ['over-long input', 'https://www.google.com/?q=' + 'x'.repeat(3000)],
    ['malformed URL', 'https://'],
    ['number', 42],
    ['object', { host: 'www.google.com' }],
    ['array', ['www.google.com']],
    ['null', null],
    ['undefined', undefined],
  ])('%s → null', (_name, input) => {
    expect(normaliseReferrerHost(input)).toBeNull()
  })
})

describe('normaliseLandingPath', () => {
  it.each([
    ['/', '/'],
    ['/norway', '/norway'],
    ['/experiences/salmon-on-the-gaula?gclid=abc&utm_source=x', '/experiences/salmon-on-the-gaula'],
    ['/iceland#faq', '/iceland'],
    ['/caf%C3%A9', '/caf%C3%A9'],
  ])('%j → %j', (input, path) => {
    expect(normaliseLandingPath(input)).toBe(path)
  })

  it.each([
    ['empty', ''],
    ['protocol-relative', '//evil.example/x'],
    ['absolute URL', 'https://evil.example/'],
    ['javascript URL', 'javascript:alert(1)'],
    ['no leading slash', 'norway'],
    ['space', '/a b'],
    ['newline', '/a\nb'],
    ['NUL', '/a\u0000b'],
    ['C1 control', '/a\u0085b'],
    ['over 500', '/' + 'a'.repeat(500)],
    ['over-long input', '/' + 'a'.repeat(3000)],
    ['number', 1],
    ['null', null],
  ])('%s → null', (_name, input) => {
    expect(normaliseLandingPath(input)).toBeNull()
  })

  it('exactly 500 characters is kept', () => {
    const p = '/' + 'a'.repeat(499)
    expect(normaliseLandingPath(p)).toBe(p)
  })
})

describe('normaliseFirstTouchAt', () => {
  const now = Date.parse('2026-11-12T12:00:00Z')

  it('a recent ISO time is kept (as ISO, UTC)', () => {
    expect(normaliseFirstTouchAt('2026-11-01T10:00:00+01:00', now)).toBe('2026-11-01T09:00:00.000Z')
  })

  it.each([
    ['not a date', 'yesterday'],
    ['in the future', '2026-11-13T12:00:00Z'],
    ['older than 91 days', '2026-08-01T00:00:00Z'],
    ['over-long', '2026-11-01T10:00:00Z' + ' '.repeat(100)],
    ['number', now],
    ['null', null],
  ])('%s → null', (_name, input) => {
    expect(normaliseFirstTouchAt(input, now)).toBeNull()
  })
})

describe('outsideReferrerHost', () => {
  it('our own site is not a source — with or without www', () => {
    expect(outsideReferrerHost('https://www.fjordanglers.com/norway', 'www.fjordanglers.com')).toBeNull()
    expect(outsideReferrerHost('https://fjordanglers.com/', 'www.fjordanglers.com')).toBeNull()
    expect(outsideReferrerHost('http://localhost:3000/', 'localhost')).toBeNull()
  })

  it('another site is', () => {
    expect(outsideReferrerHost('https://www.google.com/', 'www.fjordanglers.com')).toBe('www.google.com')
  })

  it('no referrer is null', () => {
    expect(outsideReferrerHost('', 'www.fjordanglers.com')).toBeNull()
  })
})
