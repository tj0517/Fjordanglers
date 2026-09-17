/**
 * Channel adapter contract — FA-1.12.
 *
 * Each channel (email, WhatsApp, Instagram) exports an object that satisfies
 * this interface. `sendMessage` in src/lib/messages/send.ts picks the right
 * adapter based on the message's channel column.
 */

export interface SendResult {
  /** Provider-assigned ID stored in messages.external_id */
  externalId: string | null
  /** Thread key for matching future inbound replies. Email: Message-ID header. */
  threadKey: string | null
}

export interface SendParams {
  to:        string
  subject?:  string
  body:      string
  /** The current thread key; used to set In-Reply-To on email replies. */
  threadKey?: string | null
}

export interface ChannelAdapter {
  /** Whether admins can compose a free-form message on this channel. */
  canSendFreeform: boolean

  /**
   * Send a message and return identifiers for thread-matching.
   * Throws on fatal delivery errors; transient failures should be surfaced
   * so the caller can set messages.status = 'failed'.
   */
  send(params: SendParams): Promise<SendResult>

  /**
   * Extract a thread key from a raw inbound webhook payload, so the
   * webhook handler can match the reply to the right inquiry.
   */
  parseThreadKey(raw: Record<string, unknown>): string | null
}
