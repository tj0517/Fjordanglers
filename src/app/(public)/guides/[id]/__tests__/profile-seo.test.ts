/**
 * FA-1.86 — the public guide profile: duplicate redirect (D2), noindex without an active offer,
 * no canonical / UUID for a profile without a slug.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const JOSH_REAL = '1a30602e-05f8-4a5d-a89f-76b4d53843a4'
const JOSH_DUP  = 'cd8f48f1-0633-4832-9c56-0f2cb4c7ee6d'

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND') },
  permanentRedirect: (to: string) => { throw new Error(`REDIRECT:${to}`) },
}))

const getGuide = vi.fn()
const getGuideExperiencePages = vi.fn()
vi.mock('@/lib/supabase/queries', () => ({
  getGuide: (...a: unknown[]) => getGuide(...a),
  getGuideExperiencePages: (...a: unknown[]) => getGuideExperiencePages(...a),
}))

import GuideProfilePage, { generateMetadata } from '../page'

const guide = (over: Record<string, unknown> = {}) => ({
  id: 'g-1', slug: 'some-guide', full_name: 'Some Guide', country: 'Iceland', city: null, bio: null,
  avatar_url: null, cover_url: null, fish_expertise: [], images: [], ...over,
})
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const OFFER = [{ id: 'o-1' }]

beforeEach(() => {
  getGuide.mockReset()
  getGuideExperiencePages.mockReset()
})

describe('duplicate redirect (D2)', () => {
  it('/guides/<duplicate id> → 308 to the real profile slug, even though the duplicate itself 404s', async () => {
    getGuide.mockImplementation(async (id: string) =>
      id === JOSH_REAL ? guide({ id: JOSH_REAL, slug: 'josh-hart-new-zealand' }) : null)
    await expect(GuideProfilePage(params(JOSH_DUP))).rejects.toThrow('REDIRECT:/guides/josh-hart-new-zealand')
  })

  it('falls through to 404 — never /guides/null — while the real profile has no slug yet', async () => {
    getGuide.mockImplementation(async (id: string) =>
      id === JOSH_REAL ? guide({ id: JOSH_REAL, slug: null }) : null)
    await expect(GuideProfilePage(params(JOSH_DUP))).rejects.toThrow('NOT_FOUND')
  })

  it('an ordinary UUID of a guide that has a slug still redirects to the slug', async () => {
    getGuide.mockResolvedValue(guide({ id: '5b1c2d3e-0000-4000-8000-000000000001', slug: 'real-slug' }))
    await expect(GuideProfilePage(params('5b1c2d3e-0000-4000-8000-000000000001'))).rejects.toThrow('REDIRECT:/guides/real-slug')
  })
})

describe('noindex and canonical', () => {
  it('a profile with a slug and an active offer is indexable and canonical', async () => {
    getGuide.mockResolvedValue(guide())
    getGuideExperiencePages.mockResolvedValue(OFFER)
    const m = await generateMetadata(params('some-guide'))
    expect(m).not.toHaveProperty('robots')
    expect(m.alternates).toEqual({ canonical: 'https://www.fjordanglers.com/guides/some-guide' })
  })

  it('a profile without an active offer is noindex (and keeps its canonical)', async () => {
    getGuide.mockResolvedValue(guide())
    getGuideExperiencePages.mockResolvedValue([])
    const m = await generateMetadata(params('some-guide'))
    expect(m.robots).toEqual({ index: false })
    expect(m.alternates).toEqual({ canonical: 'https://www.fjordanglers.com/guides/some-guide' })
  })

  it('a profile without a slug is noindex with no canonical and no URL — never the UUID', async () => {
    getGuide.mockResolvedValue(guide({ slug: null, id: '5b1c2d3e-0000-4000-8000-000000000002' }))
    getGuideExperiencePages.mockResolvedValue(OFFER)
    const m = await generateMetadata(params('5b1c2d3e-0000-4000-8000-000000000002'))
    expect(m.robots).toEqual({ index: false })
    expect(m).not.toHaveProperty('alternates')
    expect(JSON.stringify(m)).not.toContain('5b1c2d3e-0000-4000-8000-000000000002')
    expect(JSON.stringify(m)).not.toMatch(/\/guides\/(null|undefined)/)
  })
})
