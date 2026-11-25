/**
 * FA-M.12 — VAPID keys for web push. SERVER-ONLY.
 *
 *   VAPID_PUBLIC_KEY   base64url P-256 public key (65 bytes). The only one that may reach the browser.
 *   VAPID_PRIVATE_KEY  base64url private key (32 bytes). Secret: never NEXT_PUBLIC_*, never logged.
 *   VAPID_SUBJECT      mailto: or https: contact the push services can reach FA at.
 *
 * All three optional (production keys are added by tj, FA-M.11). With any missing or malformed,
 * push is off: requests are still sent on WhatsApp, the account toggle says "not available", and
 * one log line says so — without any value.
 */

import { env } from '@/lib/env'

export type VapidConfig =
  | { ok: true; publicKey: string; privateKey: string; subject: string }
  | { ok: false }

const PUBLIC_KEY_RE  = /^[A-Za-z0-9_-]{87}$/
const PRIVATE_KEY_RE = /^[A-Za-z0-9_-]{43}$/
const SUBJECT_RE     = /^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/

export function parseVapidConfig(vars: {
  VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string
}): VapidConfig {
  const publicKey  = vars.VAPID_PUBLIC_KEY?.trim() ?? ''
  const privateKey = vars.VAPID_PRIVATE_KEY?.trim() ?? ''
  const subject    = vars.VAPID_SUBJECT?.trim() ?? ''
  if (!PUBLIC_KEY_RE.test(publicKey) || !PRIVATE_KEY_RE.test(privateKey) || !SUBJECT_RE.test(subject)) {
    return { ok: false }
  }
  return { ok: true, publicKey, privateKey, subject }
}

export function vapidConfigFromEnv(): VapidConfig {
  return parseVapidConfig(env)
}

/** For the account page: the public key, or null when push is off. Never the private key. */
export function vapidPublicKey(): string | null {
  const config = vapidConfigFromEnv()
  return config.ok ? config.publicKey : null
}

let warnedMissing = false

/** One line per server instance, no values. */
export function warnPushOffOnce(): void {
  if (warnedMissing) return
  warnedMissing = true
  console.warn('[push] VAPID keys missing or malformed — web push is off (requests still go out on WhatsApp)')
}
