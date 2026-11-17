/**
 * Calendar link encryption at rest (FA-M.09, tj D1 b).
 *
 * A calendar share link is a secret: whoever holds it reads the whole calendar, titles included.
 * The database holds only `v1:<iv>:<tag>:<ciphertext>` (AES-256-GCM, base64url parts); the key
 * lives in `CALENDAR_LINK_KEY` and never in the database, so a read of the database (backup, dump,
 * a read-everything role) cannot be turned back into a link.
 *
 * The key is optional for the app as a whole (tj 2026-11-17): when it is missing or malformed,
 * `calendarLinkKey()` says so and calendar connect / sync refuse with a clear error — the rest of
 * the site is unaffected. Server-only: never import from a client component.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '@/lib/env'

const VERSION = 'v1'
const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12
/** Binds a ciphertext to its purpose: a blob from another feature with the same key will not decrypt. */
const AAD = Buffer.from('fa-calendar-link-v1', 'utf8')
const ENVELOPE_RE = /^v1:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/

export type CalendarKeyState =
  | { ok: true; key: Buffer }
  | { ok: false; reason: 'missing' | 'malformed' }

/** What the admin, the cron log and the tests see when the key is not usable. Never contains the value. */
export const CALENDAR_DISABLED_MESSAGE =
  'Calendar connect and sync are disabled: CALENDAR_LINK_KEY is missing or is not 32 bytes of base64.'

/** The key, or why there is none. `raw` defaults to the environment; tests pass it explicitly. */
export function calendarLinkKey(raw: string | undefined = env.CALENDAR_LINK_KEY): CalendarKeyState {
  if (raw == null || raw.trim() === '') return { ok: false, reason: 'missing' }
  const value = raw.trim()
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return { ok: false, reason: 'malformed' }
  const key = Buffer.from(value, 'base64')
  return key.length === KEY_BYTES ? { ok: true, key } : { ok: false, reason: 'malformed' }
}

/** Encrypts a calendar link. A fresh IV every call, so the same link never gives the same blob. */
export function encryptCalendarLink(link: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  cipher.setAAD(AAD)
  const ciphertext = Buffer.concat([cipher.update(link, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':')
}

/** The link, or null when the blob is malformed, tampered with, or was made with another key. */
export function decryptCalendarLink(envelope: string, key: Buffer): string | null {
  const m = ENVELOPE_RE.exec(envelope)
  if (m == null) return null
  try {
    const iv = Buffer.from(m[1], 'base64url')
    const tag = Buffer.from(m[2], 'base64url')
    if (iv.length !== IV_BYTES || tag.length !== 16) return null
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAAD(AAD)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(Buffer.from(m[3], 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
