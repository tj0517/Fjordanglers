/**
 * sendMessage — the one path for all outbound messages. FA-1.12.
 *
 * Inserts a messages row (status 'queued'), sends via the channel adapter,
 * updates status to 'sent'/'failed', and emits message.sent.
 * If this is the first outbound message to a guide on this inquiry, also
 * emits guide.contacted.
 *
 * SERVER-ONLY. Callers: src/actions/messages.ts and src/lib/ai/inquiry-agent.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { emitEvent, type EventActor } from '@/lib/events/emit'
import { emailAdapter } from '@/lib/channels/email'
import type { EventChannel } from '@/lib/events/types'

type Client = SupabaseClient<Database>

export interface SendMessageParams {
  inquiryId:     string
  channel:       'email' | 'whatsapp' | 'instagram'
  counterpart:   'angler' | 'guide'
  /** Email address or phone number of the counterpart. */
  to:            string
  subject?:      string
  body:          string
  draftedBy:     'admin' | 'agent'
  actor:         EventActor
  /** guides.id — only when counterpart='guide'. */
  counterpartId?: string | null
  /** Existing thread key (Message-ID of last outbound) for In-Reply-To threading. */
  threadKey?:    string | null
}

export interface SendMessageResult {
  messageId: string
  threadKey: string | null
}

export async function sendMessage(
  client: Client,
  params: SendMessageParams,
): Promise<SendMessageResult> {
  const {
    inquiryId, channel, counterpart, to, subject, body,
    draftedBy, actor, counterpartId, threadKey,
  } = params

  // 1. Insert row with status 'queued'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertErr } = await (client as any)
    .from('messages')
    .insert({
      inquiry_id:     inquiryId,
      channel,
      direction:      'outbound',
      counterpart,
      counterpart_id: counterpartId ?? null,
      subject:        subject ?? null,
      body,
      status:         'queued',
      drafted_by:     draftedBy,
      thread_key:     threadKey ?? null,
      occurred_at:    new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertErr != null || inserted == null) {
    throw new Error(`[sendMessage] insert failed: ${insertErr?.message ?? 'no row returned'}`)
  }

  const messageId: string = inserted.id

  // 2. Send via adapter
  let externalId: string | null = null
  let newThreadKey: string | null = null
  let sendError: string | null = null

  try {
    if (channel === 'email') {
      const result = await emailAdapter.send({ to, subject, body, threadKey })
      externalId  = result.externalId
      newThreadKey = result.threadKey
    } else {
      // WhatsApp / Instagram: adapters arrive in FA-1.13
      // For now: mark as queued and fall through (no actual send)
      sendError = `${channel} sending not yet implemented — queued`
      console.warn(`[sendMessage] ${channel} adapter not available yet — message ${messageId} queued`)
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err)
    console.error(`[sendMessage] send failed for ${messageId}:`, err)
  }

  // 3. Update message with result
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any)
    .from('messages')
    .update({
      status:      sendError != null ? 'failed' : 'sent',
      external_id: externalId,
      thread_key:  newThreadKey ?? threadKey ?? null,
    })
    .eq('id', messageId)

  if (sendError != null) {
    throw new Error(`[sendMessage] delivery failed: ${sendError}`)
  }

  // 4. Emit message.sent
  await emitEvent(client, {
    inquiryId,
    type:      'message.sent',
    actor,
    source:    'app',
    channel:   channel as EventChannel,
    messageId,
  })

  // 5. If first outbound to guide, emit guide.contacted
  if (counterpart === 'guide') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (client as any)
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('inquiry_id', inquiryId)
      .eq('counterpart', 'guide')
      .eq('direction', 'outbound')
      .neq('id', messageId)

    if ((count ?? 0) === 0) {
      await emitEvent(client, {
        inquiryId,
        type:      'guide.contacted',
        actor,
        source:    'app',
        channel:   channel as EventChannel,
        messageId,
        payload:   counterpartId != null ? { guide_id: counterpartId } : {},
      })
    }
  }

  return { messageId, threadKey: newThreadKey ?? threadKey ?? null }
}
