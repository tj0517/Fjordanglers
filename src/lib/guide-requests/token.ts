/**
 * Guide request link tokens (FA-M.03).
 *
 * 32 bytes from the CSPRNG, base64url (43 characters) — the token travels in the request link
 * (FA-M.04 `/r/[token]`). The database stores only its sha256 (hex), so a read of
 * `guide_requests` cannot be turned back into a working link. The plain token is returned once,
 * by `createGuideRequest`, and is never stored, logged or put into an event payload.
 */

import { createHash, randomBytes } from 'node:crypto'

const TOKEN_BYTES = 32
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

export interface GuideRequestToken {
  /** Goes into the link. Never stored. */
  token: string
  /** sha256 hex — the value stored in `guide_requests.token_hash`. */
  tokenHash: string
}

/** The one place a request token is made. */
export function generateGuideRequestToken(): GuideRequestToken {
  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  return { token, tokenHash: hashGuideRequestToken(token) }
}

/** True when the string has the shape of a request token (cheap filter before any lookup). */
export function isGuideRequestToken(value: string): boolean {
  return TOKEN_RE.test(value)
}

/** sha256 of the token as lower-case hex. */
export function hashGuideRequestToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
