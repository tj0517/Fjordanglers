/**
 * Regression test for FA-0.20: inquiries.status column default.
 *
 * Before FA-0.20, the column default violated inquiries_status_check.
 * After the migration the default is 'pending'.
 *
 * This test inserts without an explicit status and asserts the returned value
 * is 'pending'. It fails (with a constraint error) until the migration is applied.
 * The test is self-contained: it inserts its own row and deletes it in afterAll.
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

let insertedId: string

beforeAll(async () => {
  const envPath = path.resolve(process.cwd(), '.env.local')
  const raw = fs.readFileSync(envPath, 'utf-8')
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match == null) continue
    const [, key, value] = match
    if (process.env[key] == null) process.env[key] = value
  }
})

afterAll(async () => {
  if (insertedId == null) return
  const { createServiceClient } = await import('@/lib/supabase/server')
  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc as any).from('inquiries').delete().eq('id', insertedId)
})

describe('FA-0.20 — inquiries.status column default', () => {
  it('INSERT without status uses the default and returns pending', async () => {
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
    expect(data.status).toBe('pending')
    insertedId = data.id
  })
})
