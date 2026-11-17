/**
 * "Connect calendar" link tokens (FA-M.09) — same shape as the request tokens of FA-M.03:
 * 32 bytes from the CSPRNG, base64url (43 characters), travelling in `/connect-calendar/<token>`.
 * The database stores only the sha256 (hex), so a read of `guide_calendar_connect_links` cannot be
 * turned back into a working link. The plain token is returned once, to the admin who issued it,
 * and is never stored, logged or put into an audit row.
 */

import { createHash, randomBytes } from 'node:crypto'

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

export function generateCalendarConnectToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashCalendarConnectToken(token) }
}

/** True when the string has the shape of a token (cheap filter before any lookup). */
export function isCalendarConnectToken(value: string): boolean {
  return TOKEN_RE.test(value)
}

/** sha256 of the token as lower-case hex — the value stored in `token_hash`. */
export function hashCalendarConnectToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
