/**
 * FA-M.12 — sending one web push. SERVER-ONLY.
 *
 * `PushSender` is the seam tests replace with a fake (no real push service is ever called in a
 * test). The real one wraps `web-push` (tj D4 A): it encrypts the payload for the browser
 * (RFC 8291) and signs the request with the VAPID key (RFC 8292).
 *
 * A sender never throws and never logs: it answers sent / failed / gone. `gone` = the push service
 * says the subscription no longer exists (404 / 410) and the row should be removed.
 */

import { sendNotification, WebPushError, type RequestOptions } from 'web-push'

export interface PushTarget {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export type PushOutcome = 'sent' | 'failed' | 'gone'

export interface PushSender {
  send(target: PushTarget, payload: string): Promise<PushOutcome>
}

/** A push is pointless once the request is a day old on the guide's side; the link stays valid. */
const TTL_SECONDS = 24 * 60 * 60
/** Per push service request: the whole push runs after the response, but must stay bounded. */
const TIMEOUT_MS = 5_000

export interface VapidKeys { publicKey: string; privateKey: string; subject: string }

export function pushRequestOptions(config: VapidKeys): RequestOptions {
  return {
    vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
    TTL:     TTL_SECONDS,
    urgency: 'high',
    timeout: TIMEOUT_MS,
  }
}

export function webPushSender(config: VapidKeys): PushSender {
  const options = pushRequestOptions(config)
  return {
    async send(target, payload) {
      try {
        await sendNotification(target, payload, options)
        return 'sent'
      } catch (error) {
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) return 'gone'
        return 'failed'
      }
    },
  }
}
