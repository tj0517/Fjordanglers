// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import type { ExperienceV2 } from '@/lib/supabase/queries'
import OfferBody from './offer-body'
import OfferWidget, { type OfferWidgetProps } from './offer-widget'
import { CurrencyProvider } from './currency-context'
import { fixedPage, customPage, guide } from './v2-page.fixture'

afterEach(cleanup)

/**
 * FA-1.54 — S3–S9 of the v2 offer page. Fixtures: ./v2-page.fixture.ts.
 */

const sections = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-section]')].map(el => el.getAttribute('data-section'))

describe('OfferBody — order and content', () => {
  it('renders S3–S9 in the wireframe order for a fixed page', () => {
    const { container } = render(<OfferBody page={fixedPage()} />)
    expect(sections(container)).toEqual(['S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'])
  })

  it('custom: S6 shows the archetypes and S9 the stored range, with no calculator table', () => {
    const { container } = render(<OfferBody page={customPage()} />)

    expect(sections(container)).toEqual(['S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'])

    const s6 = container.querySelector('[data-section="S6"]')!
    expect(s6.querySelectorAll('[role="tab"]')).toHaveLength(2)
    expect(s6.textContent).toContain('River Ytri')
    expect(s6.querySelector('[data-testid="timeline"]')).toBeNull()

    const s9 = container.querySelector('[data-section="S9"]')!
    expect(s9.querySelector('[data-testid="price-range"]')?.textContent).toBe('€450.50–€3,200')
    expect(s9.querySelector('[data-testid="price-table"]')).toBeNull()
    expect(s9.querySelector('[data-testid="archetype-prices"]')?.textContent).toContain('from €450.50')
  })

  it('custom: the archetype cards switch the itinerary', () => {
    const { container } = render(<OfferBody page={customPage()} />)
    const panel = () => container.querySelector('[data-testid="archetype-panel"]')!.textContent

    expect(panel()).toContain('River Ytri')
    fireEvent.click(container.querySelector('[data-archetype="a2"]')!)
    expect(panel()).toContain('Beat 3')
    expect(panel()).not.toContain('River Ytri')
  })

  it('always says the plan is a sample and the weather decides', () => {
    for (const page of [fixedPage(), customPage()]) {
      const { container, unmount } = render(<OfferBody page={page} />)
      expect(container.querySelector('[data-section="S6"]')!.textContent).toMatch(/sample plan.*weather/)
      unmount()
    }
  })
})

describe('OfferBody — empty field means no section', () => {
  it('a page without suited_for / not_suited_for and day_schedule has no S5 and no S6', () => {
    const page = fixedPage({ suitedFor: [], notSuitedFor: [], daySchedule: [] })
    const { container } = render(<OfferBody page={page} />)

    expect(container.querySelector('[data-section="S5"]')).toBeNull()
    expect(container.querySelector('[data-section="S6"]')).toBeNull()
    expect(sections(container)).toEqual(['S3', 'S4', 'S7', 'S8', 'S9'])
    // no orphan headings either
    expect(container.textContent).not.toContain('The day')
    expect(container.textContent).not.toContain("Who it's for")
  })

  it('a custom page with no archetypes has no S6', () => {
    const { container } = render(<OfferBody page={customPage({ options: [] })} />)
    expect(container.querySelector('[data-section="S6"]')).toBeNull()
  })

  it('an expectations quote alone does not open S5', () => {
    const page = fixedPage({ suitedFor: [], notSuitedFor: [], expectationsText: 'Only a quote.' })
    const { container } = render(<OfferBody page={page} />)
    expect(container.querySelector('[data-section="S5"]')).toBeNull()
  })

  it('S4 is dropped when nothing is included, excluded, licensed, tipped or added on', () => {
    const page = fixedPage({ includes: [], excludes: [], license: null, tipGuidanceText: null, options: [] })
    const { container } = render(<OfferBody page={page} />)
    expect(container.querySelector('[data-section="S4"]')).toBeNull()
  })

  it('S7 is dropped when no guide is shown', () => {
    const { container } = render(<OfferBody page={fixedPage({ guides: [] })} />)
    expect(container.querySelector('[data-section="S7"]')).toBeNull()
  })

  it.each([
    [6, 12, '6–12 km on foot'],
    [8, 8, '8 km on foot'],
    [null, 8, 'up to 8 km on foot'],
    [3, null, 'from 3 km on foot'],
  ])('terrain %s–%s reads "%s"', (min, max, expected) => {
    const page = fixedPage({ walkingKmMin: min, walkingKmMax: max })
    const text = render(<OfferBody page={page} />).container.querySelector('[data-section="S3"]')!.textContent
    expect(text).toContain(expected)
    cleanup()
  })

  it('an empty S3 field is not drawn as a card', () => {
    const page = fixedPage({ speciesNames: [], technique: [], walkingKmMin: null, walkingKmMax: null })
    const text = render(<OfferBody page={page} />).container.querySelector('[data-section="S3"]')!.textContent
    expect(text).not.toContain('Species')
    expect(text).not.toContain('Terrain')
    expect(text).toContain('Group size')
  })
})

describe('S7 — guides', () => {
  it('renders one card per guide it is given, plus the static FA card', () => {
    const page = fixedPage({
      guides: [guide({ id: 'g1' }), guide({ id: 'g2', fullName: 'Sam Lake', isPrimary: false })],
    })
    const { container } = render(<OfferBody page={page} />)
    expect(container.querySelectorAll('[data-testid="guide-card"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-testid="fa-card"]')).toHaveLength(1)
  })

  it('prints language names, not codes', () => {
    const page = fixedPage({ guides: [guide({ languages: ['en', 'is'] })] })
    const { container } = render(<OfferBody page={page} />)
    expect(container.querySelector('[data-section="S3"]')!.textContent).toContain('English, Icelandic')
    expect(container.querySelector('[data-testid="guide-card"]')!.textContent).toContain('Speaks English, Icelandic')
  })

  it('shortens a long bio on a word boundary', () => {
    const bio = 'word '.repeat(200)
    const { container } = render(<OfferBody page={fixedPage({ guides: [guide({ bio })] })} />)
    const card = container.querySelector('[data-testid="guide-card"]')!.textContent!
    expect(card).toContain('…')
    expect(card.length).toBeLessThan(500)
  })
})

describe('S4 — licence link', () => {
  const licenceRow = (license: ExperienceV2['license']) => {
    const { container } = render(<OfferBody page={fixedPage({ license })} />)
    return container.querySelector('[data-section="S4"]')!
  }

  it('an https link is external with rel="noopener noreferrer"', () => {
    const a = licenceRow({ required: true, buyUrl: 'https://fishandgame.example/licence', buyText: null, priceText: null, steps: [] })
      .querySelector('a')!
    expect(a.getAttribute('href')).toBe('https://fishandgame.example/licence')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('anything that is not http(s) is plain text, not a link', () => {
    const row = licenceRow({ required: true, buyUrl: null, buyText: 'javascript:alert(1)', priceText: null, steps: [] })
    expect(row.querySelector('a')).toBeNull()
    expect(row.textContent).toContain('javascript:alert(1)')
  })

  it('says the licence is bought online by the angler', () => {
    expect(licenceRow({ required: true, buyUrl: null, buyText: null, priceText: null, steps: [] }).textContent)
      .toContain('you buy it yourself online')
  })

  it('renders admin text as text, never as markup', () => {
    const html = '<img src=x onerror=alert(1)>'
    const { container } = render(<OfferBody page={fixedPage({ tipGuidanceText: html, suitedFor: [html] })} />)
    expect(container.querySelector('img[src="x"]')).toBeNull()
    expect(container.textContent).toContain(html)
  })
})

describe('S8 — how booking works', () => {
  const steps = (page: ExperienceV2) => {
    const { container } = render(<OfferBody page={page} />)
    return [...container.querySelectorAll('[data-section="S8"] [data-step]')].map(el => el.textContent ?? '')
  }

  it('has four steps wired to the offer ETA, the fee and the primary guide', () => {
    const s = steps(fixedPage({ guides: [guide({ balancePaymentMethod: 'stripe' })] }))
    expect(s).toHaveLength(4)
    expect(s[1]).toContain('within 48–72 h')
    expect(s[2]).toContain('20%')
    expect(s[2]).toContain('72 h')
    expect(s[3]).toContain('online by card')
  })

  it('a missing ETA drops the clause, not the step', () => {
    const s = steps(fixedPage({ offerEtaText: null }))
    expect(s).toHaveLength(4)
    expect(s[1]).not.toContain('—')
  })

  it('reads a cash guide as cash and the fee as the page stores it', () => {
    const s = steps(fixedPage({ feePct: 0.125, guides: [guide({ balancePaymentMethod: 'cash' })] }))
    expect(s[2]).toContain('12.5%')
    expect(s[3]).toContain('in cash')
  })

  it('is the anchor the top bar links to', () => {
    const { container } = render(<OfferBody page={fixedPage()} />)
    expect(container.querySelector('#jak-dziala')?.getAttribute('data-section')).toBe('S8')
    expect(container.querySelector('#cena')?.getAttribute('data-section')).toBe('S9')
  })
})

describe('S9 — price and deposit', () => {
  const nine = (page: ExperienceV2) => render(<OfferBody page={page} />).container.querySelector('[data-section="S9"]')!

  it('prices the table with the same code as the widget: (1 day, 2 anglers) is the same amount', () => {
    const page = fixedPage()

    const s9   = nine(page)
    const cell = s9.querySelector('[data-testid="price-table"] td[data-days="1"][data-anglers="2"]')!.textContent!
    cleanup()

    const widgetProps: OfferWidgetProps = {
      offerMode: page.offerMode, prices: page.prices, feePct: page.feePct, currency: page.currency,
      maxAnglersPerGuide: page.maxAnglersPerGuide, minDays: page.minDays, maxDays: page.maxDays,
      priceFromCents: page.priceFromCents, priceToCents: page.priceToCents,
      responseSlaHours: page.responseSlaHours, inquiryHref: '#zapytanie', guide: null,
    }
    const widget = render(
      <CurrencyProvider baseCurrency={page.currency} rates={{}}>
        <OfferWidget {...widgetProps} />
      </CurrencyProvider>,
    ).getByTestId('offer-widget')

    // The widget opens on (minDays = 1, 2 anglers); 1 250 guide + 20% fee = 1 500.
    expect(cell).toBe('NZ$1,500')
    expect(widget.textContent).toContain(cell)
  })

  it('the Total / Deposit / Balance block adds up for the default configuration', () => {
    const text = nine(fixedPage()).textContent!
    expect(text).toContain('NZ$1,500')   // total
    expect(text).toContain('NZ$250')     // deposit — the 20% fee
    expect(text).toContain('NZ$1,250')   // balance to the guide
  })

  it('says "on request" for a cell with no exact row, and warns about the currency', () => {
    const s9 = nine(fixedPage())
    // 2 days × 1 angler has no row of its own; only the 2-angler row covers it.
    expect(s9.querySelector('td[data-days="2"][data-anglers="1"]')?.textContent).toBe('on request')
    const note = s9.querySelector('[data-testid="currency-note"]')?.textContent
    expect(note).toContain('NZD')
    expect(note).toContain('charged in EUR')
  })

  it('no currency warning on a EUR page', () => {
    const page = fixedPage({
      currency: 'EUR',
      prices: [{ days: 1, anglers: 2, guidePriceCents: 125000, currency: 'EUR' }],
    })
    expect(nine(page).querySelector('[data-testid="currency-note"]')).toBeNull()
  })

  it('shows the weather note and no global refund line (O-35, option D)', () => {
    const text = nine(fixedPage()).textContent!
    expect(text).toContain('Unsafe conditions: free reschedule.')
    expect(text.toLowerCase()).not.toContain('refund')
  })

  it('is dropped when there is nothing priced and no weather note', () => {
    const { container } = render(<OfferBody page={fixedPage({ prices: [], weatherPolicyText: null })} />)
    expect(container.querySelector('[data-section="S9"]')).toBeNull()
  })

  it('shows no table when the rows disagree about the currency', () => {
    const page = fixedPage({
      prices: [
        { days: 1, anglers: 2, guidePriceCents: 125000, currency: 'NZD' },
        { days: 1, anglers: 1, guidePriceCents: 90000,  currency: 'AUD' },
      ],
    })
    expect(nine(page).querySelector('[data-testid="price-table"]')).toBeNull()
  })
})

describe('mobile accordions', () => {
  it('S4 and S8 start collapsed, S5 / S6 / S7 / S9 start open, S3 has no accordion', () => {
    const { container } = render(<OfferBody page={fixedPage()} />)
    const open = (s: string) => container.querySelector(`[data-section="${s}"] [data-open]`)?.getAttribute('data-open')

    expect(open('S4')).toBe('false')
    expect(open('S8')).toBe('false')
    for (const s of ['S5', 'S6', 'S7', 'S9']) expect(open(s)).toBe('true')
    expect(container.querySelector('[data-section="S3"] button')).toBeNull()
  })

  it('the heading button toggles the section', () => {
    const { container } = render(<OfferBody page={fixedPage()} />)
    const s4 = container.querySelector('[data-section="S4"]')!
    const button = s4.querySelector('button[aria-expanded]')!

    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(s4.querySelector('[data-open]')!.getAttribute('data-open')).toBe('true')
  })
})
