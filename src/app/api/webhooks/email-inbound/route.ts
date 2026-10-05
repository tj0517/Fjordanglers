/**
 * Email inbound webhook — Resend Inbound
 *
 * Resend's inbound webhook payload does NOT include the email body by design.
 * After receiving the `email.received` event, we fetch the full email content
 * (html + text) via the Resend Receiving API using the email_id.
 *
 * Setup:
 *  1. Resend dashboard → Inbound → Create email (e.g. leads@fjordanglers.com)
 *  2. Webhook URL: https://fjordanglers.com/api/webhooks/email-inbound
 *  3. Copy signing secret → RESEND_INBOUND_SECRET env var
 */

import crypto from 'crypto'
import { z } from 'zod'
import type { Json } from '@/lib/supabase/database.types'
import { env } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'
import { matchInquiryByEmail, matchInquiryByRecipient } from '@/lib/inquiry-matcher'
import { emitEvent } from '@/lib/events/emit'
import { transition } from '@/lib/inquiries/state'
import { hasAgentAutoReply, autoSendReply } from '@/lib/ai/auto-send'
import { getInquiryStatusForD2 } from '@/lib/supabase/queries'

// ─── FA outbound address set ──────────────────────────────────────────────────

/**
 * Returns the set of lower-cased FA-owned email addresses (bare address only).
 * A mail whose `from` is in this set is treated as outbound (tj replied from Zoho).
 * Default: hello@fjordanglers.com + FA_EMAIL; override with FA_OUTBOUND_ADDRESSES.
 */
function getFaOutboundAddresses(): Set<string> {
  const raw = env.FA_OUTBOUND_ADDRESSES
  if (raw) {
    return new Set(
      raw.split(',').map(a => extractEmail(a.trim())).filter(Boolean),
    )
  }
  return new Set([
    'hello@fjordanglers.com',
    extractEmail(env.FA_EMAIL ?? 'contact@fjordanglers.com'),
  ])
}

// ─── Payload schema ───────────────────────────────────────────────────────────

const emailDataSchema = z.object({
  email_id: z.string().min(1),
  from:     z.string().min(1),
  to:       z.array(z.string()).optional(),
  subject:  z.string().optional(),
  text:     z.string().optional(),
})

const payloadSchema = z.object({
  type: z.string().optional(),
  data: emailDataSchema.optional(),
})

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const rawBody = await req.text()

  // Verify Resend inbound signature (svix-style)
  if (env.RESEND_INBOUND_SECRET) {
    const svixId        = req.headers.get('svix-id')        ?? ''
    const svixTimestamp = req.headers.get('svix-timestamp') ?? ''
    const svixSignature = req.headers.get('svix-signature') ?? ''

    if (svixId && svixTimestamp && svixSignature) {
      const toSign   = `${svixId}.${svixTimestamp}.${rawBody}`
      const secretKey = Buffer.from(
        env.RESEND_INBOUND_SECRET.replace(/^whsec_/, ''),
        'base64',
      )
      const computed = 'v1,' + crypto
        .createHmac('sha256', secretKey)
        .update(toSign)
        .digest('base64')

      const sigs  = svixSignature.split(' ')
      const valid = sigs.some(s => s === computed)
      if (!valid) {
        console.warn('[email-inbound] Signature verification failed')
        return new Response('Invalid signature', { status: 401 })
      }
    }
  }

  let parsed: z.infer<typeof payloadSchema>
  try {
    parsed = payloadSchema.parse(JSON.parse(rawBody))
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  if (parsed.type !== 'email.received') {
    return new Response('OK', { status: 200 })
  }

  const emailData = parsed.data
  if (!emailData?.email_id) {
    console.warn('[email-inbound] Missing email_id in payload')
    return new Response('OK', { status: 200 })
  }

  const fromRaw    = emailData.from ?? ''
  const fromEmail  = extractEmail(fromRaw)
  const senderName = extractName(fromRaw)
  const subject    = emailData.subject ?? ''

  if (!fromEmail) {
    console.warn('[email-inbound] Could not parse from address:', fromRaw)
    return new Response('OK', { status: 200 })
  }

  // ── Outbound detection ──────────────────────────────────────────────────────
  // If the sender is a known FA address, this is a copy of a Zoho outbound mail.
  // Match by recipient (to), not by sender.
  if (getFaOutboundAddresses().has(fromEmail)) {
    return handleOutbound(emailData, subject)
  }

  // ── Inbound path ────────────────────────────────────────────────────────────

  // Filter automated/system senders
  const autoSenders = [
    'noreply', 'no-reply', 'mailer-daemon', 'postmaster',
    'dmarc', 'bounce', 'notifications', 'do-not-reply', 'donotreply',
  ]
  if (autoSenders.some(s => fromEmail.includes(s))) {
    console.log('[email-inbound] Auto-sender filtered:', fromEmail)
    return new Response('OK', { status: 200 })
  }

  // Fetch full email body via Resend Receiving API.
  // In dev/fake mode (RESEND_DEV_FAKE=1) use data.text from the payload directly
  // so the webhook can be exercised in integration tests without a real email_id.
  let bodyText = ''
  if (process.env.RESEND_DEV_FAKE === '1' && typeof emailData.text === 'string') {
    bodyText = emailData.text.trim()
  } else {
    try {
      const res = await fetch(`https://api.resend.com/emails/receiving/${emailData.email_id}`, {
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
        },
        cache: 'no-store',
      })
      if (res.ok) {
        const full = await res.json() as { text?: string; html?: string }
        bodyText = full.text?.trim() ?? stripHtml(full.html ?? '').trim()
      } else {
        console.warn('[email-inbound] Resend fetch failed:', res.status)
      }
    } catch (err) {
      console.error('[email-inbound] Resend API error:', err)
    }
  }

  if (!bodyText) {
    console.log('[email-inbound] Empty body after fetch — skipping:', fromEmail)
    return new Response('OK', { status: 200 })
  }

  const supabase  = createServiceClient()
  const inquiryId = await matchInquiryByEmail(fromEmail)
  const content   = subject ? `**${subject}**\n\n${bodyText}` : bodyText

  if (inquiryId) {
    const { data: newMsg, error } = await supabase.from('messages').insert({
      inquiry_id:  inquiryId,
      direction:   'inbound',
      channel:     'email',
      counterpart: 'angler',
      body:        content,
      subject:     subject || null,
      external_id: emailData.email_id,
      status:      'received',
      drafted_by:  null,
      occurred_at: new Date().toISOString(),
    }).select('id').single()

    if (error) {
      console.error('[email-inbound] messages insert error:', error)
    } else {
      await supabase
        .from('inquiries')
        .update({ last_contact_at: new Date().toISOString() })
        .eq('id', inquiryId)

      await emitEvent(supabase, {
        inquiryId,
        type:      'message.received',
        actor:     { kind: 'angler' },
        source:    'webhook',
        channel:   'email',
        messageId: newMsg?.id ?? null,
      })

      console.log(`[email-inbound] Email from ${fromEmail} → inquiry ${inquiryId}`)

      if (env.AI_AUTO_REPLY_ENABLED) {
        // D2: angler replies to a 'new' inquiry that already got an auto-reply →
        // move to 'qualifying' so the SLA clock starts from the right state.
        try {
          const inq = await getInquiryStatusForD2(supabase, inquiryId)

          if (inq?.status === 'new' && await hasAgentAutoReply(inquiryId)) {
            await transition(supabase, inquiryId, 'qualifying', {
              actor:   { kind: 'agent' },
              source:  'webhook',
              channel: 'email',
              reason:  'angler replied after agent auto-reply',
            })
          }
        } catch (err) {
          console.error('[email-inbound] D2 transition error:', err)
        }

        try {
          await autoSendReply({ inquiryId, counterpart: 'angler', channel: 'email' })
        } catch (err) {
          console.error('[email-inbound] Auto-send error:', err)
        }
      }

    }
  } else {
    const { error } = await supabase.from('unmatched_messages').insert({
      source:          'email',
      from_identifier: fromEmail,
      sender_name:     senderName,
      content,
      raw_payload:     parsed as unknown as Json,
    })

    if (error) {
      console.error('[email-inbound] unmatched_messages insert error:', error)
    } else {
      console.log(`[email-inbound] Unmatched email from ${fromEmail} queued`)
    }
  }

  return new Response('OK', { status: 200 })
}

// ─── handleOutbound ───────────────────────────────────────────────────────────

/**
 * Process an outbound mail that arrived via BCC/rule copy.
 * Matches by recipient (to[]), writes an outbound messages row, emits message.sent.
 * Does NOT touch last_contact_at, autoSendReply, or D2.
 * No unmatched_messages entry — unmatched outbound mail (accountant etc.) is silently dropped.
 */
async function handleOutbound(
  emailData: z.infer<typeof emailDataSchema>,
  subject:   string,
): Promise<Response> {
  const toAddresses = (emailData.to ?? [])
    .map(a => extractEmail(a))
    .filter(Boolean)

  if (toAddresses.length === 0) {
    console.log('[email-inbound] outbound without to addresses — skipping')
    return new Response('OK', { status: 200 })
  }

  // Body — same dev-fake path as inbound
  let bodyText = ''
  if (process.env.RESEND_DEV_FAKE === '1' && typeof emailData.text === 'string') {
    bodyText = emailData.text.trim()
  } else {
    try {
      const res = await fetch(`https://api.resend.com/emails/receiving/${emailData.email_id}`, {
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const full = await res.json() as { text?: string; html?: string }
        bodyText = full.text?.trim() ?? stripHtml(full.html ?? '').trim()
      } else {
        console.warn('[email-inbound] outbound body fetch failed:', res.status)
      }
    } catch (err) {
      console.error('[email-inbound] outbound Resend API error:', err)
    }
  }

  if (!bodyText) {
    console.log('[email-inbound] outbound empty body — skipping:', emailData.email_id)
    return new Response('OK', { status: 200 })
  }

  const inquiryId = await matchInquiryByRecipient(toAddresses)

  if (!inquiryId) {
    console.log('[email-inbound] outbound without matching inquiry — skipping')
    return new Response('OK', { status: 200 })
  }

  const content = subject ? `**${subject}**\n\n${bodyText}` : bodyText
  const supabase = createServiceClient()

  const { data: newMsg, error } = await supabase
    .from('messages')
    .insert({
      inquiry_id:  inquiryId,
      direction:   'outbound',
      channel:     'email',
      counterpart: 'angler',
      body:        content,
      subject:     subject || null,
      external_id: emailData.email_id,
      status:      'sent',
      drafted_by:  'admin',
      occurred_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    // 23505 = unique_violation — duplicate delivery; idempotent, not an error
    if ((error as { code?: string }).code === '23505') {
      console.log('[email-inbound] outbound duplicate delivery — skipping:', emailData.email_id)
      return new Response('OK', { status: 200 })
    }
    console.error('[email-inbound] outbound messages insert error:', error)
    return new Response('OK', { status: 200 })
  }

  await emitEvent(supabase, {
    inquiryId,
    type:      'message.sent',
    actor:     { kind: 'admin' },
    source:    'webhook',
    channel:   'email',
    messageId: newMsg?.id ?? null,
    payload:   { drafted_by: 'admin' },
  })

  console.log(`[email-inbound] outbound from Zoho → inquiry ${inquiryId}`)
  return new Response('OK', { status: 200 })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  if (match) return match[1].trim().toLowerCase()
  return from.trim().toLowerCase()
}

function extractName(from: string): string {
  const match = from.match(/^(.+?)\s*</)
  if (!match) return ''
  return match[1].trim().replace(/^["']|["']$/g, '')
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
