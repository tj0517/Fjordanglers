/**
 * Email-inbound webhook — matched path. FA-1.25 / FA-1.27
 *
 * FA-1.25: classifyInquiry (old agent rounds) must NOT be called on inbound emails.
 * FA-1.27: D2 transition (new → qualifying) and flag-off behaviour.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted mutable env so tests can flip AI_AUTO_REPLY_ENABLED ──────────────
const mockEnv = vi.hoisted(() => ({
  RESEND_INBOUND_SECRET:  undefined as string | undefined,
  RESEND_API_KEY:         'test-resend' as string,
  AI_AUTO_REPLY_ENABLED:  true,
}))

// ─── Module mocks ─────────────────────────────────────────────────────────────

const anthropicCreateMock = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: anthropicCreateMock }
  },
}))

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))

vi.mock('@/lib/env', () => ({ env: mockEnv }))

vi.mock('@/lib/inquiry-matcher', () => ({
  matchInquiryByEmail: vi.fn().mockResolvedValue('inq-matched'),
}))

vi.mock('@/lib/ai/inquiry-agent', () => ({ classifyInquiry: vi.fn() }))

vi.mock('@/lib/events/emit', () => ({
  emitEvent:  vi.fn().mockResolvedValue('evt-1'),
  EventError: class EventError extends Error {},
}))

vi.mock('@/lib/ai/auto-send', () => ({
  hasAgentAutoReply: vi.fn().mockResolvedValue(false),
  autoSendReply:     vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/inquiries/state', () => ({
  transition:     vi.fn().mockResolvedValue({ from: 'new', to: 'qualifying' }),
  TransitionError: class TransitionError extends Error {},
}))

import { createServiceClient } from '@/lib/supabase/server'
import { classifyInquiry } from '@/lib/ai/inquiry-agent'
import { emitEvent } from '@/lib/events/emit'
import { transition } from '@/lib/inquiries/state'
import { hasAgentAutoReply, autoSendReply } from '@/lib/ai/auto-send'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function buildPayload() {
  return {
    type: 'email.received',
    data: {
      email_id: 'email-inbound-1',
      from:     'angler@example.com',
      to:       ['leads@fjordanglers.com'],
      subject:  'Re: trip booking',
      text:     'I would like to confirm my trip dates.',
    },
  }
}

function makeRequest(payload = buildPayload()) {
  return new NextRequest('http://localhost/api/webhooks/email-inbound', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(payload),
  })
}

function setupDb(status = 'new') {
  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'messages') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'msg-1' }, error: null }),
            }),
          }),
          update: () => ({ eq: () => ({ error: null }) }),
        }
      }
      if (table === 'inquiries') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'inq-matched', status }, error: null }),
            }),
          }),
          update: () => ({ eq: () => ({ error: null }) }),
        }
      }
      return {
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'row-1' }, error: null }) }) }),
        update: () => ({ eq: () => ({ error: null }) }),
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }
    },
  } as unknown as ReturnType<typeof createServiceClient>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.AI_AUTO_REPLY_ENABLED = true
  process.env.RESEND_DEV_FAKE = '1'
})

afterEach(() => {
  delete process.env.RESEND_DEV_FAKE
})

// ─── FA-1.25: classifyInquiry not called on inbound ──────────────────────────

describe('email-inbound webhook — matched path, FA-1.25', () => {
  it('does not call classifyInquiry when an email matches an existing inquiry', async () => {
    setupDb()
    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    const response  = await POST(makeRequest())

    expect(response.status).toBe(200)
    expect(vi.mocked(classifyInquiry)).toHaveBeenCalledTimes(0)
    expect(anthropicCreateMock).toHaveBeenCalledTimes(0)
  })
})

// ─── FA-1.27: D2 transition ───────────────────────────────────────────────────

describe('email-inbound webhook — D2 transition, FA-1.27', () => {
  it('transitions new → qualifying when inquiry is new AND has a prior agent auto-reply', async () => {
    setupDb('new')
    vi.mocked(hasAgentAutoReply).mockResolvedValueOnce(true)

    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    await POST(makeRequest())

    expect(vi.mocked(transition)).toHaveBeenCalledTimes(1)
    const [, , toStatus, opts] = vi.mocked(transition).mock.calls[0] as unknown as [unknown, unknown, string, Record<string, unknown>]
    expect(toStatus).toBe('qualifying')
    expect((opts.actor as Record<string, unknown>).kind).toBe('agent')
    expect(vi.mocked(emitEvent)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'message.received' }),
    )
  })

  it('does NOT transition when inquiry is new but has NO prior agent auto-reply', async () => {
    setupDb('new')
    vi.mocked(hasAgentAutoReply).mockResolvedValueOnce(false)

    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    await POST(makeRequest())

    expect(vi.mocked(transition)).not.toHaveBeenCalled()
  })

  it('does NOT call autoSendReply or transition when AI_AUTO_REPLY_ENABLED is false', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = false
    setupDb('new')

    const { POST } = await import('@/app/api/webhooks/email-inbound/route')
    await POST(makeRequest())

    expect(vi.mocked(transition)).not.toHaveBeenCalled()
    expect(vi.mocked(autoSendReply)).not.toHaveBeenCalled()
    expect(anthropicCreateMock).toHaveBeenCalledTimes(0)
  })
})
