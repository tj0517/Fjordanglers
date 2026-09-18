/**
 * Regression test for FA-0.20: inquiries.status column default.
 *
 * Before FA-0.20, the column default violated inquiries_status_check. FA-0.20 set it
 * to 'pending'; FA-1.03 renamed the vocabulary and the default is now 'new'.
 *
 * This test inserts without an explicit status and asserts the returned value
 * is 'new'. It fails (with a constraint error) until the migration is applied.
 * The test is self-contained: it inserts its own row and deletes it in afterAll.
 * Env is loaded by vitest setupFiles (src/tests/setup.ts) before this file executes.
 */
import { describe, it, expect, afterAll } from 'vitest'

afterAll(async () => {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const svc = createServiceClient()
  // Delete by email so cleanup runs even if the insert never completed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any).from('inquiries').delete().eq('angler_email', 'fa-0.20@regression.test')
})

describe('FA-0.20 — inquiries.status column default', () => {
  it('INSERT without status uses the default and returns new', async () => {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const svc = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc as any)
      .from('inquiries')
      .insert({ angler_name: 'FA-0.20 regression', angler_email: 'fa-0.20@regression.test' })
      .select('id, status')
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data.status).toBe('new')
  })
})
