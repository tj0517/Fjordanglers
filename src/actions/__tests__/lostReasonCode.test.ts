/**
 * FA-0.16 — a status change to `lost` requires a structured lost_reason_code, and any
 * other status clears it.
 *
 * Since FA-1.03 the rule lives in `transition()` and `updateInquiryStatus` is one of
 * its callers, so this test drives the action and asserts on what reaches the database:
 * the update payload and the events the transition writes.
 *
 * Pure unit test: admin session and Supabase are mocked.
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

/** Captures whatever object the action passes to .update() on `inquiries`. */
let capturedUpdate: Record<string, unknown> | null = null
/** Every row written to `inquiry_events` during the call. */
let capturedEvents: Record<string, unknown>[] = []
/** The status the mocked inquiry starts from. */
let currentStatus = 'qualifying'

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
    from: (table: string) => {
      if (table === 'inquiry_events') {
        return {
          insert: (row: Record<string, unknown>) => {
            capturedEvents.push(row)
            return {
              select: () => ({
                single: async () => ({ data: { id: `ev-${capturedEvents.length}` }, error: null }),
              }),
            }
          },
        }
      }

      return {
        update: (payload: Record<string, unknown>) => {
          capturedUpdate = payload
          const applied = async () => {
            currentStatus = payload.status as string
            return { data: { id: 'inq-1' }, error: null }
          }
          return {
            eq: () => ({
              // transition() does .eq(id).eq(status).select().maybeSingle()
              eq: () => ({ select: () => ({ maybeSingle: applied }) }),
              // plain .eq(id) awaited directly
              then: (resolve: (v: unknown) => unknown) => applied().then(resolve),
            }),
          }
        },
        select: () => ({
          eq: () => ({
            single:     async () => ({ data: { id: 'inq-1', status: currentStatus }, error: null }),
            maybeSingle: async () => ({ data: { id: 'inq-1', status: currentStatus }, error: null }),
          }),
        }),
      }
    },
  } as unknown as ReturnType<typeof createServiceClient>)
}

describe('FA-0.16 — updateInquiryStatus / lost_reason_code', () => {
  beforeEach(() => {
    capturedUpdate  = null
    capturedEvents  = []
    currentStatus   = 'qualifying'
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

  it('records the loss as status.changed + inquiry.lost, with the code in the payload', async () => {
    const { updateInquiryStatus } = await import('@/actions/inquiries')
    await updateInquiryStatus('inq-1', 'lost', 'price', 'Too expensive')

    expect(capturedEvents.map(e => e.type)).toEqual(['status.changed', 'inquiry.lost'])
    expect(capturedEvents[0]).toMatchObject({
      from_status: 'qualifying', to_status: 'lost', actor_kind: 'admin', actor_id: 'admin-1',
    })
    expect(capturedEvents[1]).toMatchObject({ payload: { lost_reason_code: 'price' } })
  })

  it('clears lost_reason_code when moving to a non-lost status', async () => {
    const { updateInquiryStatus } = await import('@/actions/inquiries')
    const result = await updateInquiryStatus('inq-1', 'offer_presented')

    expect(result.success).toBe(true)
    expect(capturedUpdate).toMatchObject({
      status:           'offer_presented',
      lost_reason_code: null,
    })
    expect(capturedEvents.map(e => e.type)).toEqual(['status.changed'])
  })

  it('refuses a status the machine does not allow from here', async () => {
    const { updateInquiryStatus } = await import('@/actions/inquiries')
    const result = await updateInquiryStatus('inq-1', 'paid')

    expect(result.success).toBe(false)
    expect(capturedUpdate).toBeNull()
    expect(capturedEvents).toHaveLength(0)
  })
})
