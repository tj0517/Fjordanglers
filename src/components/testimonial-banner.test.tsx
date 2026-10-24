// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { Testimonial } from '@/lib/supabase/testimonials'
import TestimonialBanner from './testimonial-banner'

afterEach(cleanup)

/**
 * FA-1.69 — one testimonial on the navy band. The source is said truthfully: Trustpilot links
 * to the review, a direct one says so in one sentence, and nothing renders without a testimonial.
 */

const testimonial = (over: Partial<Testimonial> = {}): Testimonial => ({
  id:            't1',
  quote:         'Fixture quote.',
  authorName:    'Marek',
  authorCountry: 'PL',
  tripCountry:   'New Zealand',
  rating:        5,
  photoUrl:      null,
  source:        'trustpilot',
  sourceUrl:     'https://www.trustpilot.com/reviews/fixture',
  ...over,
})

describe('TestimonialBanner', () => {
  it('trustpilot: links to the review in a new tab, no direct-source sentence', () => {
    const { container, getByText, queryByTestId } = render(<TestimonialBanner testimonial={testimonial()} />)
    const link = getByText('Read on Trustpilot ›')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('https://www.trustpilot.com/reviews/fixture')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(queryByTestId('testimonial-direct')).toBeNull()
    expect(container.querySelector('[data-block="testimonial"]')).not.toBeNull()
    expect(container.querySelector('[data-section]')).toBeNull()
  })

  it('direct: no link at all, one sentence that it was sent to us directly', () => {
    const { container, getByTestId } = render(
      <TestimonialBanner testimonial={testimonial({ source: 'direct', sourceUrl: null, authorName: 'Jonas', authorCountry: 'DE' })} />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(getByTestId('testimonial-direct').textContent).toContain('Sent to FjordAnglers directly')
  })

  it('a trustpilot row without its link claims no source rather than the wrong one', () => {
    const { container, queryByTestId } = render(<TestimonialBanner testimonial={testimonial({ sourceUrl: null })} />)
    expect(container.querySelector('a')).toBeNull()
    expect(queryByTestId('testimonial-direct')).toBeNull()
  })

  it('quote, stars and "Name, Country" from the alpha-2 code', () => {
    const { container, getByText, getByLabelText } = render(<TestimonialBanner testimonial={testimonial()} />)
    expect(container.querySelector('blockquote')?.textContent).toBe('“Fixture quote.”')
    expect(getByText('Marek, Poland')).toBeTruthy()
    expect(getByLabelText('5 out of 5')).toBeTruthy()
  })

  it('no rating, no stars; no author country, just the name', () => {
    const { container, getByText } = render(
      <TestimonialBanner testimonial={testimonial({ rating: null, authorCountry: null })} />,
    )
    expect(container.querySelector('[aria-label$="out of 5"]')).toBeNull()
    expect(getByText('Marek')).toBeTruthy()
  })

  it('no photo, no <img>; a photo renders one', () => {
    const { container, rerender } = render(<TestimonialBanner testimonial={testimonial()} />)
    expect(container.querySelector('img')).toBeNull()
    rerender(<TestimonialBanner testimonial={testimonial({ photoUrl: 'https://x.supabase.co/storage/v1/object/public/guide-photos/testimonials/a.jpg' })} />)
    expect(container.querySelector('img')).not.toBeNull()
  })

  it('null renders nothing — no heading, no wrapper', () => {
    const { container } = render(<TestimonialBanner testimonial={null} />)
    expect(container.innerHTML).toBe('')
  })
})
