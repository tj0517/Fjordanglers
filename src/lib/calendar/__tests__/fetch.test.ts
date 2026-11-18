/**
 * Calendar link fetch guards (FA-M.09). No network: the DNS answer and the HTTP responses are
 * injected; the real https hop is exercised only on cases it refuses before connecting.
 */
import type { LookupAddress } from 'node:dns'
import { describe, expect, it } from 'vitest'
import {
  calendarLinkHost,
  fetchCalendar,
  httpsHop,
  isPublicAddress,
  normalizeCalendarLink,
  safeLookup,
  type HopFn,
  type HopResponse,
} from '../fetch'

const ICS = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n'
const LINK = 'webcal://p00-caldav.icloud.example/published/2/SYNTHETIC-SECRET'

/** A scripted server: one response per URL. */
function scripted(responses: Record<string, Partial<HopResponse> | Error>): HopFn {
  return async url => {
    const r = responses[url.toString()]
    if (r == null) throw new Error(`unexpected request to ${url.toString()}`)
    if (r instanceof Error) throw r
    return { status: 200, location: null, body: Buffer.alloc(0), ...r }
  }
}

describe('the link', () => {
  it('webcal:// becomes https://; https stays', () => {
    expect(normalizeCalendarLink(LINK)?.toString()).toBe('https://p00-caldav.icloud.example/published/2/SYNTHETIC-SECRET')
    expect(normalizeCalendarLink('  https://cal.example/x.ics  ')?.protocol).toBe('https:')
  })

  it('RED: http, ftp, javascript, credentials, other ports, garbage, non-strings → refused', () => {
    for (const bad of ['http://cal.example/x.ics', 'ftp://cal.example/x', 'javascript:alert(1)',
      'https://user:pw@cal.example/x', 'https://cal.example:8443/x', 'not a link', '', 42, null]) {
      expect(normalizeCalendarLink(bad), String(bad)).toBeNull()
    }
  })

  it('the admin hint is the host only', () => {
    const url = normalizeCalendarLink(LINK)
    expect(url).not.toBeNull()
    if (url == null) return
    expect(calendarLinkHost(url)).toBe('p00-caldav.icloud.example')
    expect(calendarLinkHost(url)).not.toContain('SYNTHETIC')
  })
})

describe('addresses', () => {
  it('public v4 / v6 → allowed', () => {
    expect(isPublicAddress('17.253.144.10')).toBe(true)
    expect(isPublicAddress('2620:149:a44::1')).toBe(true)
  })

  it('RED: loopback, private, link-local, CGNAT, metadata, multicast, mapped, ULA → refused', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1',
      '0.0.0.0', '224.0.0.1', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'nonsense']) {
      expect(isPublicAddress(ip), ip).toBe(false)
    }
  })

  it('RED: the socket lookup refuses a host when any resolved address is private', async () => {
    const resolver = async (): Promise<LookupAddress[]> => [
      { address: '17.253.144.10', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]
    const err = await new Promise<Error | null>(done => safeLookup(resolver)('cal.example', {}, e => done(e)))
    expect(err?.name).toBe('BlockedAddressError')
  })
})

describe('fetchCalendar', () => {
  it('200 with a calendar → body', async () => {
    const hop = scripted({ 'https://p00-caldav.icloud.example/published/2/SYNTHETIC-SECRET': { body: Buffer.from(ICS) } })
    expect(await fetchCalendar(LINK, { hop })).toEqual({ ok: true, body: ICS })
  })

  it('follows a redirect to another public https host', async () => {
    const hop = scripted({
      'https://a.example/cal': { status: 302, location: 'https://b.example/cal.ics' },
      'https://b.example/cal.ics': { body: Buffer.from(ICS) },
    })
    expect(await fetchCalendar('https://a.example/cal', { hop })).toEqual({ ok: true, body: ICS })
  })

  it('RED: a redirect to a private address is refused (checked again after the redirect)', async () => {
    const resolver = async (host: string): Promise<LookupAddress[]> =>
      host === 'a.example' ? [{ address: '17.253.144.10', family: 4 }] : [{ address: '192.168.0.10', family: 4 }]
    const real = httpsHop(resolver)
    let hops = 0
    const hop: HopFn = (url, signal, max) => {
      hops++
      if (url.hostname === 'a.example') return Promise.resolve({ status: 301, location: 'https://intranet.example/x', body: Buffer.alloc(0) })
      return real(url, signal, max)   // the real hop: its lookup sees 192.168.0.10 and refuses
    }
    expect(await fetchCalendar('https://a.example/cal', { hop })).toEqual({ ok: false, error: 'blocked_address' })
    expect(hops).toBe(2)
  })

  it('RED: a redirect to a literal loopback IP or to http → refused', async () => {
    const real = httpsHop(async () => [{ address: '17.253.144.10', family: 4 }])
    const hop: HopFn = (url, signal, max) => url.hostname === 'a.example'
      ? Promise.resolve({ status: 302, location: 'https://127.0.0.1/admin', body: Buffer.alloc(0) })
      : real(url, signal, max)
    expect(await fetchCalendar('https://a.example/cal', { hop })).toEqual({ ok: false, error: 'blocked_address' })
    const toHttp = scripted({ 'https://a.example/cal': { status: 302, location: 'http://a.example/cal' } })
    expect(await fetchCalendar('https://a.example/cal', { hop: toHttp })).toEqual({ ok: false, error: 'blocked_address' })
  })

  it('RED: the real hop refuses localhost and a private literal without connecting', async () => {
    expect(await fetchCalendar('https://localhost/x.ics', { hop: httpsHop() })).toEqual({ ok: false, error: 'blocked_address' })
    expect(await fetchCalendar('https://10.0.0.1/x.ics', { hop: httpsHop() })).toEqual({ ok: false, error: 'blocked_address' })
    expect(await fetchCalendar('https://[::1]/x.ics', { hop: httpsHop() })).toEqual({ ok: false, error: 'blocked_address' })
  })

  it('RED: more than 3 redirects → too_many_redirects', async () => {
    const hop: HopFn = async url => ({ status: 302, location: `${url.toString()}x`, body: Buffer.alloc(0) })
    expect(await fetchCalendar('https://a.example/', { hop })).toEqual({ ok: false, error: 'too_many_redirects' })
  })

  it('RED: 404 / 410 → not_found; 500 / 403 → http_error', async () => {
    for (const [status, error] of [[404, 'not_found'], [410, 'not_found'], [500, 'http_error'], [403, 'http_error']] as const) {
      const hop = scripted({ 'https://a.example/cal': { status } })
      expect(await fetchCalendar('https://a.example/cal', { hop })).toEqual({ ok: false, error })
    }
  })

  it('RED: no answer within the limit → timeout', async () => {
    const hop: HopFn = () => new Promise(() => {})
    expect(await fetchCalendar('https://a.example/cal', { hop, timeoutMs: 50 })).toEqual({ ok: false, error: 'timeout' })
  })

  it('RED: body over the size cap → too_large', async () => {
    const hop = scripted({ 'https://a.example/cal': { body: Buffer.alloc(101) } })
    expect(await fetchCalendar('https://a.example/cal', { hop, maxBytes: 100 })).toEqual({ ok: false, error: 'too_large' })
  })

  it('an error result never contains the link', async () => {
    const hop = scripted({ 'https://p00-caldav.icloud.example/published/2/SYNTHETIC-SECRET': new Error('ECONNRESET') })
    const r = await fetchCalendar(LINK, { hop })
    expect(r).toEqual({ ok: false, error: 'network' })
    expect(JSON.stringify(r)).not.toContain('SYNTHETIC')
  })
})
