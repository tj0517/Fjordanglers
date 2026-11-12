/**
 * FA-1.87 — the visitor's first touch, kept next to UTM and gclid in localStorage.
 *
 * Written once, at the first visit: where the visitor came from (the referrer's host, or
 * null for no outside referrer), the page they landed on, and when. Later visits never
 * overwrite it; it expires after 90 days like `fa_utm`, and the next visit after that
 * records a new first touch. No full URL, no query string, nothing else is kept.
 */
import { normaliseFirstTouchAt, normaliseLandingPath, normaliseReferrerHost, outsideReferrerHost } from '@/lib/attribution'

const FIRST_TOUCH_KEY    = 'fa_first_touch'
const FIRST_TOUCH_TTL_MS = 90 * 24 * 60 * 60 * 1000  // 90 days — same as UTM

export interface FirstTouch {
  referrer_host: string | null
  landing_path:  string | null
  at:            string
}

interface FirstTouchEntry {
  value:   FirstTouch
  expires: number
}

/** The stored first touch, or null when there is none, it expired, or storage is blocked. */
export function getStoredFirstTouch(): FirstTouch | null {
  try {
    const raw = localStorage.getItem(FIRST_TOUCH_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as Partial<FirstTouchEntry> | null
    if (entry == null || typeof entry.expires !== 'number' || Date.now() > entry.expires) {
      localStorage.removeItem(FIRST_TOUCH_KEY)
      return null
    }
    const v = entry.value
    const at = normaliseFirstTouchAt(v?.at)
    if (v == null || at == null) return null
    return {
      referrer_host: normaliseReferrerHost(v.referrer_host),
      landing_path:  normaliseLandingPath(v.landing_path),
      at,
    }
  } catch {
    return null
  }
}

/** Records the first touch unless an unexpired one exists. */
export function storeFirstTouchOnce(referrer: string, location: Pick<Location, 'hostname' | 'pathname'>): void {
  if (getStoredFirstTouch() != null) return
  try {
    const entry: FirstTouchEntry = {
      value: {
        referrer_host: outsideReferrerHost(referrer, location.hostname),
        landing_path:  normaliseLandingPath(location.pathname),
        at:            new Date().toISOString(),
      },
      expires: Date.now() + FIRST_TOUCH_TTL_MS,
    }
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(entry))
  } catch {
    // localStorage may be blocked (private browsing, storage quota)
  }
}

/** The three inquiry fields, as POST /api/inquiries takes them; all null without a first touch. */
export function firstTouchInquiryFields(): {
  first_referrer_host: string | null
  landing_path:        string | null
  first_touch_at:      string | null
} {
  const ft = getStoredFirstTouch()
  return {
    first_referrer_host: ft?.referrer_host ?? null,
    landing_path:        ft?.landing_path ?? null,
    first_touch_at:      ft?.at ?? null,
  }
}
