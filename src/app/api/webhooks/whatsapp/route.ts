/**
 * WhatsApp Cloud API webhook
 *
 * GET  — Meta hub.challenge verification
 * POST — Incoming message events (text + media stubs)
 *
 * Setup:
 *  1. developers.facebook.com → App → WhatsApp → Configuration → Webhook
 *  2. URL: https://fjordanglers.com/api/webhooks/whatsapp
 *  3. Verify Token = WHATSAPP_VERIFY_TOKEN env var
 *  4. Subscribe to "messages" field
 *  5. WHATSAPP_APP_SECRET = App Settings → Basic → App Secret
 */

import crypto from 'crypto'
import { env } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'
import { matchInquiryByPhone } from '@/lib/inquiry-matcher'

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

// ─── POST — incoming messages ─────────────────────────────────────────────────

export async function POST(req: Request) {
  const rawBody = await req.text()

  // Verify HMAC-SHA256 signature from Meta
  const signature = req.headers.get('x-hub-signature-256')
  if (env.WHATSAPP_APP_SECRET && signature) {
    const expected = 'sha256=' + crypto
      .createHmac('sha256', env.WHATSAPP_APP_SECRET)
      .update(rawBody)
      .digest('hex')

    if (signature !== expected) {
      console.warn('[whatsapp-webhook] Signature mismatch — rejected')
      return new Response('Invalid signature', { status: 401 })
    }
  }

  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const supabase = createServiceClient()

  // Iterate over entries → changes → messages
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      if (!value?.messages?.length) continue

      // Build a name lookup from contacts array
      const nameMap: Record<string, string> = {}
      for (const contact of value.contacts ?? []) {
        nameMap[contact.wa_id] = contact.profile?.name ?? ''
      }

      for (const message of value.messages) {
        if (message.type !== 'text' && message.type !== 'image' && message.type !== 'audio' && message.type !== 'video' && message.type !== 'document') {
          continue
        }

        const from        = message.from  // e.g. "48123456789" (no leading +)
        const senderName  = nameMap[from] ?? ''
        const content     = message.type === 'text'
          ? (message.text?.body ?? '')
          : `[Media attachment received — type: ${message.type}]`
        const rawPayload  = message as unknown as Record<string, unknown>

        const inquiryId = await matchInquiryByPhone(from)

        if (inquiryId) {
          // Matched — insert directly into lead_messages
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any).from('lead_messages').insert({
            inquiry_id:   inquiryId,
            direction:    'inbound',
            channel:      'whatsapp',
            contact_type: 'client',
            contact_name: senderName || from,
            content,
            created_by:   'webhook',
          })

          if (error) {
            console.error('[whatsapp-webhook] lead_messages insert error:', error)
          } else {
            // Bump last_contact_at
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('inquiries')
              .update({ last_contact_at: new Date().toISOString() })
              .eq('id', inquiryId)

            console.log(`[whatsapp-webhook] Message from ${from} → inquiry ${inquiryId}`)
          }
        } else {
          // No match — queue for manual linking
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any).from('unmatched_messages').insert({
            source:           'whatsapp',
            from_identifier:  from,
            sender_name:      senderName,
            content,
            raw_payload:      rawPayload,
          })

          if (error) {
            console.error('[whatsapp-webhook] unmatched_messages insert error:', error)
          } else {
            console.log(`[whatsapp-webhook] Unmatched message from ${from} queued`)
          }
        }
      }
    }
  }

  // Always return 200 — Meta retries on non-200 responses
  return new Response('OK', { status: 200 })
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
      }
      field: string
    }>
  }>
}

interface WhatsAppMessage {
  from: string
  id: string
  timestamp: string
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contacts'
  text?: { body: string }
  image?: { id: string; mime_type: string; sha256: string; caption?: string }
  audio?: { id: string; mime_type: string }
  video?: { id: string; mime_type: string; caption?: string }
  document?: { id: string; mime_type: string; filename?: string }
}
