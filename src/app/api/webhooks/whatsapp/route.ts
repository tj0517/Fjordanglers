/**
 * WhatsApp Cloud API webhook — FA-1.13
 *
 * GET  — Meta hub.challenge verification
 * POST — Incoming message events + delivery status updates
 *
 * HMAC Option B: WHATSAPP_APP_SECRET is required. Absent secret → 401 immediately.
 * Bad signature → 401. Correct signature → proceed.
 *
 * NIE MERGOWAĆ dopóki tj nie potwierdzi, że WHATSAPP_APP_SECRET jest ustawiony
 * w środowisku produkcyjnym Vercel.
 *
 * Setup:
 *  1. developers.facebook.com → App → WhatsApp → Configuration → Webhook
 *  2. URL: https://fjordanglers.com/api/webhooks/whatsapp
 *  3. Verify Token = WHATSAPP_VERIFY_TOKEN env var
 *  4. Subscribe to "messages" field
 *  5. WHATSAPP_APP_SECRET = App Settings → Basic → App Secret
 */

import crypto from 'crypto'
import type { Json } from '@/lib/supabase/database.types'
import { env } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'
import { matchInboundPhone } from '@/lib/inquiry-matcher'
import { whatsappAdapter } from '@/lib/channels/whatsapp'
import { emitEvent } from '@/lib/events/emit'

// ─── GET — hub verification ───────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[whatsapp-webhook] Hub verification successful')
    return new Response(challenge ?? '', { status: 200 })
  }

  console.warn('[whatsapp-webhook] Hub verification failed — token mismatch')
  return new Response('Forbidden', { status: 403 })
}

// ─── POST — incoming messages + delivery statuses ────────────────────────────

export async function POST(req: Request) {
  const rawBody = await req.text()

  // Option B: secret absent → 401 immediately (no key = not configured for prod)
  const secret = env.WHATSAPP_APP_SECRET
  if (!secret) {
    console.warn('[whatsapp-webhook] WHATSAPP_APP_SECRET not configured — rejecting request')
    return new Response('Webhook secret not configured', { status: 401 })
  }

  const signature = req.headers.get('x-hub-signature-256')
  if (!signature) {
    return new Response('Missing x-hub-signature-256 header', { status: 401 })
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  // timingSafeEqual requires same-length buffers
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    console.warn('[whatsapp-webhook] Signature mismatch — rejected')
    return new Response('Invalid signature', { status: 401 })
  }

  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const supabase = createServiceClient()

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value

      // ── Delivery status updates ───────────────────────────────────────────
      for (const statusUpdate of value.statuses ?? []) {
        const newStatus = STATUS_MAP[statusUpdate.status]
        if (!newStatus) continue
        await supabase
          .from('messages')
          .update({ status: newStatus })
          .eq('external_id', statusUpdate.id)
      }

      // ── Inbound messages ──────────────────────────────────────────────────
      if (!value.messages?.length) continue

      // Build contact name lookup
      const nameMap: Record<string, string> = {}
      for (const contact of value.contacts ?? []) {
        nameMap[contact.wa_id] = contact.profile?.name ?? ''
      }

      for (const rawMsg of value.messages) {
        const inbound = whatsappAdapter.parseInbound(rawMsg as unknown as Record<string, unknown>)
        if (!inbound) continue

        const from       = inbound.from   // E.164 e.g. "+48123456789"
        const rawPhone   = rawMsg.from    // without +
        const senderName = nameMap[rawPhone] ?? ''

        const candidates = await matchInboundPhone(from)

        if (candidates.length === 1) {
          const { inquiryId, counterpart, counterpartId } = candidates[0]
          const { data: newMsg, error } = await supabase
            .from('messages')
            .insert({
              inquiry_id:     inquiryId,
              direction:      'inbound',
              channel:        'whatsapp',
              counterpart,
              counterpart_id: counterpartId ?? null,
              body:           inbound.body,
              external_id:    inbound.externalId,
              status:         'received',
              drafted_by:     null,
              media:          inbound.media
                ? (inbound.media as unknown as Json)
                : null,
              occurred_at:    inbound.occurredAt.toISOString(),
            })
            .select('id')
            .single()

          if (error) {
            console.error('[whatsapp-webhook] messages insert error:', error)
          } else {
            await supabase
              .from('inquiries')
              .update({ last_contact_at: new Date().toISOString() })
              .eq('id', inquiryId)

            await emitEvent(supabase, {
              inquiryId,
              type:      'message.received',
              actor:     { kind: counterpart === 'guide' ? 'guide' : 'angler' },
              source:    'webhook',
              channel:   'whatsapp',
              messageId: newMsg?.id ?? null,
            })

            console.log(
              `[whatsapp-webhook] ${counterpart} ${from} → inquiry ${inquiryId}`,
            )
          }
        } else {
          // No match or multiple candidates → unmatched queue
          const { error } = await supabase.from('unmatched_messages').insert({
            source:          'whatsapp',
            from_identifier: rawPhone,
            sender_name:     senderName,
            content:         inbound.body,
            raw_payload: {
              message:    rawMsg,
              candidates: candidates.map(c => c.inquiryId),
            } as unknown as Json,
          })

          if (error) {
            console.error('[whatsapp-webhook] unmatched_messages insert error:', error)
          } else {
            const reason = candidates.length === 0 ? 'no match' : `${candidates.length} candidates`
            console.log(`[whatsapp-webhook] ${from} queued as unmatched (${reason})`)
          }
        }
      }
    }
  }

  // Always return 200 — Meta retries on non-200
  return new Response('OK', { status: 200 })
}

// ─── Delivery status map ──────────────────────────────────────────────────────

const STATUS_MAP: Record<string, 'sent' | 'delivered' | 'read' | 'failed'> = {
  sent:      'sent',
  delivered: 'delivered',
  read:      'read',
  failed:    'failed',
}

// ─── Meta payload types ───────────────────────────────────────────────────────

interface MetaWebhookPayload {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: string
        metadata: { display_phone_number: string; phone_number_id: string }
        contacts?: Array<{ wa_id: string; profile?: { name: string } }>
        messages?: WhatsAppMessage[]
        statuses?: Array<{
          id:           string
          status:       string
          timestamp:    string
          recipient_id: string
        }>
      }
      field: string
    }>
  }>
}

interface WhatsAppMessage {
  from:       string
  id:         string
  timestamp:  string
  type:       'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contacts'
  text?:      { body: string }
  image?:     { id: string; mime_type: string; sha256: string; caption?: string }
  audio?:     { id: string; mime_type: string }
  video?:     { id: string; mime_type: string; caption?: string }
  document?:  { id: string; mime_type: string; filename?: string }
}
