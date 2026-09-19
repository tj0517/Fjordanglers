/**
 * Channel adapter contract — FA-1.13.
 */

export interface SendResult {
  externalId: string | null
  threadKey: string | null
}

export interface SendParams {
  to: string
  subject?: string
  body: string
  threadKey?: string | null
  /**
   * WA only: pre-approved Meta template name. Use when canSendFreeform returns false.
   */
  templateName?: string
  /**
   * WA only: timestamp of last inbound message on this inquiry/channel.
   */
  lastInboundAt?: Date | null
}

export interface InboundMessage {
  from: string
  body: string
  externalId: string | null
  occurredAt: Date
  media: Array<{ type: string; id: string }> | null
  threadKey: string | null
}

export interface ChannelAdapter {
  canSendFreeform(lastInboundAt: Date | null): boolean
  send(params: SendParams): Promise<SendResult>
  parseInbound(raw: Record<string, unknown>): InboundMessage | null
}
