/**
 * Guide invite codes (FA-M.08).
 *
 * The code is 32 random bytes, base64url (43 characters) — it travels in the invite link.
 * The database stores only its sha256 (hex), so a read of `guide_invites` cannot be turned
 * back into a working link (tj decision D3, 2026-11-14).
 */

import { createHash, randomBytes } from 'node:crypto'

const CODE_RE = /^[A-Za-z0-9_-]{43}$/

/** A fresh invite code. Shown to the admin once, never stored or logged. */
export function generateInviteCode(): string {
  return randomBytes(32).toString('base64url')
}

/** True when the string has the shape of an invite code (cheap pre-filter before any lookup). */
export function isInviteCode(value: string): boolean {
  return CODE_RE.test(value)
}

/** sha256 of the code as lower-case hex — the value stored in `guide_invites.token_hash`. */
export function hashInviteCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex')
}
