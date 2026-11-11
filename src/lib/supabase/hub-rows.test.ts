/**
 * The hub content table against the local Supabase stack (FA-1.85).
 * Env is loaded by vitest setupFiles (src/tests/setup.ts), whose fuse aborts on a non-local URL.
 *
 * It reads the six rows the data migration (20261111010000) put there — nothing is inserted — and
 * pins down what every hub must have in them. Before FA-1.85 `destinations.test.ts` checked the same
 * things against the copy in code (every hub is a landing page for search: its editorial fields are
 * not optional in practice, even though a section hides when its field is empty).
 *
 *   rows        — one per hub in `destinations.ts`; `getHubContents` serves them by slug
 *   content     — each row passes the editor's own schema (limits, months, FAQ), has 3–6 questions
 *   write path  — an anon client cannot INSERT, UPDATE or DELETE (42501): the table is public to read only
 */
import { vi, describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag:  vi.fn(),
  unstable_cache: <T,>(fn: T) => fn,
}))

import { DESTINATION_HUBS } from '@/lib/destinations'
import { HubContentPayloadSchema } from '@/lib/hubs/editor'
import { createServiceClient } from '@/lib/supabase/server'
import { getHubContents } from './queries'

const anon = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

describe('destination_hubs rows', () => {
  it('there is a row for every hub in code, served by getHubContents', async () => {
    const contents = await getHubContents()
    for (const hub of DESTINATION_HUBS) expect(contents[hub.slug], hub.slug).toBeDefined()
  })

  it.each(DESTINATION_HUBS.map(h => h.slug))('%s: the row passes the editor schema and is complete', async slug => {
    const c = (await getHubContents())[slug]
    const parsed = HubContentPayloadSchema.safeParse({
      h1: c.h1, intro: c.intro, metaTitle: c.metaTitle, metaDescription: c.metaDescription,
      seasonMonths: c.seasonMonths ?? [], peakMonths: c.peakMonths ?? [],
      seasonNote: c.seasonNote ?? null, species: c.species ?? [], faq: c.faq ?? [],
      heroQuoteText: c.heroQuote?.text ?? null, heroQuoteAuthor: c.heroQuote?.author ?? null, heroQuoteCountry: c.heroQuote?.country ?? null,
      proofNote: c.proofNote ?? null,
      contactName: c.contact?.name ?? null, contactEmail: c.contact?.email ?? null, contactWhatsapp: c.contact?.whatsapp ?? null,
    })
    expect(parsed.success, parsed.success ? '' : parsed.error.issues[0]?.message).toBe(true)
    expect((c.faq ?? []).length).toBeGreaterThanOrEqual(3)
    expect((c.faq ?? []).length).toBeLessThanOrEqual(6)
    expect(c.metaDescription.length).toBeLessThanOrEqual(160)
  })

  it('anon can read the rows but cannot write them', async () => {
    const read = await anon.from('destination_hubs').select('slug')
    expect(read.error).toBeNull()
    expect((read.data ?? []).length).toBeGreaterThanOrEqual(DESTINATION_HUBS.length)

    const insert = await anon.from('destination_hubs').insert({ slug: 'fa185-anon', h1: 'h', intro: 'i', meta_title: 't', meta_description: 'd' })
    expect(insert.error?.code).toBe('42501')
    const update = await anon.from('destination_hubs').update({ h1: 'hacked' }).eq('slug', 'norway')
    expect(update.error?.code).toBe('42501')
    const del = await anon.from('destination_hubs').delete().eq('slug', 'norway')
    expect(del.error?.code).toBe('42501')

    const { data } = await createServiceClient().from('destination_hubs').select('h1').eq('slug', 'norway').single()
    expect(data?.h1).not.toBe('hacked')
  })
})
