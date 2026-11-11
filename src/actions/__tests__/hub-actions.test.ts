/**
 * Integration test for the hub editor action against the local Supabase stack (FA-1.85).
 * Env is loaded by vitest setupFiles (src/tests/setup.ts), whose fuse aborts on a non-local URL.
 *
 * The guard is the real `requireAdmin`: `createClient` (the cookie session) is replaced by a client
 * signed in as one of the seed users (supabase/seed.sql), so "an angler is refused" is the real role
 * check against the real `profiles` row, not a stub. The service client is the real one too — every
 * assertion about "the table did not change" is a SELECT.
 *
 * The hubs the action may edit are the ones in `destinations.ts`; the test adds two skeletons that
 * exist only here (`fa185-test-hub` with a content row, `fa185-no-row` without one) so it never
 * touches the real hubs' rows. Rows it makes, and their audit rows, are deleted afterwards.
 *
 * Red proofs (each refusal is asserted, and the row is read back to show it did not change):
 *   a non-admin / signed-out caller · a slug that is not a hub · a month 13 · a best month outside the
 *   season · a meta description of 161 characters · a half-filled contact · a hub without a row
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createClient as createSupabase, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const h = vi.hoisted(() => ({
  as: 'admin' as 'admin' | 'angler' | 'anon',
  failAudit: false,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidateTag: h.revalidateTag,
  revalidatePath: h.revalidatePath,
  unstable_cache: <T,>(fn: T) => fn,
}))

vi.mock('@/lib/destinations', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/destinations')>()
  const extra = [
    { slug: 'fa185-test-hub', group: 'Nordic', countries: ['Denmark'] },
    { slug: 'fa185-no-row', group: 'Nordic', countries: ['Denmark'] },
  ] as const
  return {
    ...original,
    getHubForSlug: (slug: string) => extra.find(e => e.slug === slug) ?? original.getHubForSlug(slug),
  }
})

const ACCOUNTS = {
  admin:  { email: 'admin@seed.test',  password: 'seed-admin-password-2026' },
  angler: { email: 'angler@seed.test', password: 'seed-angler-password-2026' },
} as const

const signedIn: Partial<Record<'admin' | 'angler', SupabaseClient<Database>>> = {}

async function sessionClient(who: 'admin' | 'angler' | 'anon'): Promise<SupabaseClient<Database>> {
  const client = createSupabase<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  if (who === 'anon') return client
  const cached = signedIn[who]
  if (cached != null) return cached
  const { error } = await client.auth.signInWithPassword(ACCOUNTS[who])
  if (error != null) throw new Error(`seed sign-in failed for ${who}: ${error.message}`)
  signedIn[who] = client
  return client
}

vi.mock('@/lib/supabase/server', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/supabase/server')>()
  return {
    ...original,
    createClient: async () => sessionClient(h.as),
    // The real service client; when `failAudit` is set, a write to audit_log reports an error.
    createServiceClient: () => {
      const real = original.createServiceClient()
      if (!h.failAudit) return real
      return new Proxy(real, {
        get(target, prop, receiver) {
          if (prop !== 'from') return Reflect.get(target, prop, receiver)
          return (table: string) =>
            table === 'audit_log'
              ? { insert: async () => ({ error: { message: 'simulated audit failure' } }) }
              : target.from(table as 'destination_hubs')
        },
      })
    },
  }
})

import { saveHubContent } from '@/actions/hubs'
import { UnauthorizedError } from '@/lib/auth/guards'
import { DESTINATION_HUBS } from '@/lib/destinations'
import { createServiceClient } from '@/lib/supabase/server'
import type { HubContentPayload } from '@/lib/hubs/editor'

const ADMIN_ID = '9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a01'
const svc = () => createServiceClient()
const TEST = 'fa185-test-hub'

const payload = (over: Partial<HubContentPayload> = {}): HubContentPayload => ({
  h1: 'FA-1.85 test hub',
  intro: 'Intro of the test hub.',
  metaTitle: 'Test hub',
  metaDescription: 'Description of the test hub.',
  seasonMonths: [5, 6, 7],
  peakMonths: [6],
  seasonNote: null,
  species: [],
  faq: [{ question: 'When?', answer: 'Summer.' }],
  heroQuoteText: null, heroQuoteAuthor: null, heroQuoteCountry: null,
  proofNote: null,
  contactName: null, contactEmail: null, contactWhatsapp: null,
  ...over,
})

async function row() {
  const { data, error } = await svc().from('destination_hubs').select('*').eq('slug', TEST).single()
  if (error != null) throw new Error(`read ${TEST}: ${error.message}`)
  return data
}

async function auditRows() {
  const { id } = await row()
  const { data } = await svc().from('audit_log').select('*').eq('table_name', 'destination_hubs').eq('record_id', id).order('changed_at')
  return data ?? []
}

async function cleanup() {
  const { data } = await svc().from('destination_hubs').select('id').eq('slug', TEST).maybeSingle()
  if (data != null) await svc().from('audit_log').delete().eq('table_name', 'destination_hubs').eq('record_id', data.id)
  await svc().from('destination_hubs').delete().eq('slug', TEST)
}

let realHubsBefore: string

beforeAll(async () => {
  await cleanup()
  const { error } = await svc().from('destination_hubs').insert({
    slug: TEST, h1: 'Original headline', intro: 'Original intro.', meta_title: 'Original', meta_description: 'Original description.',
    season_months: [5, 6], peak_months: [6],
    faq: [{ question: 'Original?', answer: 'Original.' }],
  })
  if (error != null) throw new Error(`insert test hub: ${error.message}`)
  realHubsBefore = JSON.stringify((await svc().from('destination_hubs').select('slug, updated_at').in('slug', DESTINATION_HUBS.map(x => x.slug)).order('slug')).data)
})

afterAll(async () => {
  // The real hubs' rows were never touched by this file.
  const after = JSON.stringify((await svc().from('destination_hubs').select('slug, updated_at').in('slug', DESTINATION_HUBS.map(x => x.slug)).order('slug')).data)
  await cleanup()
  expect(after).toBe(realHubsBefore)
})

beforeEach(() => {
  h.as = 'admin'
  h.failAudit = false
  h.revalidateTag.mockClear()
  h.revalidatePath.mockClear()
})

describe('saveHubContent — who may write (red proofs)', () => {
  it('an angler (a signed-in non-admin) is refused, and nothing changes', async () => {
    h.as = 'angler'
    const before = await row()
    await expect(saveHubContent(TEST, payload({ h1: 'Hacked' }))).rejects.toThrow(UnauthorizedError)
    expect(await row()).toEqual(before)
    expect(await auditRows()).toHaveLength(0)
    expect(h.revalidateTag).not.toHaveBeenCalled()
  })

  it('a signed-out caller is refused, and nothing changes', async () => {
    h.as = 'anon'
    const before = await row()
    await expect(saveHubContent(TEST, payload({ h1: 'Hacked' }))).rejects.toThrow(UnauthorizedError)
    expect(await row()).toEqual(before)
    expect(await auditRows()).toHaveLength(0)
  })
})

describe('saveHubContent — what it refuses (red proofs)', () => {
  it('a slug that is not a hub', async () => {
    const result = await saveHubContent('atlantis', payload())
    expect(result).toEqual({ success: false, error: 'Unknown hub' })
    const { data } = await svc().from('destination_hubs').select('slug').eq('slug', 'atlantis')
    expect(data).toEqual([])   // and nothing was created
  })

  it('a hub that exists in code but has no row cannot be created here', async () => {
    const result = await saveHubContent('fa185-no-row', payload())
    expect(result).toMatchObject({ success: false })
    expect(result.success === false && result.error).toMatch(/no content row/)
    const { data } = await svc().from('destination_hubs').select('slug').eq('slug', 'fa185-no-row')
    expect(data).toEqual([])
  })

  // The messages are the form schema's own (src/lib/hubs/editor.ts), not the table's sentences for the
  // same rules: the table is the second line, and a regex that fits both would not show the first is there.
  const refusals: [string, Partial<HubContentPayload>, RegExp][] = [
    ['a month 13 in the season', { seasonMonths: [1, 13], peakMonths: [] }, /^A month is 1–12$/],
    ['a best month outside the season', { seasonMonths: [5, 6], peakMonths: [6, 9] }, /^Best months must be inside the season \(Sep are not\)$/],
    ['a meta description of 161 characters', { metaDescription: 'x'.repeat(161) }, /^Meta description is too long — 160 characters at most$/],
    ['a contact with only a name', { contactName: 'Krzysztof' }, /^Contact: the e-mail and the WhatsApp number are missing — fill all of it or none$/],
    ['a quote with no author', { heroQuoteText: 'Great.', heroQuoteCountry: 'NZ' }, /^Hero quote: the author is missing — fill all of it or none$/],
    ['a FAQ entry with no answer', { faq: [{ question: 'Q?', answer: '' }] }, /^Answer cannot be blank$/],
  ]
  it.each(refusals)('%s', async (_label, over, message) => {
    const before = await row()
    const result = await saveHubContent(TEST, payload(over))
    expect(result.success).toBe(false)
    expect(result.success === false && result.error).toMatch(message)
    expect(await row()).toEqual(before)
    expect(await auditRows()).toHaveLength(0)
    expect(h.revalidateTag).not.toHaveBeenCalled()
  })
})

describe('saveHubContent — a save', () => {
  it('updates the row, writes ONE audit_log row with the changed fields, and refreshes the hub pages', async () => {
    const result = await saveHubContent(TEST, payload({
      h1: 'Edited headline',
      faq: [{ question: 'When?', answer: 'Summer, mostly.' }],
      contactName: 'Krzysztof', contactEmail: 'k@example.com', contactWhatsapp: '+48 123 456 789',
    }))
    expect(result).toEqual({ success: true, slug: TEST, changed: true })

    const saved = await row()
    expect(saved).toMatchObject({
      h1: 'Edited headline', intro: 'Intro of the test hub.', season_months: [5, 6, 7],
      faq: [{ question: 'When?', answer: 'Summer, mostly.' }],
      contact_name: 'Krzysztof', contact_email: 'k@example.com', contact_whatsapp: '48123456789',
    })

    const audit = await auditRows()
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ table_name: 'destination_hubs', operation: 'UPDATE', record_id: saved.id, changed_by: ADMIN_ID })
    // Only what changed, each field in full: peak_months, species, season_note… did not change and are not in the row.
    expect(Object.keys(audit[0].new_data as object).sort()).toEqual(
      ['contact_email', 'contact_name', 'contact_whatsapp', 'faq', 'h1', 'intro', 'meta_description', 'meta_title', 'season_months'],
    )
    expect(audit[0].old_data).toMatchObject({ h1: 'Original headline', faq: [{ question: 'Original?', answer: 'Original.' }] })
    expect(audit[0].new_data).toMatchObject({ h1: 'Edited headline', contact_whatsapp: '48123456789' })

    expect(h.revalidateTag).toHaveBeenCalledWith('hubs', {})
    for (const hub of DESTINATION_HUBS) expect(h.revalidatePath).toHaveBeenCalledWith(`/${hub.slug}`)
    expect(h.revalidatePath).toHaveBeenCalledWith('/admin/hubs')
  })

  it('a second save is a second audit row', async () => {
    await saveHubContent(TEST, payload({ h1: 'Edited again' }))
    expect(await auditRows()).toHaveLength(2)
  })

  it('a save that changes nothing writes no audit row and refreshes nothing', async () => {
    const current = await row()
    const same = payload({
      h1: current.h1, intro: current.intro, metaTitle: current.meta_title, metaDescription: current.meta_description,
      seasonMonths: current.season_months, peakMonths: current.peak_months,
      faq: current.faq as { question: string; answer: string }[],
      contactName: current.contact_name, contactEmail: current.contact_email, contactWhatsapp: current.contact_whatsapp,
    })
    const before = await auditRows()
    expect(await saveHubContent(TEST, same)).toEqual({ success: true, slug: TEST, changed: false })
    expect(await auditRows()).toHaveLength(before.length)
    expect((await row()).updated_at).toBe(current.updated_at)
    expect(h.revalidateTag).not.toHaveBeenCalled()
  })

  it('if the audit insert fails the save stands and the failure is logged (tj decision 1)', async () => {
    const before = (await auditRows()).length
    h.failAudit = true
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await saveHubContent(TEST, payload({ h1: 'Saved despite the audit failure' }))
    expect(result).toMatchObject({ success: true, changed: true })
    expect((await row()).h1).toBe('Saved despite the audit failure')
    h.failAudit = false
    expect(await auditRows()).toHaveLength(before)
    expect(errors).toHaveBeenCalledWith('[hub audit] insert failed:', 'simulated audit failure')
    errors.mockRestore()
  })
})
