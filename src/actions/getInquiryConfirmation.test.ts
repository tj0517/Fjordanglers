/**
 * Integration test for getInquiryConfirmation against the test/dev Supabase
 * project (env from .env.local — never printed). Confirms:
 *  - an unpaid inquiry (deposit_paid_at = null) returns depositPaidAt: null
 *  - a nonexistent id returns null
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  const envPath = path.resolve(__dirname, '../../.env.local')
  const raw = fs.readFileSync(envPath, 'utf-8')
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match == null) continue
    const [, key, value] = match
    if (process.env[key] == null) process.env[key] = value
  }
})

describe('getInquiryConfirmation', () => {
  it('returns depositPaidAt: null for an unpaid inquiry', async () => {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const svc = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: unpaid } = await (svc as any)
      .from('inquiries')
      .select('id, deposit_paid_at')
      .is('deposit_paid_at', null)
      .limit(1)
      .single()

    expect(unpaid).not.toBeNull()
    console.log('unpaid inquiry used:', { id: unpaid.id, deposit_paid_at: unpaid.deposit_paid_at })

    const { getInquiryConfirmation } = await import('./inquiries')
    const result = await getInquiryConfirmation(unpaid.id)

    expect(result).not.toBeNull()
    expect(result!.depositPaidAt).toBeNull()
  })

  it('returns null for a nonexistent inquiry id', async () => {
    const { getInquiryConfirmation } = await import('./inquiries')
    const result = await getInquiryConfirmation('00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })
})
