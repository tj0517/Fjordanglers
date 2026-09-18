/**
 * Instagram channel adapter — FA-1.13.
 *
 * Stub adapter that compiles and runs without INSTAGRAM_ACCESS_TOKEN.
 * enabled is a getter (re-evaluated on every read, vi.stubEnv-mockable).
 * send() throws a readable error even when enabled=false.
 * Full implementation ships with Meta business verification (O-16).
 */

import type { ChannelAdapter, InboundMessage, SendParams, SendResult } from './types'

function isInstagramConfigured(): boolean {
  return Boolean(process.env.INSTAGRAM_ACCESS_TOKEN)
}

export const instagramAdapter: ChannelAdapter & { readonly enabled: boolean } = {
  get enabled() { return isInstagramConfigured() },

  canSendFreeform(_lastInboundAt: Date | null): boolean {
    return false
  },

  async send(_params: SendParams): Promise<SendResult> {
    throw new Error(
      '[instagram-adapter] Instagram channel is not configured. ' +
      'Set INSTAGRAM_ACCESS_TOKEN to enable this channel.',
    )
  },

  parseInbound(_raw: Record<string, unknown>): InboundMessage | null {
    return null
  },
}
