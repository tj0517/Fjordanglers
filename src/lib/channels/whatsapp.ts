/**
 * WhatsApp channel adapter — FA-1.13.
 *
 * canSendFreeform: true iff last inbound was within 24 hours.
 * send: freeform text within window; approved template outside.
 * parseInbound: parses a single Meta message object from the webhook payload.
 */

import { env } from '@/lib/env'
import type { ChannelAdapter, InboundMessage, SendParams, SendResult } from './types'

export const whatsappAdapter: ChannelAdapter = {
  canSendFreeform(lastInboundAt: Date | null): boolean {
    if (lastInboundAt == null) return false
    return Date.now() - lastInboundAt.getTime() < 24 * 60 * 60 * 1000
  },

  async send(params: SendParams): Promise<SendResult> {
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID
    const accessToken   = env.WHATSAPP_ACCESS_TOKEN
    if (!phoneNumberId || !accessToken) {
      throw new Error(
        '[whatsapp-adapter] WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not configured',
      )
    }

    const canFreeform = this.canSendFreeform(params.lastInboundAt ?? null)

    let reqBody: Record<string, unknown>
    if (canFreeform) {
      reqBody = {
        messaging_product: 'whatsapp',
        to:                params.to.replace(/^\+/, ''),
        type:              'text',
        text:              { body: params.body },
      }
    } else if (params.templateName) {
      reqBody = {
        messaging_product: 'whatsapp',
        to:                params.to.replace(/^\+/, ''),
        type:              'template',
        template:          { name: params.templateName, language: { code: 'en_US' } },
      }
    } else {
      throw new Error('[whatsapp-adapter] 24-hour window closed — templateName required')
    }

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body:  JSON.stringify(reqBody),
        cache: 'no-store',
      },
    )

    if (!response.ok) {
      const text = await response.text().catch(() => '(no body)')
      throw new Error(`[whatsapp-adapter] Meta API HTTP ${response.status}: ${text}`)
    }

    const result = await response.json() as { messages?: Array<{ id: string }> }
    return { externalId: result.messages?.[0]?.id ?? null, threadKey: params.to }
  },

  parseInbound(raw: Record<string, unknown>): InboundMessage | null {
    const msg = raw as {
      from?: string
      id?: string
      timestamp?: string
      type?: string
      text?: { body?: string }
      image?: { id?: string }
      audio?: { id?: string }
      video?: { id?: string }
      document?: { id?: string }
    }
    if (!msg.from || !msg.id) return null

    const from       = msg.from.startsWith('+') ? msg.from : '+' + msg.from
    const occurredAt = msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date()

    let body  = ''
    let media: Array<{ type: string; id: string }> | null = null

    if (msg.type === 'text') {
      body = msg.text?.body ?? ''
    } else if (msg.type) {
      body = `[Media attachment received — type: ${msg.type}]`
      const mediaObj = msg[msg.type as keyof typeof msg] as { id?: string } | undefined
      if (mediaObj?.id) media = [{ type: msg.type, id: mediaObj.id }]
    }

    return { from, body, externalId: msg.id, occurredAt, media, threadKey: from }
  },
}
