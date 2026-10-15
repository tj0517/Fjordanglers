// @vitest-environment jsdom
/**
 * FA-1.61 — the v1 inquiry modal sends the angler to the first invalid field.
 *
 * Before this, "Send" with a required field empty coloured the field red and nothing else:
 * when the field sat above the visible part of the modal's scroll area, the click looked dead
 * (5 tries in the 15.10 prod test). What is proven here, in the order the fields are drawn:
 *   • the first invalid field is scrolled to (`block: 'center'`) and takes focus;
 *   • it, and only the invalid ones after a first attempt, carry `aria-invalid="true"`;
 *   • motion respects `prefers-reduced-motion`;
 *   • nothing is sent while the form is invalid.
 * jsdom has no layout, so "scrolled into view" is the call being made on the right element;
 * the pixels are checked in the browser (`.fa-proofs/fa-1.61/scroll-after.log`).
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent, act, within } from '@testing-library/react'
import { InquiryWidget } from './InquiryWidget'

let fetchMock: ReturnType<typeof vi.fn>
let scrollIntoView: ReturnType<typeof vi.fn<Element['scrollIntoView']>>

function stubMotionPreference(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
    media:   query,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    onchange: null, dispatchEvent: () => false,
  }))
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'inq-1' }) })
  vi.stubGlobal('fetch', fetchMock)
  scrollIntoView = vi.fn<Element['scrollIntoView']>()
  Element.prototype.scrollIntoView = scrollIntoView
  stubMotionPreference(false)
  // jsdom has no sendBeacon; the modal's own web_events (form_open / form_submit) use it.
  Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(() => true), configurable: true })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  // jsdom ships no scrollIntoView; leave the prototype as it was found.
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

const firstName  = () => screen.getByPlaceholderText('Erik')
const lastName   = () => screen.getByPlaceholderText('Andersen')
const email      = () => screen.getByPlaceholderText('you@example.com')
/** Found by its placeholder option, not its displayed value, which changes as the form is filled. */
const tripLength = () => {
  const select = screen.getAllByRole('combobox').find(el => within(el).queryByText('Select duration…') != null)
  if (select == null) throw new Error('trip length select not found')
  return select
}

/** Opens the modal on its details step and fills the fields named in `values`. */
function openDetails(values: { first?: string; last?: string; email?: string; length?: string } = {}) {
  render(
    <InquiryWidget
      experiencePageId="550e8400-e29b-41d4-a716-446655440000"
      tripTitle="Brynjar's Rivers"
      currency="EUR"
      country="Iceland"
    />,
  )
  act(() => { window.dispatchEvent(new CustomEvent('open-inquiry-modal')) })
  fireEvent.click(screen.getByText(/Discuss dates later/))
  if (values.first  != null) fireEvent.change(firstName(),  { target: { value: values.first } })
  if (values.last   != null) fireEvent.change(lastName(),   { target: { value: values.last } })
  if (values.email  != null) fireEvent.change(email(),      { target: { value: values.email } })
  if (values.length != null) fireEvent.change(tripLength(), { target: { value: values.length } })
}

const send = () => fireEvent.click(screen.getByRole('button', { name: 'Send' }))

/** The element each `scrollIntoView` call was made on. */
const scrolledElements = () => scrollIntoView.mock.contexts as Element[]

const FILLED = { first: 'Anna', last: 'Angler', email: 'anna@angler.test', length: '2-3' }

describe('v1 modal — Send with a required field missing (FA-1.61)', () => {
  it('last name empty: scrolls to it, focuses it, marks it aria-invalid — and only it', () => {
    openDetails({ ...FILLED, last: '' })
    send()

    expect(scrolledElements()).toEqual([lastName()])
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(document.activeElement).toBe(lastName())
    expect(lastName().getAttribute('aria-invalid')).toBe('true')
    expect(firstName().getAttribute('aria-invalid')).toBe('false')
    expect(email().getAttribute('aria-invalid')).toBe('false')
    expect(tripLength().getAttribute('aria-invalid')).toBe('false')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('goes to the first invalid field in display order: first name before last name before e-mail', () => {
    openDetails()
    send()

    expect(scrolledElements()).toEqual([firstName()])
    expect(document.activeElement).toBe(firstName())
    // Every empty required field is flagged, though only the first takes focus.
    for (const field of [firstName(), lastName(), email(), tripLength()]) {
      expect(field.getAttribute('aria-invalid')).toBe('true')
    }
  })

  it('skips the valid fields: only e-mail wrong → e-mail; only trip length missing → trip length', () => {
    openDetails({ ...FILLED, email: 'not-an-address' })
    send()
    expect(document.activeElement).toBe(email())
    expect(scrolledElements()).toEqual([email()])

    cleanup()
    scrollIntoView.mockClear()
    openDetails({ ...FILLED, length: '' })
    send()
    expect(document.activeElement).toBe(tripLength())
    expect(scrolledElements()).toEqual([tripLength()])
  })

  it('does it again on every failed attempt, not only the first', () => {
    openDetails({ ...FILLED, last: '' })
    send()
    firstName().focus()
    send()

    expect(scrollIntoView).toHaveBeenCalledTimes(2)
    expect(document.activeElement).toBe(lastName())
  })

  it('uses an instant jump when the visitor prefers reduced motion', () => {
    stubMotionPreference(true)
    openDetails({ ...FILLED, last: '' })
    send()

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' })
    expect(document.activeElement).toBe(lastName())
  })

  it('flags nothing and scrolls nowhere before the first attempt', () => {
    openDetails()
    for (const field of [firstName(), lastName(), email(), tripLength()]) {
      expect(field.getAttribute('aria-invalid')).toBe('false')
    }
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('a complete form sends and does not scroll', async () => {
    openDetails(FILLED)
    send()
    await screen.findByText('Message sent!')

    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
