/**
 * Email channel adapter — FA-1.12.
 *
 * Wraps the existing Resend integration (src/lib/email.ts sendEmail helper)
 * with the ChannelAdapter contract.
 *
 * Thread key = Message-ID header on outbound emails.
 * In-Reply-To is set when a previous threadKey exists (same chain).
 */

import { randomUUID } from 'crypto'
import { env } from '@/lib/env'
import type { ChannelAdapter, SendParams, SendResult } from './types'

function newMessageId(): string {
  return `<${randomUUID()}@mail.fjordanglers.com>`
}

async function sendRaw({
  to,
  subject,
  body,
  headers,
}: {
  to: string
  subject: string
  body: string
  headers?: Record<string, string>
}): Promise<string> {
  const payload: Record<string, unknown> = {
    from:    env.FA_FROM_EMAIL,
    to,
    subject,
    text:    body,
    headers: headers ?? {},
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body:  JSON.stringify(payload),
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '(no body)')
    throw new Error(`[email-adapter] Resend HTTP ${response.status}: ${text}`)
  }

  const result = await response.json() as { id?: string }
  return result.id ?? ''
}

export const emailAdapter: ChannelAdapter = {
  canSendFreeform: true,

  async send(params: SendParams): Promise<SendResult> {
    // Fake mode: skip Resend entirely; still returns a well-shaped result so
    // the caller can store the message row and emit message.sent as normal.
    if (process.env.RESEND_DEV_FAKE === '1' || !process.env.RESEND_API_KEY) {
      const t = Date.now()
      return { externalId: `fake-${t}`, threadKey: `<fake-${t}@dev.fjordanglers.com>` }
    }


    const outboundMsgId = newMessageId()

    const headers: Record<string, string> = {
      'Message-ID': outboundMsgId,
    }
    if (params.threadKey != null) {
      headers['In-Reply-To'] = params.threadKey
      headers['References']  = params.threadKey
    }

    const resendId = await sendRaw({
      to:      params.to,
      subject: params.subject ?? '(no subject)',
      body:    params.body,
      headers,
    })

    return { externalId: resendId || null, threadKey: outboundMsgId }
  },

  parseThreadKey(raw: Record<string, unknown>): string | null {
    // Resend inbound: Message-ID is in raw.data.headers or raw.data.message_id
    const data = raw.data as Record<string, unknown> | undefined
    if (typeof data?.email_id === 'string') return data.email_id
    return null
  },
}
