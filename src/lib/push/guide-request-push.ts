/**
 * FA-M.12 — the push a guide gets when a new request is sent to them. SERVER-ONLY.
 *
 * Runs AFTER the admin's response (the action hands it to Next's `after()`, which on Vercel keeps
 * the function alive through `waitUntil` until this promise settles). It never throws: a push
 * failure cannot fail, delay or roll back the request, which is already committed with its
 * guide.request_sent event and wa.me link. WhatsApp stays the guaranteed channel.
 *
 * Steps: keys present? → the guide login's subscriptions → one push each (in parallel, each bounded
 * by the sender's timeout) → delete the ones the push service says are gone (404/410) → one
 * guide.request_push_sent event (tj D3 A: only when a push was attempted).
 *
 * The job carries the request page path `/r/<token>`: it goes only into the encrypted push payload.
 * Never into the event, a log line, a DB column or an error message. Endpoints likewise.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { emitEvent } from '@/lib/events/emit'
import { vapidConfigFromEnv, warnPushOffOnce, type VapidConfig } from './config'
import { webPushSender, type PushSender } from './sender'
import { listPushSubscriptionsForGuide, removeGonePushSubscriptions } from './subscriptions'

type Client = SupabaseClient<Database>

export interface GuideRequestPushJob {
  inquiryId: string
  requestId: string
  guideId:   string
  title:     string
  body:      string
  /** `/r/<token>` — secret; payload only. */
  path:      string
}

export type GuideRequestPushResult =
  | { status: 'push_off' }
  | { status: 'no_subscriptions' }
  | { status: 'attempted'; sent: number; failed: number; removed: number }
  | { status: 'error' }

export async function notifyGuideOfNewRequest(
  client: Client,
  job: GuideRequestPushJob,
  deps: { config?: VapidConfig; sender?: PushSender } = {},
): Promise<GuideRequestPushResult> {
  let step = 'config'
  try {
    const config = deps.config ?? vapidConfigFromEnv()
    if (!config.ok) {
      warnPushOffOnce()
      return { status: 'push_off' }
    }
    const sender = deps.sender ?? webPushSender(config)

    step = 'subscriptions'
    const subscriptions = await listPushSubscriptionsForGuide(client, job.guideId)
    if (subscriptions.length === 0) return { status: 'no_subscriptions' }

    step = 'send'
    const payload = JSON.stringify({ title: job.title, body: job.body, url: job.path, tag: `request-${job.requestId}` })
    const outcomes = await Promise.all(
      subscriptions.map(sub => sender.send(sub, payload).catch(() => 'failed' as const)),
    )
    const sent   = outcomes.filter(o => o === 'sent').length
    const failed = outcomes.length - sent
    const goneIds = subscriptions.filter((_, i) => outcomes[i] === 'gone').map(sub => sub.id)

    step = 'remove_gone'
    let removed = 0
    try {
      removed = await removeGonePushSubscriptions(client, goneIds)
    } catch {
      console.error(`[push] request ${job.requestId}: could not remove ${goneIds.length} gone subscription(s)`)
    }

    step = 'event'
    await emitEvent(client, {
      inquiryId: job.inquiryId,
      type:      'guide.request_push_sent',
      actor:     { kind: 'system' },
      source:    'app',
      channel:   'app',
      payload:   { request_id: job.requestId, guide_id: job.guideId, sent, failed, removed },
    })
    return { status: 'attempted', sent, failed, removed }
  } catch (error) {
    // Name and step only: messages from lower layers are not trusted to be free of values.
    const name = error instanceof Error ? error.name : 'unknown'
    console.error(`[push] request ${job.requestId}: push failed at ${step} (${name}); the request itself was sent`)
    return { status: 'error' }
  }
}
