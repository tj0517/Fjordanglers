/**
 * Integration test for getInquiryConfirmation against the local Supabase stack.
 * Env is loaded by vitest setupFiles (src/tests/setup.ts) before this file executes.
 * Confirms:
 *  - an unpaid inquiry (deposit_paid_at = null) returns depositPaidAt: null
 *  - a nonexistent id returns null
 *
 * The test inserts and cleans up its own row so it never depends on pre-existing data.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

let testInquiryId: string

beforeAll(async () => {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc as any)
    .from('inquiries')
    .insert({ angler_name: 'Test Angler', angler_email: 'test-vitest@example.com', status: 'pending' })
    .select('id')
    .single()

  if (error != null || data == null) {
    throw new Error(`Failed to insert test inquiry: ${JSON.stringify(error)}`)
  }
  testInquiryId = data.id
})

afterAll(async () => {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const svc = createServiceClient()
  // Delete by email so cleanup runs even if testInquiryId was never assigned.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any).from('inquiries').delete().eq('angler_email', 'test-vitest@example.com')
})

describe('getInquiryConfirmation', () => {
  it('returns depositPaidAt: null for an unpaid inquiry', async () => {
    const { getInquiryConfirmation } = await import('./inquiries')
    const result = await getInquiryConfirmation(testInquiryId)

    expect(result).not.toBeNull()
    expect(result!.depositPaidAt).toBeNull()
  })

  it('returns null for a nonexistent inquiry id', async () => {
    const { getInquiryConfirmation } = await import('./inquiries')
    const result = await getInquiryConfirmation('00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })
})
