/**
 * FA-M.12 — validating a browser's push subscription before it is stored.
 *
 * The server later sends HTTP requests to `endpoint`, a URL the guide's browser supplies, so it is
 * checked here and nowhere else (tj D1b A: no direct writes bypass this): https only, default port,
 * no credentials, host on the allowlist of known push services. Anything else is refused.
 *
 * Pure — no I/O. The endpoint and keys are never put in an error message.
 */

import { z } from 'zod'

/** Exact hosts. */
const PUSH_HOSTS: ReadonlySet<string> = new Set([
  'fcm.googleapis.com',                    // Chrome, Edge on Android, Samsung Internet, Opera
  'updates.push.services.mozilla.com',     // Firefox
])

/** Host suffixes (a dot in front: `evil-push.apple.com` does not match `.push.apple.com`). */
const PUSH_HOST_SUFFIXES: readonly string[] = [
  '.push.apple.com',                       // Safari / iOS home-screen apps (web.push.apple.com)
  '.notify.windows.com',                   // Edge on Windows (wns2-*.notify.windows.com)
]

export function isAllowedPushEndpoint(value: string): boolean {
  if (value.length > 2048) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (url.username !== '' || url.password !== '' || url.port !== '') return false
  if (url.pathname === '/' || url.pathname === '') return false
  const host = url.hostname.toLowerCase()
  return PUSH_HOSTS.has(host) || PUSH_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))
}

export const pushEndpointSchema = z.string().refine(isAllowedPushEndpoint, 'Unsupported push service.')

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/

/** The shape of `PushSubscription.toJSON()`; extra fields (expirationTime) are dropped. */
export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  keys: z.object({
    p256dh: z.string().min(80).max(100).regex(BASE64URL),
    auth:   z.string().min(16).max(32).regex(BASE64URL),
  }),
})

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>
