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
  photoLayout:   'horizontal',
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

  /**
   * FA-1.71 — the admin's choice, not a guess from the file. The attribute is the contract the
   * page renders; the class is what actually moves the photo beside the quote from `sm` up.
   */
  describe('photo layout', () => {
    const PHOTO = 'https://x.supabase.co/storage/v1/object/public/guide-photos/testimonials/a.jpg'

    it('horizontal: the photo stays a strip across the top', () => {
      const { container } = render(
        <TestimonialBanner testimonial={testimonial({ photoUrl: PHOTO, photoLayout: 'horizontal' })} />,
      )
      const figure = container.querySelector('figure')
      expect(figure?.getAttribute('data-photo-layout')).toBe('horizontal')
      expect(figure?.className).not.toContain('sm:flex-row')
      expect(container.querySelector('img')).not.toBeNull()
    })

    it('vertical: the card turns into a row from sm up, with the photo down the side', () => {
      const { container } = render(
        <TestimonialBanner testimonial={testimonial({ photoUrl: PHOTO, photoLayout: 'vertical' })} />,
      )
      const figure = container.querySelector('figure')
      expect(figure?.getAttribute('data-photo-layout')).toBe('vertical')
      expect(figure?.className).toContain('sm:flex-row')
      expect(container.querySelector('img')?.className).toContain('object-cover')
      // The words are still all there — the layout moved, nothing was dropped.
      expect(container.textContent).toContain('Fixture quote.')
      expect(container.textContent).toContain('Marek, Poland')
    })

    it('vertical on a row with no photo changes nothing: no attribute, no row, no <img>', () => {
      const { container } = render(
        <TestimonialBanner testimonial={testimonial({ photoUrl: null, photoLayout: 'vertical' })} />,
      )
      const figure = container.querySelector('figure')
      expect(figure?.hasAttribute('data-photo-layout')).toBe(false)
      expect(figure?.className).not.toContain('sm:flex-row')
      expect(container.querySelector('img')).toBeNull()
    })
  })

  it('null renders nothing — no heading, no wrapper', () => {
    const { container } = render(<TestimonialBanner testimonial={null} />)
    expect(container.innerHTML).toBe('')
  })
})
