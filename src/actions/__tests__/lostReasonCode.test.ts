/**
 * FA-0.16 — updateInquiryStatus requires a structured lost_reason_code
 * whenever status='lost', and clears it on any other status.
 *
 * Pure unit test: admin session and Supabase are mocked, so the assertions
 * are about the action's own validation and the shape of the update payload.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
    accounts: { retrieve: vi.fn() },
  },
}))

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'https://test.example.com',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    RESEND_API_KEY: 'test-resend',
  },
}))

vi.mock('@/lib/email', () => ({
  sendDepositLinkAnglerEmail: vi.fn(),
  sendInquiryMessageAnglerEmail: vi.fn(),
  sendRichOfferAnglerEmail: vi.fn(),
  sendGuideAssignedEmail: vi.fn(),
}))

vi.mock('@/lib/app-url', () => ({
  getAppUrl: vi.fn().mockResolvedValue('https://test.example.com'),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { createClient, createServiceClient } from '@/lib/supabase/server'

/** Captures whatever object the action passes to .update(). */
let capturedUpdate: Record<string, unknown> | null = null

function mockAdminSession() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'admin-1' } }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { role: 'admin' }, error: null }),
        }),
      }),
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  vi.mocked(createServiceClient).mockReturnValue({
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        capturedUpdate = payload
        return { eq: async () => ({ error: null }) }
      },
      select: () => ({
        eq: () => ({ single: async () => ({ data: { id: 'inq-1', status: 'pending' }, error: null }) }),
      }),
    }),
  } as unknown as ReturnType<typeof createServiceClient>)
}

describe('FA-0.16 — updateInquiryStatus / lost_reason_code', () => {
  beforeEach(() => {
    capturedUpdate = null
    vi.clearAllMocks()
    mockAdminSession()
  })

  it('rejects status=lost with no reason code', async () => {
    const { updateInquiryStatus } = await import('@/actions/inquiries')
    const result = await updateInquiryStatus('inq-1', 'lost')

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.error).toBe('A loss reason is required when marking as lost.')
    expect(capturedUpdate).toBeNull() // never reached the write
  })

  it('rejects status=lost with an empty-string reason code', async () => {
    const { updateInquiryStatus } = await import('@/actions/inquiries')
    const result = await updateInquiryStatus('inq-1', 'lost', '')

    expect(result.success).toBe(false)
    expect(capturedUpdate).toBeNull()
  })

  it('accepts status=lost with a reason code and writes both fields', async () => {
    const { updateInquiryStatus } = await import('@/actions/inquiries')
    const result = await updateInquiryStatus('inq-1', 'lost', 'price', 'Too expensive')

    expect(result.success).toBe(true)
    expect(capturedUpdate).toMatchObject({
      status:           'lost',
      lost_reason_code: 'price',
      lost_reason:      'Too expensive',
    })
  })

  it('clears lost_reason_code when moving to a non-lost status', async () => {
    const { updateInquiryStatus } = await import('@/actions/inquiries')
    const result = await updateInquiryStatus('inq-1', 'offer_sent')

    expect(result.success).toBe(true)
    expect(capturedUpdate).toMatchObject({
      status:           'offer_sent',
      lost_reason_code: null,
    })
  })
})
