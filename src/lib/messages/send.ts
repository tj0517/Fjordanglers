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
import { whatsappAdapter } from '@/lib/channels/whatsapp'
import { instagramAdapter } from '@/lib/channels/instagram'
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
  /** When provided, UPDATE this existing draft row instead of inserting a new one. */
  draftId?:      string
  actor:         EventActor
  /** guides.id — only when counterpart='guide'. */
  counterpartId?: string | null
  /** Existing thread key (Message-ID of last outbound) for In-Reply-To threading. */
  threadKey?:    string | null
  /**
   * WA only: pre-approved Meta template name. Required when canSendFreeform is false.
   * If not provided and the 24-h window is closed, send() throws.
   */
  templateName?: string
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
    draftedBy, draftId, actor, counterpartId, threadKey,
  } = params

  // 1. Acquire message row — update existing draft if draftId given, else insert new
  let messageId: string

  if (draftId != null) {
    const { error: updateErr } = await client
      .from('messages')
      .update({
        body,
        subject:     subject ?? null,
        status:      'queued',
        drafted_by:  draftedBy,
        occurred_at: new Date().toISOString(),
      })
      .eq('id', draftId)

    if (updateErr != null) {
      throw new Error(`[sendMessage] draft update failed: ${updateErr.message}`)
    }
    messageId = draftId
  } else {
    const { data: inserted, error: insertErr } = await client
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
    messageId = inserted.id
  }

  // 2. Send via adapter
  let externalId: string | null = null
  let newThreadKey: string | null = null
  let sendError: string | null = null

  try {
    if (channel === 'email') {
      const result = await emailAdapter.send({ to, subject, body, threadKey })
      externalId   = result.externalId
      newThreadKey = result.threadKey
    } else if (channel === 'whatsapp') {
      // Fetch last inbound WA message to determine if 24-h freeform window is open
      const { data: lastInbound } = await client
        .from('messages')
        .select('occurred_at')
        .eq('inquiry_id', inquiryId)
        .eq('channel', 'whatsapp')
        .eq('direction', 'inbound')
        .order('occurred_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const lastInboundAt = lastInbound?.occurred_at ? new Date(lastInbound.occurred_at as string) : null
      const result = await whatsappAdapter.send({
        to, body, templateName: params.templateName, lastInboundAt,
      })
      externalId   = result.externalId
      newThreadKey = result.threadKey
    } else if (channel === 'instagram') {
      const result = await instagramAdapter.send({ to, body })
      externalId   = result.externalId
      newThreadKey = result.threadKey
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err)
    console.error(`[sendMessage] send failed for ${messageId}:`, err)
  }

  // 3. Update message with result
  await client
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
    payload:   { drafted_by: draftedBy },
  })

  // 5. If first outbound to guide, emit guide.contacted
  if (counterpart === 'guide') {
    const { count } = await client
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
