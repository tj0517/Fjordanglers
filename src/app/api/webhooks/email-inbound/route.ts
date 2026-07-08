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
import { env } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'
import { matchInquiryByEmail } from '@/lib/inquiry-matcher'
import { runAgentRound2 } from '@/lib/ai/inquiry-agent'

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

  let payload: ResendInboundPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  if (payload.type !== 'email.received') {
    return new Response('OK', { status: 200 })
  }

  const emailData = payload.data
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

  // Filter automated/system senders
  const autoSenders = [
    'noreply', 'no-reply', 'mailer-daemon', 'postmaster',
    'dmarc', 'bounce', 'notifications', 'do-not-reply', 'donotreply',
  ]
  if (autoSenders.some(s => fromEmail.includes(s))) {
    console.log('[email-inbound] Auto-sender filtered:', fromEmail)
    return new Response('OK', { status: 200 })
  }

  // Fetch full email body via Resend Receiving API
  let bodyText = ''
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

  if (!bodyText) {
    console.log('[email-inbound] Empty body after fetch — skipping:', fromEmail)
    return new Response('OK', { status: 200 })
  }

  const supabase  = createServiceClient()
  const inquiryId = await matchInquiryByEmail(fromEmail)
  const content   = subject ? `**${subject}**\n\n${bodyText}` : bodyText

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

      if (env.AI_AUTO_REPLY_ENABLED) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inq } = await (supabase as any)
          .from('inquiries')
          .select('agent_status')
          .eq('id', inquiryId)
          .single()
        if (inq?.agent_status === 'waiting') {
          try { await runAgentRound2(inquiryId) }
          catch (err) { console.error('[email-inbound] Agent error:', err) }
        }
      }
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

// ─── Resend Inbound payload type ──────────────────────────────────────────────

interface ResendEmailData {
  email_id: string
  from:     string
  to?:      string[]
  subject?: string
}

interface ResendInboundPayload {
  type?: string
  data?: ResendEmailData
}
