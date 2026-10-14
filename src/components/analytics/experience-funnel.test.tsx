// @vitest-environment jsdom
/**
 * FA-1.60 — the experience-page funnel in GA4.
 *
 * What is proven here:
 *   • every funnel event carries page_version + page_slug and goes to GA4 (send_to);
 *   • each event fires once per page load — re-renders, a section seen twice, the v1 modal
 *     closed and opened again do not send it again (the guard's red proof is
 *     `createOnceGuard` itself: without it the "once" assertions below fail);
 *   • the v1 widget's Ads conversion is the same call with the same parameters as before,
 *     on an experience page and off one; only the GA4 event gains page_version / page_slug;
 *   • the v1 POST body carries page_version / page_slug inside the provider and not outside.
 *
 * The v2 form's side of the funnel is in ../inquiry-wizard/inquiry-wizard.test.tsx.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ExperienceFunnelProvider, createOnceGuard } from './experience-funnel'
import { InquiryWidget } from '@/components/inquiry/InquiryWidget'

type GtagCall = [command: string, action: string, params: Record<string, unknown>]

let gtag: ReturnType<typeof vi.fn>
let fetchMock: ReturnType<typeof vi.fn>

/** IntersectionObserver stand-in: the test decides what is on screen. */
let observers: { callback: IntersectionObserverCallback; targets: Element[] }[] = []

class FakeIntersectionObserver {
  private readonly entry: { callback: IntersectionObserverCallback; targets: Element[] }
  constructor(callback: IntersectionObserverCallback) {
    this.entry = { callback, targets: [] }
    observers.push(this.entry)
  }
  observe(target: Element) { this.entry.targets.push(target) }
  unobserve(target: Element) { this.entry.targets = this.entry.targets.filter(t => t !== target) }
  disconnect() { this.entry.targets = [] }
}

/** Puts `el` `ratio` on screen, in a 1000 px viewport. */
function show(el: Element, ratio: number) {
  for (const o of observers) {
    if (!o.targets.includes(el)) continue
    const entry = {
      target:            el,
      isIntersecting:    ratio > 0,
      intersectionRatio: ratio,
      intersectionRect:  { height: 300 * ratio },
      rootBounds:        { height: 1000 },
    } as unknown as IntersectionObserverEntry
    act(() => o.callback([entry], {} as IntersectionObserver))
  }
}

const events = () => (gtag.mock.calls as GtagCall[]).map(([, action]) => action)
const callsOf = (action: string) => (gtag.mock.calls as GtagCall[]).filter(([, a]) => a === action).map(([, , p]) => p)

beforeEach(() => {
  observers = []
  gtag = vi.fn()
  vi.stubGlobal('gtag', gtag)
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'inq-1', status: 'new' }) })
  vi.stubGlobal('fetch', fetchMock)
  // jsdom has no sendBeacon; the v1 modal's own web_events (form_open / form_submit) use it.
  Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(() => true), configurable: true })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createOnceGuard', () => {
  it('fires a key once and ignores it afterwards; other keys are independent', () => {
    const once = createOnceGuard()
    const fire = vi.fn()
    once('a', fire)
    once('a', fire)
    once('b', fire)
    expect(fire).toHaveBeenCalledTimes(2)
  })
})

describe('the provider', () => {
  const PAGE = { send_to: 'G-Z3Y8GMHR4J', page_version: '2', page_slug: 'seed-page' }

  function renderPage() {
    return render(
      <ExperienceFunnelProvider version={2} slug="seed-page" sections={{ pricing: '#price', faq: '#faq', fit: '#missing' }}>
        <section id="price">price</section>
        <section id="faq">faq</section>
      </ExperienceFunnelProvider>,
    )
  }

  it('sends experience_view once per page load, re-renders included', () => {
    const view = renderPage()
    view.rerender(
      <ExperienceFunnelProvider version={2} slug="seed-page" sections={{ pricing: '#price' }}>
        <section id="price">price</section>
      </ExperienceFunnelProvider>,
    )
    expect(callsOf('experience_view')).toEqual([PAGE])
  })

  it('sends section_view once per section, only when half of it is on screen', () => {
    renderPage()
    const price = document.getElementById('price')!
    show(price, 0.3)
    expect(callsOf('section_view')).toEqual([])
    show(price, 0.6)
    show(price, 0.9)
    expect(callsOf('section_view')).toEqual([{ ...PAGE, section: 'pricing' }])
  })

  it('counts a section taller than two screens when it fills half the screen', () => {
    renderPage()
    const faq = document.getElementById('faq')!
    // A 3000 px section: 20 % of it is 600 px — more than half of a 1000 px screen.
    for (const o of observers) {
      act(() => o.callback([{
        target: faq, isIntersecting: true, intersectionRatio: 0.2,
        intersectionRect: { height: 600 }, rootBounds: { height: 1000 },
      } as unknown as IntersectionObserverEntry], {} as IntersectionObserver))
    }
    expect(callsOf('section_view')).toEqual([{ ...PAGE, section: 'faq' }])
  })

  it('skips a section that is not on the page', () => {
    renderPage()
    expect(observers.flatMap(o => o.targets).map(t => t.id)).toEqual(['price', 'faq'])
  })
})

describe('the v1 widget', () => {
  const V1_PAGE = { page_version: '1', page_slug: 'brynjar-iceland' }

  function renderWidget({ inFunnel }: { inFunnel: boolean }) {
    const widget = (
      <InquiryWidget
        experiencePageId="550e8400-e29b-41d4-a716-446655440000"
        tripTitle="Brynjar's Rivers"
        currency="EUR"
        country="Iceland"
      />
    )
    return render(inFunnel
      ? <ExperienceFunnelProvider version={1} slug="brynjar-iceland" sections={{}}>{widget}</ExperienceFunnelProvider>
      : widget)
  }

  const open  = () => act(() => { window.dispatchEvent(new CustomEvent('open-inquiry-modal')) })
  const close = () => fireEvent.click(screen.getByLabelText('Close'))

  async function submit() {
    fireEvent.click(screen.getByText(/Discuss dates later/))
    fireEvent.change(screen.getByPlaceholderText('Erik'),            { target: { value: 'Anna' } })
    fireEvent.change(screen.getByPlaceholderText('Andersen'),        { target: { value: 'Angler' } })
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'anna@angler.test' } })
    fireEvent.change(screen.getByDisplayValue('Select duration…'),   { target: { value: '2-3' } })
    fireEvent.submit(screen.getByPlaceholderText('Erik').closest('form')!)
    await waitFor(() => expect(callsOf('SUBMIT_LEAD_FORM')).toHaveLength(1))
    return JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>
  }

  it('sends form_open and the calendar step once, however often the modal is opened', () => {
    renderWidget({ inFunnel: true })
    open()
    close()
    open()
    expect(callsOf('form_open')).toEqual([{ send_to: 'G-Z3Y8GMHR4J', ...V1_PAGE }])
    expect(callsOf('form_step')).toEqual([
      { send_to: 'G-Z3Y8GMHR4J', ...V1_PAGE, step: 'calendar', step_index: 1, total_steps: 2 },
    ])
  })

  it('goes experience_view → form_open → calendar → form → conversion + SUBMIT_LEAD_FORM', async () => {
    renderWidget({ inFunnel: true })
    open()
    const body = await submit()

    expect(events().filter(e => e !== 'form_start')).toEqual([
      'experience_view', 'form_open', 'form_step', 'form_step', 'conversion', 'SUBMIT_LEAD_FORM',
    ])
    expect(callsOf('form_step')[1]).toEqual({ send_to: 'G-Z3Y8GMHR4J', ...V1_PAGE, step: 'form', step_index: 2, total_steps: 2 })
    // Iceland → Nordic, "2-3" = 2500, one angler = × ½ — the formula is untouched.
    expect(callsOf('conversion')).toEqual([{ send_to: 'AW-18171634204/yydcCKmuoe0cEJzE9NhD', value: 1250, currency: 'PLN' }])
    expect(callsOf('SUBMIT_LEAD_FORM')).toEqual([{
      send_to: 'G-Z3Y8GMHR4J', value: 1250, currency: 'PLN', trip_name: "Brynjar's Rivers", ...V1_PAGE,
    }])
    expect(body).toMatchObject({ page_version: 1, page_slug: 'brynjar-iceland' })
  })

  it('outside an experience page: no funnel events, the same conversion, nothing new in the body', async () => {
    renderWidget({ inFunnel: false })
    open()
    const body = await submit()

    expect(events().filter(e => e !== 'form_start')).toEqual(['conversion', 'SUBMIT_LEAD_FORM'])
    expect(callsOf('conversion')).toEqual([{ send_to: 'AW-18171634204/yydcCKmuoe0cEJzE9NhD', value: 1250, currency: 'PLN' }])
    expect(callsOf('SUBMIT_LEAD_FORM')).toEqual([{ send_to: 'G-Z3Y8GMHR4J', value: 1250, currency: 'PLN', trip_name: "Brynjar's Rivers" }])
    expect(body).not.toHaveProperty('page_version')
    expect(body).not.toHaveProperty('page_slug')
  })
})
