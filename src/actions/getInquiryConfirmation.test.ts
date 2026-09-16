/**
 * Integration test for getInquiryConfirmation against the test/dev Supabase
 * project (env from .env.local — never printed). Confirms:
 *  - an unpaid inquiry (deposit_paid_at = null) returns depositPaidAt: null
 *  - a nonexistent id returns null
 *
 * The test inserts and cleans up its own row so it never depends on pre-existing data.
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

let testInquiryId: string

beforeAll(async () => {
  const envPath = path.resolve(__dirname, '../../.env.local')
  const raw = fs.readFileSync(envPath, 'utf-8')
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match == null) continue
    const [, key, value] = match
    if (process.env[key] == null) process.env[key] = value
  }

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
  if (testInquiryId == null) return
  const { createServiceClient } = await import('@/lib/supabase/server')
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any).from('inquiries').delete().eq('id', testInquiryId)
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
