/**
 * Fetching a calendar link the guide pasted (FA-M.09). The link is outside input and the request
 * runs on FA's server, so this module is the guard against it being pointed at FA's own network:
 *
 *   * the link must be `https://` or `webcal://` (fetched as https), no user:password, port 443;
 *   * every address the host resolves to must be public — loopback, private, link-local, CGNAT,
 *     multicast, documentation and similar ranges are refused. The check runs inside the socket's
 *     own DNS lookup, so the address that is checked is the address that is connected to;
 *   * redirects are followed by hand, at most 3, each new location checked the same way;
 *   * at most 10 s and 5 MB per fetch.
 *
 * The link itself is a secret: it is never logged and never part of an error. Errors carry a code.
 */

import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP, type LookupFunction } from 'node:net'
import { z } from 'zod'

export const FETCH_TIMEOUT_MS = 10_000
export const FETCH_MAX_BYTES = 5 * 1024 * 1024
export const FETCH_MAX_REDIRECTS = 3

export type CalendarFetchError =
  | 'invalid_url'
  | 'blocked_address'
  | 'not_found'
  | 'http_error'
  | 'timeout'
  | 'too_large'
  | 'too_many_redirects'
  | 'network'

export type CalendarFetchResult = { ok: true; body: string } | { ok: false; error: CalendarFetchError }

// ─── the link ────────────────────────────────────────────────────────────────

const linkSchema = z.string().trim().min(1).max(2048)

/** The link as an https URL, or null when it is not one FA will fetch. */
export function normalizeCalendarLink(raw: unknown): URL | null {
  const parsed = linkSchema.safeParse(raw)
  if (!parsed.success) return null
  let url: URL
  try {
    url = new URL(parsed.data)
  } catch {
    return null
  }
  if (url.protocol === 'webcal:') {
    try {
      url = new URL(`https:${parsed.data.slice(parsed.data.indexOf(':') + 1)}`)
    } catch {
      return null
    }
  }
  if (url.protocol !== 'https:') return null
  if (url.username !== '' || url.password !== '') return null
  if (url.port !== '' && url.port !== '443') return null
  if (url.hostname === '') return null
  url.hash = ''
  return url
}

/** What the admin sees of a link: the host, lower-case, nothing of the path (tj D1). */
export function calendarLinkHost(url: URL): string {
  return url.hostname.toLowerCase()
}

// ─── addresses ───────────────────────────────────────────────────────────────

const blocked = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(net, prefix, 'ipv4')
for (const [net, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 23],
  ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
] as const) blocked.addSubnet(net, prefix, 'ipv6')

/** True for an address FA may connect to. IPv4-mapped IPv6 is judged by its IPv4 part. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !blocked.check(address, 'ipv4')
  if (family !== 6) return false
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (mapped != null) return isPublicAddress(mapped[1])
  if (/^::ffff:/i.test(address)) return false
  return !blocked.check(address, 'ipv6')
}

export class BlockedAddressError extends Error {
  constructor() {
    super('calendar host resolves to a non-public address')
    this.name = 'BlockedAddressError'
  }
}

type Resolver = (hostname: string) => Promise<LookupAddress[]>

const systemResolver: Resolver = hostname =>
  new Promise((resolveAll, reject) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => (err != null ? reject(err) : resolveAll(addresses)))
  })

/** A socket lookup that refuses the connection unless every resolved address is public. */
export function safeLookup(resolver: Resolver = systemResolver): LookupFunction {
  return (hostname, options, callback) => {
    resolver(hostname).then(
      addresses => {
        if (addresses.length === 0 || addresses.some(a => !isPublicAddress(a.address))) {
          callback(new BlockedAddressError(), '', 4)
          return
        }
        if (options.all === true) callback(null, addresses)
        else callback(null, addresses[0].address, addresses[0].family)
      },
      (err: NodeJS.ErrnoException) => callback(err, '', 4),
    )
  }
}

// ─── one request ─────────────────────────────────────────────────────────────

export interface HopResponse {
  status: number
  location: string | null
  body: Buffer
}

export class TooLargeError extends Error {
  constructor() {
    super('calendar response over the size limit')
    this.name = 'TooLargeError'
  }
}

/** One GET, no redirects followed. Rejects with BlockedAddressError / TooLargeError / AbortError / network errors. */
export type HopFn = (url: URL, signal: AbortSignal, maxBytes: number) => Promise<HopResponse>

export function httpsHop(resolver: Resolver = systemResolver): HopFn {
  return (url, signal, maxBytes) =>
    new Promise((resolveHop, reject) => {
      // A literal IP never reaches the lookup — check it here.
      const literal = url.hostname.replace(/^\[|\]$/g, '')
      if (isIP(literal) !== 0 && !isPublicAddress(literal)) {
        reject(new BlockedAddressError())
        return
      }
      const req = httpsRequest(url, {
        method: 'GET',
        lookup: safeLookup(resolver),
        signal,
        headers: { 'user-agent': 'FjordAnglers-CalendarSync/1.0', accept: 'text/calendar, text/plain;q=0.5, */*;q=0.1' },
      }, res => {
        const status = res.statusCode ?? 0
        const location = typeof res.headers.location === 'string' ? res.headers.location : null
        if (status >= 300 && status < 400) {
          res.resume()
          resolveHop({ status, location, body: Buffer.alloc(0) })
          return
        }
        const declared = Number(res.headers['content-length'])
        if (Number.isFinite(declared) && declared > maxBytes) {
          res.destroy()
          reject(new TooLargeError())
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > maxBytes) {
            res.destroy()
            reject(new TooLargeError())
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => resolveHop({ status, location, body: Buffer.concat(chunks) }))
        res.on('error', reject)
      })
      req.on('error', reject)
      req.end()
    })
}

// ─── the fetch ───────────────────────────────────────────────────────────────

export interface FetchOptions {
  hop?: HopFn
  timeoutMs?: number
  maxBytes?: number
}

function classify(err: unknown, timedOut: boolean): CalendarFetchError {
  if (timedOut) return 'timeout'
  if (err instanceof BlockedAddressError) return 'blocked_address'
  if (err instanceof TooLargeError) return 'too_large'
  return 'network'
}

/** Fetches a calendar link with every guard above. Never throws; never puts the link in an error. */
export async function fetchCalendar(rawLink: unknown, options: FetchOptions = {}): Promise<CalendarFetchResult> {
  const hop = options.hop ?? httpsHop()
  const maxBytes = options.maxBytes ?? FETCH_MAX_BYTES
  let url = normalizeCalendarLink(rawLink)
  if (url == null) return { ok: false, error: 'invalid_url' }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? FETCH_TIMEOUT_MS)

  try {
    for (let redirects = 0; ; redirects++) {
      const res = await Promise.race([
        hop(url, controller.signal, maxBytes),
        new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })),
      ])
      if (res.status >= 300 && res.status < 400) {
        if (redirects >= FETCH_MAX_REDIRECTS) return { ok: false, error: 'too_many_redirects' }
        if (res.location == null) return { ok: false, error: 'http_error' }
        let next: URL
        try {
          next = new URL(res.location, url)
        } catch {
          return { ok: false, error: 'http_error' }
        }
        // A redirect to anything FA would not fetch directly (http, credentials, another port) is refused.
        const checked = normalizeCalendarLink(next.toString())
        if (checked == null) return { ok: false, error: 'blocked_address' }
        url = checked
        continue
      }
      if (res.status === 404 || res.status === 410) return { ok: false, error: 'not_found' }
      if (res.status < 200 || res.status >= 300) return { ok: false, error: 'http_error' }
      if (res.body.length > maxBytes) return { ok: false, error: 'too_large' }
      return { ok: true, body: res.body.toString('utf8') }
    }
  } catch (err) {
    return { ok: false, error: classify(err, timedOut) }
  } finally {
    clearTimeout(timer)
  }
}
