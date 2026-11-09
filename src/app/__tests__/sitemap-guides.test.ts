/**
 * FA-1.86 — guide profiles in the sitemap: slug only (never a UUID), and only with an active
 * offer (a profile without one is noindex, so it is not listed either).
 */
import { describe, it, expect, vi } from 'vitest'

const UUID_ONLY_GUIDE = '99999999-9999-4999-8999-999999999999'

vi.mock('@/lib/supabase/server', () => {
  const rows: Record<string, unknown[]> = {
    experience_pages: [
      { slug: 'offer-a', updated_at: '2026-10-01T08:30:00Z', guide_id: 'g-with-offer' },
      { slug: 'offer-b', updated_at: '2026-10-01T08:30:00Z', guide_id: '99999999-9999-4999-8999-999999999999' },
    ],
    guides: [
      { id: 'g-with-offer',    slug: 'with-offer',  updated_at: null },
      { id: 'g-no-offer',      slug: 'no-offer',    updated_at: null },
      { id: '99999999-9999-4999-8999-999999999999', slug: null, updated_at: null },
      { id: 'g-blank-slug',    slug: '  ',          updated_at: null },
    ],
  }
  const from = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: rows[table] ?? [], error: null }),
    }
    return chain
  }
  return { createServiceClient: () => ({ from }) }
})

import sitemap from '../sitemap'

describe('sitemap — guide profiles (FA-1.86)', () => {
  it('lists a guide that has a slug and an active offer', async () => {
    const urls = (await sitemap()).map(e => e.url)
    expect(urls).toContain('https://www.fjordanglers.com/guides/with-offer')
  })

  it('omits a guide without an active offer', async () => {
    const urls = (await sitemap()).map(e => e.url)
    expect(urls.some(u => u.endsWith('/guides/no-offer'))).toBe(false)
  })

  it('never lists a guide by UUID, nor /guides/null, /guides/undefined or a blank slug', async () => {
    const guideUrls = (await sitemap()).map(e => e.url).filter(u => /\/guides\/./.test(u))
    expect(guideUrls).toEqual(['https://www.fjordanglers.com/guides/with-offer'])
    for (const u of guideUrls) {
      expect(u).not.toContain(UUID_ONLY_GUIDE)
      expect(u).not.toMatch(/\/guides\/(null|undefined)\b/)
    }
  })
})
