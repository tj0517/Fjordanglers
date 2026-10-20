// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import OfferFit, { type OfferFitProps } from './offer-fit'

afterEach(cleanup)

/**
 * S5 "Who it's for" — not rendered on the page since FA-1.62 (tj, 2026-10-20: hidden, not
 * removed). The component and its data stay so the section can come back with one line in
 * ./offer-body.tsx; these tests keep it working until then.
 */

const fit = (over: Partial<OfferFitProps> = {}) => render(
  <OfferFit suitedFor={['you cast 12–15 m in wind']} notSuitedFor={['you are a complete beginner']} expectationsText={null} {...over} />,
)

describe('OfferFit (S5, kept unrendered)', () => {
  it('draws both lists under "Who it\'s for"', () => {
    const { container } = fit()
    const s5 = container.querySelector('[data-section="S5"]')!
    expect(s5.textContent).toContain("Who it's for")
    expect(s5.textContent).toContain('you cast 12–15 m in wind')
    expect(s5.textContent).toContain('you are a complete beginner')
  })

  it('no list, no section', () => {
    expect(fit({ suitedFor: [], notSuitedFor: [] }).container.querySelector('[data-section="S5"]')).toBeNull()
  })

  it('an expectations quote alone does not open S5', () => {
    const { container } = fit({ suitedFor: [], notSuitedFor: [], expectationsText: 'Only a quote.' })
    expect(container.querySelector('[data-section="S5"]')).toBeNull()
  })

  it('renders admin text as text, never as markup', () => {
    const html = '<img src=x onerror=alert(1)>'
    const { container } = fit({ suitedFor: [html] })
    expect(container.querySelector('img[src="x"]')).toBeNull()
    expect(container.textContent).toContain(html)
  })
})
