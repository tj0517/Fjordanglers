/**
 * FA-1.13 fix — a guide's WhatsApp number is not readable with the publishable key.
 *
 * `guides` has the baseline policy "Public reads all guides" USING (true), so
 * guides.phone_e164 (20260918135418) was readable by anon. The number now lives in
 * `guide_contacts`, RLS on, one policy: service_role. This test runs against the real
 * local stack (env from .env.test via src/tests/setup.ts, safety fuse included):
 *
 *   service_role → gets the row        (so an empty anon result cannot mean "no data")
 *   anon         → gets nothing        (denied or empty — never the number)
 *   anon         → cannot write either
 *   anon         → guides.phone_e164 no longer exists
 *
 * Self-contained: inserts its own guide and deletes it in afterAll (ON DELETE CASCADE
 * removes the contact row).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'

const GUIDE_ID = '0f1a2b3c-4d5e-4f60-8a7b-9c8d7e6f5a4b'
const PHONE    = '+3547770123'

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

beforeAll(async () => {
  const svc = createServiceClient()
  await svc.from('guides').delete().eq('id', GUIDE_ID)
  const g = await svc.from('guides').insert({ id: GUIDE_ID, full_name: 'FA-1.13 RLS test guide', country: 'Iceland' })
  expect(g.error).toBeNull()
  const c = await svc.from('guide_contacts').insert({ guide_id: GUIDE_ID, phone_e164: PHONE })
  expect(c.error).toBeNull()
})

afterAll(async () => {
  await createServiceClient().from('guides').delete().eq('id', GUIDE_ID)
})

describe('FA-1.13 — guide_contacts is service_role only', () => {
  it('service_role reads the number', async () => {
    const { data, error } = await createServiceClient()
      .from('guide_contacts')
      .select('phone_e164')
      .eq('guide_id', GUIDE_ID)
    expect(error).toBeNull()
    expect(data).toEqual([{ phone_e164: PHONE }])
  })

  it('anon select(phone_e164) is denied or empty — never the number', async () => {
    const { data, error } = await anonClient().from('guide_contacts').select('phone_e164')
    expect(error != null || (data ?? []).length === 0).toBe(true)
    expect(JSON.stringify(data ?? [])).not.toContain(PHONE)
  })

  it('anon cannot look the number up by value or by guide id either', async () => {
    const byPhone = await anonClient().from('guide_contacts').select('guide_id').eq('phone_e164', PHONE)
    expect(byPhone.error != null || (byPhone.data ?? []).length === 0).toBe(true)
    const byGuide = await anonClient().from('guide_contacts').select('phone_e164').eq('guide_id', GUIDE_ID)
    expect(byGuide.error != null || (byGuide.data ?? []).length === 0).toBe(true)
  })

  it('anon cannot write to guide_contacts', async () => {
    const anon = anonClient()
    const ins = await anon.from('guide_contacts').insert({ guide_id: GUIDE_ID, phone_e164: '+10000000000' })
    expect(ins.error).not.toBeNull()
    await anon.from('guide_contacts').update({ phone_e164: '+10000000000' }).eq('guide_id', GUIDE_ID)
    await anon.from('guide_contacts').delete().eq('guide_id', GUIDE_ID)
    // Neither the update nor the delete may have touched the row.
    const { data } = await createServiceClient()
      .from('guide_contacts')
      .select('phone_e164')
      .eq('guide_id', GUIDE_ID)
    expect(data).toEqual([{ phone_e164: PHONE }])
  })

  it('the public guides row no longer has a phone_e164 column', async () => {
    const { data, error } = await anonClient().from('guides').select('phone_e164').eq('id', GUIDE_ID)
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })
})
