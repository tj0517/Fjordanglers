/**
 * Client-side funnel telemetry helper — FA-0.15.
 *
 * Sends events to POST /api/events via navigator.sendBeacon (preferred,
 * survives page unload) with a fetch keepalive fallback.
 *
 * No cookie consent required — no personal identifier is read or sent
 * by this module (no ad-click ids, no browser storage, no session id).
 *
 * FA-1.87 — `referrer_host` is sent by the page, not read by the server from the beacon's
 * own Referer header (which is always our site). The page the visitor landed on (the one
 * this document was loaded with) reports the host of `document.referrer`; any page reached
 * after that by a link inside the site reports our own host — `document.referrer` does not
 * change on client-side navigation, so it would otherwise credit every page of the visit
 * to the outside referrer (tj decision 2026-11-12).
 */

import { normaliseReferrerHost } from '@/lib/attribution'

type WebEventName = 'page_view' | 'form_open' | 'form_submit'

interface WebEventPayload {
  event:         WebEventName
  path:          string
  country?:      string
  utm_campaign?: string
  utm_content?:  string
}

/** Path the document was loaded with (the landing page); undefined until first asked. */
let landingPath: string | undefined
/** Set once a page other than the landing page has been viewed in this document. */
let leftLandingPage = false

function documentLoadPath(): string | null {
  try {
    const nav = performance.getEntriesByType('navigation')[0]
    return nav != null ? new URL(nav.name).pathname : null
  } catch {
    return null
  }
}

/** The referrer host for an event on `path` — see the header. */
function referrerHostFor(path: string): string | null {
  landingPath ??= documentLoadPath() ?? path
  if (path !== landingPath) leftLandingPage = true
  return normaliseReferrerHost(leftLandingPage ? window.location.hostname : document.referrer)
}

/**
 * Fire-and-forget event beacon to /api/events.
 * Uses sendBeacon (Blob, application/json) so the event survives navigation;
 * falls back to fetch keepalive when sendBeacon returns false or is unavailable.
 */
export function sendWebEvent(payload: WebEventPayload): void {
  const referrer_host = referrerHostFor(payload.path) ?? undefined
  const data = JSON.stringify({ ...payload, referrer_host })
  const blob = new Blob([data], { type: 'application/json' })

  // Primary: sendBeacon — browser queues it even if the page is closing
  if (typeof navigator !== 'undefined' && navigator.sendBeacon('/api/events', blob)) {
    return
  }

  // Fallback: fetch with keepalive — keeps the request alive past page unload
  void fetch('/api/events', {
    method:    'POST',
    headers:   { 'Content-Type': 'application/json' },
    body:      data,
    keepalive: true,
  }).catch(() => undefined) // fire and forget — telemetry loss is acceptable
}
