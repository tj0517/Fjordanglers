/**
 * The trust row under the home hero CTA (tj, 2026-11-20): the shown review's stars — named as one
 * angler's rating and linking to it — and the Stripe deposit line; no rated review, no stars.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Testimonial } from '@/lib/supabase/testimonials'

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: () => {} }) }))

import HomeView from '../home-view'

const review = (over: Partial<Testimonial> = {}): Testimonial => ({
  id: 't-1', quote: 'Best week of the year.', authorName: 'Mark', authorCountry: 'GB', tripCountry: 'Iceland',
  rating: 5, photoUrl: null, photoLayout: 'horizontal', source: 'trustpilot', sourceUrl: 'https://trustpilot.com/r/1',
  ...over,
})
const trust = (testimonial: Testimonial | null) => {
  const html = renderToStaticMarkup(<HomeView data={{ hubs: [], guides: [], posts: [], testimonial }} />)
  return /data-testid="hero-trust"(.*?)<\/ul>/.exec(html)![1]!
}

describe('hero trust row', () => {
  it('a rated Trustpilot review: five stars, whose rating it is, a link to the review; the Stripe line', () => {
    const row = trust(review())
    expect(row).toContain('aria-label="5 out of 5"')
    expect(row).toContain('5/5 from Mark on Trustpilot')
    expect(row).toContain('href="#reviews"')
    expect(row).toContain('Deposit paid securely through Stripe')
  })

  it('a direct review does not claim Trustpilot', () => {
    expect(trust(review({ source: 'direct', rating: 4 }))).toContain('4/5 from Mark<')
  })

  it('no review, or one without a rating: only the Stripe line', () => {
    for (const t of [null, review({ rating: null })]) {
      const row = trust(t)
      expect(row).not.toContain('out of 5')
      expect(row).toContain('Deposit paid securely through Stripe')
    }
  })
})
