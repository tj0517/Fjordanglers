/**
 * FA-1.86 (tj D1) — public surfaces never link a guide profile by UUID. A guide without a slug is
 * shown without a link: no /guides/<uuid>, /guides/null or /guides/undefined anywhere in the HTML,
 * and no JSON-LD entry for it. Listing, home strip, v1 offer-page builder input and the shared card.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { GuideLink } from '@/components/guides/guide-link'

const SLUGGED = { id: '11111111-1111-4111-8111-111111111111', slug: 'has-slug-iceland', full_name: 'Has Slug' }
const NO_SLUG = { id: '22222222-2222-4222-8222-222222222222', slug: null, full_name: 'No Slug' }

const guideRow = (g: { id: string; slug: string | null; full_name: string }) => ({
  ...g, avatar_url: null, cover_url: null, country: 'Iceland', city: null, bio: null,
  average_rating: null, years_experience: null, fish_expertise: ['Salmon'], languages: ['English'], tagline: null,
})

vi.mock('@/lib/supabase/queries', () => ({
  getGuides: async () => ({ guides: [guideRow(SLUGGED), guideRow(NO_SLUG)], total: 2 }),
  getPlatformStats: async () => ({ guideCount: 2, countryCount: 1, languageCount: 1 }),
  getFeaturedGuides: async () => [guideRow(SLUGGED), guideRow(NO_SLUG)],
  getFeaturedExperiencePages: async () => [],
  getSpeciesCounts: async () => ({}),
  getLatestBlogPosts: async () => [],
}))
vi.mock('@/lib/supabase/testimonials', () => ({ getTestimonial: async () => null }))
vi.mock('@/app/(public)/guides/guides-filters', () => ({ GuidesFilters: () => null }))
vi.mock('./guides-filters', () => ({ GuidesFilters: () => null }))
vi.mock('@/components/layout/nav', () => ({ SiteNav: () => null }))
vi.mock('@/components/layout/footer', () => ({ SiteFooter: () => null }))
vi.mock('@/components/home/species-slider', () => ({ SpeciesSlider: () => null }))
vi.mock('@/components/home/experiences-slider', () => ({ ExperiencesSlider: () => null }))
vi.mock('@/components/home/bg-video', () => ({ BgVideo: () => null }))
vi.mock('@/components/ui/contact-expert-button', () => ({ ContactExpertButton: () => null }))
vi.mock('@/components/testimonial-banner', () => ({ default: () => null }))

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map(m => m[1]!)
const guideHrefs = (html: string) => hrefs(html).filter(h => h.startsWith('/guides/'))
const assertNoUuid = (html: string) => {
  expect(html).not.toContain(NO_SLUG.id)
  expect(html).not.toMatch(/\/guides\/(null|undefined)\b/)
}

describe('GuideLink', () => {
  it('links with a slug, renders a plain block without one', () => {
    expect(renderToStaticMarkup(<GuideLink slug="a-b" className="c">x</GuideLink>)).toContain('href="/guides/a-b"')
    for (const slug of [null, undefined, '', '  ']) {
      const html = renderToStaticMarkup(<GuideLink slug={slug} className="c">x</GuideLink>)
      expect(html).not.toContain('href')
      expect(html).toContain('>x<')
    }
  })
})

describe('/guides listing', () => {
  it('links the guide with a slug; the one without shows no link, no UUID, no JSON-LD entry', async () => {
    const { default: GuidesPage } = await import('@/app/(public)/guides/page')
    const html = renderToStaticMarkup(await GuidesPage({ searchParams: Promise.resolve({}) }))
    expect(guideHrefs(html)).toEqual(['/guides/has-slug-iceland'])
    assertNoUuid(html)
    expect(html).toContain('No Slug') // still shown, just not linked
    const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)![1]!.replace(/&quot;/g, '"')) as {
      itemListElement: { item: { name: string; url: string } }[]
    }
    expect(ld.itemListElement.map(e => e.item.url)).toEqual(['https://www.fjordanglers.com/guides/has-slug-iceland'])
  })
})

describe('home — "People you\'ll fish with"', () => {
  it('links the guide with a slug; the one without shows no link and no UUID', async () => {
    const { default: Home } = await import('@/app/page')
    const html = renderToStaticMarkup(await Home())
    expect(guideHrefs(html)).toEqual(['/guides/has-slug-iceland'])
    assertNoUuid(html)
    expect(html).toContain('No Slug')
  })
})
