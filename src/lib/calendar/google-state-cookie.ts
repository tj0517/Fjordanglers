/**
 * The browser half of the OAuth `state` (FA-M.10). The start puts the plain state into Google's URL and
 * into this cookie; the callback accepts only a `state` equal to the cookie, so a state copied from
 * someone else's URL fails in another browser. httpOnly (no script reads it), sent only to the Google
 * calendar routes, 10 minutes like the database row. Server-only.
 */

import { timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

export const GOOGLE_STATE_COOKIE = 'fa_gcal_state'
const COOKIE_PATH = '/api/calendar/google'
const MAX_AGE_S = 600

/** Set from a server action, right before the browser goes to Google. */
export async function setGoogleStateCookie(state: string): Promise<void> {
  const jar = await cookies()
  jar.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Lax: sent on the top-level GET back from Google, not on cross-site sub-requests.
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: MAX_AGE_S,
  })
}

/** Cookie options that delete it (the callback always clears it). */
export const CLEAR_GOOGLE_STATE_COOKIE = { name: GOOGLE_STATE_COOKIE, value: '', path: COOKIE_PATH, maxAge: 0 } as const

/** Constant-time comparison of the `state` query value with the cookie. */
export function stateMatchesCookie(state: string, cookie: string | undefined): boolean {
  if (cookie == null || cookie === '') return false
  const a = Buffer.from(state, 'utf8')
  const b = Buffer.from(cookie, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}
