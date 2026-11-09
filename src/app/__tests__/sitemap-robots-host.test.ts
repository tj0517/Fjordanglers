/**
 * FA-1.79 — one canonical host.
 *
 * sitemap.xml and robots.txt must only ever point at the www host. The expected
 * host is a literal on purpose: if someone changes SITE_URL back to the apex
 * (or hard-codes an apex URL in sitemap.ts / robots.ts) these tests fail.
 */
import { describe, it, expect, vi } from 'vitest'

const CANONICAL_HOST = 'www.fjordanglers.com'

// The sitemap reads active offers and guides; give it one of each so the
// DB-derived URLs are checked too, not only the static ones.
vi.mock('@/lib/supabase/server', () => {
  const rows: Record<string, unknown[]> = {
    experience_pages: [{ slug: 'test-offer', updated_at: '2026-10-01T00:00:00Z', guide_id: 'guide-uuid-1' }],
    guides: [{ id: 'guide-uuid-1', slug: 'test-guide', updated_at: null }],
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
import robots from '../robots'

describe('sitemap host', () => {
  it('every URL is on the www host (static, hub, blog, offer and guide entries)', async () => {
    const entries = await sitemap()
    const urls = entries.map(e => e.url)

    // The DB-derived entries must be present, otherwise this test proves less than it claims.
    expect(urls).toContain(`https://${CANONICAL_HOST}/experiences/test-offer`)
    expect(urls).toContain(`https://${CANONICAL_HOST}/guides/test-guide`)

    const hosts = new Set(urls.map(u => new URL(u).host))
    expect([...hosts]).toEqual([CANONICAL_HOST])
  })

  it('contains no apex-host URL', async () => {
    const urls = (await sitemap()).map(e => e.url)
    expect(urls.filter(u => u.startsWith('https://fjordanglers.com'))).toEqual([])
  })
})

describe('robots host', () => {
  it('the Sitemap: line points at the www host', () => {
    const sitemaps = [robots().sitemap ?? []].flat()
    expect(sitemaps).toEqual([`https://${CANONICAL_HOST}/sitemap.xml`])
  })
})
