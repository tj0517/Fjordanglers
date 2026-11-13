/**
 * FA-1.87 — reducing untrusted attribution input to what we store.
 *
 * Used on both sides: the browser reduces `document.referrer` / `location.pathname` before
 * storing or sending them, and the server runs the same functions again on whatever arrives
 * (the browser is not trusted). Every function returns `null` for anything odd — attribution
 * is a measurement and must never cost an inquiry or an event.
 *
 * The shapes match the CHECK constraints on `inquiries` (migration 20261112000000):
 *   host: lower-case, no port, `^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$`, ≤ 253
 *   path: starts with one `/`, no whitespace or control characters, ≤ 500, no query/fragment
 */

const MAX_INPUT = 2048
const MAX_HOST = 253
const MAX_PATH = 500
const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/

/** Whitespace or a control character (C0, DEL, C1 — Postgres [:cntrl:] may count C1 in UTF-8). */
function hasSpaceOrControl(s: string): boolean {
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f) || /\s/.test(ch)) return true
  }
  return false
}

/** One leading `/`, not `//`, nothing that is whitespace or a control character. */
function isSitePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !hasSpaceOrControl(path)
}

/** Max age of a first-touch timestamp the server accepts — the browser keeps it 90 days. */
const FIRST_TOUCH_MAX_AGE_MS = 91 * 24 * 60 * 60 * 1000
const CLOCK_SKEW_MS = 10 * 60 * 1000

/**
 * A referrer (full URL or bare host) → its host name, or null.
 * Only http(s) URLs count; the port, path and query are dropped.
 */
export function normaliseReferrerHost(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (raw === '' || raw.length > MAX_INPUT) return null

  let host: string
  if (raw.includes('://')) {
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      return null
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    host = url.hostname
  } else {
    host = raw
  }

  host = host.toLowerCase().replace(/\.$/, '')
  if (host.length > MAX_HOST || !HOST_RE.test(host)) return null
  return host
}

/** A page path → the path alone (query and fragment cut off), or null. */
export function normaliseLandingPath(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > MAX_INPUT) return null
  const path = input.split(/[?#]/, 1)[0] ?? ''
  if (path.length > MAX_PATH || !isSitePath(path)) return null
  return path
}

/** An ISO timestamp from the browser → ISO string, or null when unparseable / implausible. */
export function normaliseFirstTouchAt(input: unknown, now: number = Date.now()): string | null {
  if (typeof input !== 'string' || input.length > 64) return null
  const t = Date.parse(input)
  if (Number.isNaN(t)) return null
  if (t > now + CLOCK_SKEW_MS || t < now - FIRST_TOUCH_MAX_AGE_MS) return null
  return new Date(t).toISOString()
}

/** `www.example.com` and `example.com` are the same site. */
function siteOf(host: string): string {
  return host.startsWith('www.') ? host.slice(4) : host
}

/**
 * The referrer host as the first touch records it: an outside site's host, or null when
 * there was no referrer or it is our own site (a link inside the site is not a source).
 */
export function outsideReferrerHost(referrer: unknown, ownHost: string): string | null {
  const host = normaliseReferrerHost(referrer)
  if (host == null) return null
  const own = normaliseReferrerHost(ownHost)
  if (own != null && siteOf(host) === siteOf(own)) return null
  return host
}
