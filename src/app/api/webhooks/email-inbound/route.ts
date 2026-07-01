/**
 * Email inbound webhook — Resend Inbound (beta)
 *
 * Receives forwarded emails from Zoho Mail via Resend Inbound.
 * Matches the sender to an existing inquiry by email address.
 *
 * Setup:
 *  1. Resend dashboard → Inbound → Create email (e.g. leads@fjordanglers.com)
 *  2. Webhook URL: https://fjordanglers.com/api/webhooks/email-inbound
 *  3. Copy signing secret → RESEND_INBOUND_SECRET env var
 *  4. Zoho Mail → Settings → Forwarding → add the Resend inbound address
 */

import crypto from 'crypto'
import { env } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'
import { matchInquiryByEmail } from '@/lib/inquiry-matcher'

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const rawBody = await req.text()

  // Verify Resend inbound signature (svix-style: svix-id, svix-timestamp, svix-signature)
  if (env.RESEND_INBOUND_SECRET) {
    const svixId        = req.headers.get('svix-id')        ?? ''
    const svixTimestamp = req.headers.get('svix-timestamp') ?? ''
    const svixSignature = req.headers.get('svix-signature') ?? ''

    // Resend uses the same svix signing scheme: sign "{svix-id}.{svix-timestamp}.{body}"
    if (svixId && svixTimestamp && svixSignature) {
      const toSign   = `${svixId}.${svixTimestamp}.${rawBody}`
      // Svix secrets are base64-encoded with a "whsec_" prefix — decode before use
      const secretKey = Buffer.from(
        env.RESEND_INBOUND_SECRET.replace(/^whsec_/, ''),
        'base64',
      )
      const computed = 'v1,' + crypto
        .createHmac('sha256', secretKey)
        .update(toSign)
        .digest('base64')

      // svix-signature may contain multiple space-separated "v1,xxx" values
      const sigs = svixSignature.split(' ')
      const valid = sigs.some(s => s === computed)
      if (!valid) {
        console.warn('[email-inbound] Signature verification failed')
        return new Response('Invalid signature', { status: 401 })
      }
    }
  }

  let payload: ResendInboundPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const raw = payload as unknown as Record<string, unknown>
  console.log('[email-inbound] payload keys:', Object.keys(raw))
  console.log('[email-inbound] payload.from:', raw.from)
  console.log('[email-inbound] payload.data:', JSON.stringify(raw.data ?? null))

  const fromRaw     = payload.from ?? ''
  const fromEmail   = extractEmail(fromRaw)
  const senderName  = extractName(fromRaw)
  const bodyText    = payload.text ?? stripHtml(payload.html ?? '')

  if (!fromEmail) {
    console.warn('[email-inbound] Could not parse from address:', fromRaw)
    return new Response('OK', { status: 200 })
  }

  // Filter out automated/system senders
  const autoSenders = [
    'noreply', 'no-reply', 'mailer-daemon', 'postmaster',
    'dmarc', 'bounce', 'notifications', 'do-not-reply', 'donotreply',
  ]
  if (autoSenders.some(s => fromEmail.includes(s))) {
    console.log('[email-inbound] Auto-sender filtered:', fromEmail)
    return new Response('OK', { status: 200 })
  }

  if (!bodyText.trim()) {
    console.log('[email-inbound] Empty body — skipping:', fromEmail)
    return new Response('OK', { status: 200 })
  }

  const supabase   = createServiceClient()
  const inquiryId  = await matchInquiryByEmail(fromEmail)

  const subject = payload.subject ? `**${payload.subject}**\n\n` : ''
  const content = subject + bodyText.trim()

  if (inquiryId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('lead_messages').insert({
      inquiry_id:   inquiryId,
      direction:    'inbound',
      channel:      'email',
      contact_type: 'client',
      contact_name: senderName || fromEmail,
      content,
      created_by:   'webhook',
    })

    if (error) {
      console.error('[email-inbound] lead_messages insert error:', error)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('inquiries')
        .update({ last_contact_at: new Date().toISOString() })
        .eq('id', inquiryId)

      console.log(`[email-inbound] Email from ${fromEmail} → inquiry ${inquiryId}`)
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('unmatched_messages').insert({
      source:          'email',
      from_identifier: fromEmail,
      sender_name:     senderName,
      content,
      raw_payload:     payload as unknown as Record<string, unknown>,
    })

    if (error) {
      console.error('[email-inbound] unmatched_messages insert error:', error)
    } else {
      console.log(`[email-inbound] Unmatched email from ${fromEmail} queued`)
    }
  }

  return new Response('OK', { status: 200 })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract email from "Name <email>" or plain "email" format. */
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  if (match) return match[1].trim().toLowerCase()
  return from.trim().toLowerCase()
}

/** Extract display name from "Name <email>" format. Returns '' if not present. */
function extractName(from: string): string {
  const match = from.match(/^(.+?)\s*</)
  if (!match) return ''
  return match[1].trim().replace(/^["']|["']$/g, '')
}

/** Rudimentary HTML → plain text for when text part is absent. */
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

// ─── Resend Inbound payload type ──────────────────────────────────────────────

interface ResendInboundPayload {
  from:    string
  to?:     string[]
  subject?: string
  text?:   string
  html?:   string
  headers?: Record<string, string>
}
