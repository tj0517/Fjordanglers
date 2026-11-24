/**
 * FA-M.05 D5 (tj condition 3) — when the earlier open request cannot be withdrawn after a new one is
 * created, the admin sees a warning; it is never a silent success.
 *
 *   1. withdrawOtherOpenRequests with a client whose withdraw call fails → counted as failed.
 *   2. sendGuideRequestByWhatsApp reports previousStillActive → the action returns the warning text.
 * (The card showing it: src/app/admin/inquiries/[id]/GuideAttachmentTab.test.tsx.) No network, no DB.
 */
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const sendGuideRequestByWhatsApp = vi.fn()
vi.mock('@/lib/guide-requests/send', () => ({ sendGuideRequestByWhatsApp: (...a: unknown[]) => sendGuideRequestByWhatsApp(...a) }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => ({}) }))
vi.mock('@/lib/auth/guards', () => ({ requireAdmin: async () => ({ userId: 'admin-1' }) }))
vi.mock('@/lib/app-url', () => ({ getAppUrl: async () => 'https://fa.test' }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { sendGuideRequest } from '../guide-requests'
import { withdrawOtherOpenRequests } from '@/lib/guide-requests/requests'

const INQ = '11111111-1111-4111-8111-111111111111'
const GUIDE = '22222222-2222-4222-8222-222222222222'

/** A client that lists one open request and fails the withdraw RPC. */
function failingClient(): SupabaseClient<Database> {
  const query = {
    select: () => query, eq: () => query, neq: () => query,
    is: () => query,
    then: (resolve: (v: unknown) => void) => resolve({ data: [{ id: 'old-request' }], error: null }),
  }
  const client = {
    from: () => query,
    rpc: async () => ({ data: null, error: { message: 'simulated failure' } }),
  }
  return client as unknown as SupabaseClient<Database>
}

describe('D5 — the previous link cannot be withdrawn', () => {
  it('withdrawOtherOpenRequests counts a failed withdraw (does not throw, does not hide it)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const res = await withdrawOtherOpenRequests(failingClient(), { inquiryId: INQ, keepRequestId: 'new', adminId: 'admin-1' })
    expect(res).toEqual({ withdrawn: 0, failed: 1 })
    spy.mockRestore()
  })

  it('the action returns the request AND a visible warning', async () => {
    sendGuideRequestByWhatsApp.mockResolvedValue({
      ok: true, requestId: 'r', waUrl: 'https://wa.me/1?text=x', link: 'https://fa.test/r/x', previousStillActive: true,
    })
    expect(await sendGuideRequest(INQ, GUIDE)).toEqual({
      success: true, waUrl: 'https://wa.me/1?text=x', link: 'https://fa.test/r/x',
      warning: 'Previous link still active — withdraw it manually.',
    })
  })

  it('no failure → no warning', async () => {
    sendGuideRequestByWhatsApp.mockResolvedValue({
      ok: true, requestId: 'r', waUrl: 'https://wa.me/1?text=x', link: 'https://fa.test/r/x', previousStillActive: false,
    })
    expect(await sendGuideRequest(INQ, GUIDE)).toMatchObject({ success: true, warning: null })
  })
})
