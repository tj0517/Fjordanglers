/**
 * FA-1.13 — whatsappAdapter unit tests.
 *
 * canSendFreeform: boundary at exactly 24 h.
 * send: throws when window closed and no templateName.
 * parseInbound: parses text and media; returns null for missing fields.
 * instagram: enabled=false when no token; send throws readable error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: {
    WHATSAPP_PHONE_NUMBER_ID: 'phone-123',
    WHATSAPP_ACCESS_TOKEN:    'token-abc',
    WHATSAPP_TEMPLATE_GUIDE:  'fa_guide_new_inquiry',
    WHATSAPP_TEMPLATE_ANGLER: 'fa_angler_update',
  },
}))

beforeEach(() => { vi.clearAllMocks() })

// ─── canSendFreeform ──────────────────────────────────────────────────────────

describe('whatsappAdapter.canSendFreeform', () => {
  it('returns false when lastInboundAt is null', async () => {
    const { whatsappAdapter } = await import('@/lib/channels/whatsapp')
    expect(whatsappAdapter.canSendFreeform(null)).toBe(false)
  })

  it('returns true just inside the 24-h window', async () => {
    const { whatsappAdapter } = await import('@/lib/channels/whatsapp')
    const justInside = new Date(Date.now() - (24 * 60 * 60 * 1000 - 60_000))
    expect(whatsappAdapter.canSendFreeform(justInside)).toBe(true)
  })

  it('returns false just outside the 24-h window', async () => {
    const { whatsappAdapter } = await import('@/lib/channels/whatsapp')
    const justOutside = new Date(Date.now() - (24 * 60 * 60 * 1000 + 60_000))
    expect(whatsappAdapter.canSendFreeform(justOutside)).toBe(false)
  })

  it('returns false exactly at the 24-h boundary (expired)', async () => {
    const { whatsappAdapter } = await import('@/lib/channels/whatsapp')
    const exactly24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    // Expired at exactly 24h — not strictly less-than, so false
    expect(whatsappAdapter.canSendFreeform(exactly24h)).toBe(false)
  })
})

// ─── send: template required when window closed ───────────────────────────────

describe('whatsappAdapter.send — window closed', () => {
  it('throws when 24-h window is closed and no templateName', async () => {
    const { whatsappAdapter } = await import('@/lib/channels/whatsapp')
    const expired = new Date(Date.now() - 48 * 60 * 60 * 1000)
    await expect(
      whatsappAdapter.send({ to: '+48123456789', body: 'hello', lastInboundAt: expired }),
    ).rejects.toThrow('24-hour window closed')
  })

  it('sends template when window is closed and templateName provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ messages: [{ id: 'wamid-1' }] }), { status: 200 }),
    )
    const { whatsappAdapter } = await import('@/lib/channels/whatsapp')
    const expired = new Date(Date.now() - 48 * 60 * 60 * 1000)
    const result = await whatsappAdapter.send({
      to:           '+48123456789',
      body:         '',
      lastInboundAt: expired,
      templateName: 'fa_guide_new_inquiry',
    })
    expect(result.externalId).toBe('wamid-1')
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.type).toBe('template')
    expect(body.template.name).toBe('fa_guide_new_inquiry')
    fetchSpy.mockRestore()
  })
})

// ─── parseInbound ─────────────────────────────────────────────────────────────

describe('whatsappAdapter.parseInbound', () => {
  it('parses a text message', async () => {
    const { whatsappAdapter } = await import('@/lib/channels/whatsapp')
    const raw = {
      from:      '48123456789',
      id:        'msg-id-1',
      timestamp: '1700000000',
      type:      'text',
      text:      { body: 'Hello from WA' },
    }
    const result = whatsappAdapter.parseInbound(raw)
    expect(result).not.toBeNull()
    expect(result?.from).toBe('+48123456789')
    expect(result?.body).toBe('Hello from WA')
    expect(result?.externalId).toBe('msg-id-1')
    expect(result?.threadKey).toBe('+48123456789')
  })

  it('adds + prefix when from lacks it', async () => {
    const { whatsappAdapter } = await import('@/lib/channels/whatsapp')
    const raw = { from: '48123456789', id: 'x', timestamp: '1700000000', type: 'text', text: { body: '' } }
    expect(whatsappAdapter.parseInbound(raw)?.from).toBe('+48123456789')
  })

  it('returns null when from is missing', async () => {
    const { whatsappAdapter } = await import('@/lib/channels/whatsapp')
    expect(whatsappAdapter.parseInbound({ id: 'x', type: 'text' })).toBeNull()
  })

  it('parses an image message with media array', async () => {
    const { whatsappAdapter } = await import('@/lib/channels/whatsapp')
    const raw = {
      from:      '48111222333',
      id:        'msg-img-1',
      timestamp: '1700000000',
      type:      'image',
      image:     { id: 'media-id-1', mime_type: 'image/jpeg' },
    }
    const result = whatsappAdapter.parseInbound(raw)
    expect(result?.media).toEqual([{ type: 'image', id: 'media-id-1' }])
    expect(result?.body).toContain('image')
  })
})

// ─── Instagram disabled stub ──────────────────────────────────────────────────

describe('instagramAdapter — no token', () => {
  it('enabled=false', async () => {
    const { instagramAdapter } = await import('@/lib/channels/instagram')
    expect(instagramAdapter.enabled).toBe(false)
  })

  it('send throws readable error', async () => {
    const { instagramAdapter } = await import('@/lib/channels/instagram')
    await expect(
      instagramAdapter.send({ to: 'user-1', body: 'hi' }),
    ).rejects.toThrow('[instagram-adapter]')
  })

  it('canSendFreeform returns false', async () => {
    const { instagramAdapter } = await import('@/lib/channels/instagram')
    expect(instagramAdapter.canSendFreeform(new Date())).toBe(false)
  })

  it('parseInbound returns null', async () => {
    const { instagramAdapter } = await import('@/lib/channels/instagram')
    expect(instagramAdapter.parseInbound({})).toBeNull()
  })
})
