// @vitest-environment jsdom
/**
 * FA-1.55 — the three-step inquiry form.
 *
 * What is proven here, in the browser the form actually runs in:
 *   • the answers survive the step changes, in both directions;
 *   • a step cannot be left while something required is missing;
 *   • the POST body is the one the API expects — brief included, trap field included;
 *   • `sessionStorage` keeps the answers between steps and is wiped on success, so no e-mail
 *     or phone number is left in the browser;
 *   • a storage that throws does not take the form with it.
 *
 * The rules of the state (validation, the brief, the bands) are unit-tested in
 * ../../lib/inquiries/brief.test.ts and in wizard-state's own exports; this file is about what
 * a person clicking through actually gets.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  InquiryInline,
  InquiryWizardProvider,
  type InquiryWizardPage,
} from './inquiry-wizard'
import { storageKey } from './wizard-state'
import { ExperienceFunnelProvider } from '@/components/analytics/experience-funnel'

const PAGE_ID = '550e8400-e29b-41d4-a716-446655440000'

const FIXED_PAGE: InquiryWizardPage = {
  experiencePageId:   PAGE_ID,
  experienceName:     'Seed Backcountry Day',
  country:            'New Zealand',
  responseSlaHours:   24,
  licenseUrl:         'https://fishandgame.example/licence',
  offerMode:          'fixed',
  currency:           'NZD',
  fromTotalCents:     150000,
  priceFromCents:     65000,
  priceToCents:       null,
  minDays:            1,
  maxDays:            3,
  maxAnglersPerGuide: 2,
}

/** A different page id on purpose: the stored answers are per page, and these two differ. */
const CUSTOM_PAGE_ID = '660e8400-e29b-41d4-a716-446655440111'

const CUSTOM_PAGE: InquiryWizardPage = {
  ...FIXED_PAGE,
  experiencePageId: CUSTOM_PAGE_ID,
  offerMode:        'custom',
  currency:         'EUR',
  fromTotalCents:   null,
  priceFromCents:   45050,
  priceToCents:     320000,
  minDays:          3,
  maxDays:          7,
}

let fetchMock: ReturnType<typeof vi.fn>

function renderForm(page: InquiryWizardPage = FIXED_PAGE) {
  return render(
    <InquiryWizardProvider page={page}>
      <InquiryInline />
    </InquiryWizardProvider>,
  )
}

/** Click the radio/pill/checkbox whose visible label contains `text`. */
function choose(text: string | RegExp) {
  fireEvent.click(screen.getByText(text))
}

function fill(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

/** Everything step 1 needs, with a flexible month: tap next month's tile. */
function completeStepOne() {
  const now  = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  const month = next.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
  const year  = String(next.getUTCFullYear())
  const tile  = [...screen.getAllByText(month)].find(el => el.parentElement?.textContent === `${month}${year}`)
  if (tile == null) throw new Error(`no month tile for ${month} ${year}`)
  fireEvent.click(tile)
}

/** `YYYY-MM` of next month — what completeStepOne() stores. */
function nextMonthValue(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 7)
}

function completeStepTwo() {
  choose(/I cast 15 m/)
  choose(/One big fish/)
  choose(/A few kilometres/)
  choose('Yes')
  const price = screen.queryByText(/I have seen the price/)
  if (price != null) fireEvent.click(price)
}

function completeStepThree() {
  fill(/First name/, 'Anna')
  fill(/Last name/, 'Angler')
  fill(/E-mail/, 'anna@angler.test')
  fireEvent.change(screen.getByLabelText(/Travelling from/), { target: { value: 'PL' } })
}

beforeEach(() => {
  window.sessionStorage.clear()
  fetchMock = vi.fn().mockResolvedValue({
    ok:   true,
    json: async () => ({ id: 'inq-1', status: 'new' }),
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('S14 inline step 1', () => {
  it('shows step 1 on the page, with the SLA from the page', () => {
    renderForm()
    expect(screen.getByTestId('wizard-step-1')).toBeTruthy()
    expect(screen.getByTestId('inquiry-inline').textContent).toContain('within 24 h')
  })

  it('will not open step 2 while the month is missing, and says so', () => {
    renderForm()
    fireEvent.click(screen.getByText(/Continue →/))
    expect(screen.queryByTestId('inquiry-wizard')).toBeNull()
    expect(screen.getByText('Pick a month.')).toBeTruthy()
  })

  it('opens the full-screen wizard at step 2 once step 1 is answered', () => {
    renderForm()
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))

    expect(screen.getByTestId('inquiry-wizard')).toBeTruthy()
    expect(screen.getByTestId('wizard-step-2')).toBeTruthy()
    expect(screen.getByTestId('wizard-progress').textContent).toBe('Step 2 of 3')
  })
})

describe('moving between the steps', () => {
  it('keeps the answers when going back from step 2 to step 1', () => {
    renderForm()
    // Three anglers and one companion, then forward and back.
    fireEvent.click(screen.getByLabelText('One more anglers'))
    fireEvent.click(screen.getByLabelText('One more non-anglers'))
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))

    fireEvent.click(screen.getByText('← Back'))
    expect(screen.getByTestId('wizard-progress').textContent).toBe('Step 1 of 3')
    // The dialog's copy of step 1 shows what was entered on the page.
    const dialog = screen.getByTestId('inquiry-wizard')
    // days, anglers, non-anglers — the three ± counters of step 1, in order
    const outputs = [...dialog.querySelectorAll('output')].map(o => o.textContent)
    expect(outputs).toEqual(['1', '3', '1'])
    expect(dialog.querySelector<HTMLInputElement>('input[name="flex-month"]:checked')?.value).toBe(nextMonthValue())
  })

  it('the inline Continue opens again after the overlay was closed on step 2', () => {
    renderForm()
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    expect(screen.getByTestId('wizard-progress').textContent).toBe('Step 2 of 3')

    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByTestId('inquiry-wizard')).toBeNull()

    // The remembered step is 2; Continue must still judge step 1 and open — not validate
    // the unanswered step 2 and do nothing.
    fireEvent.click(screen.getByText(/Continue →/))
    expect(screen.getByTestId('inquiry-wizard')).not.toBeNull()
    expect(screen.getByTestId('wizard-progress').textContent).toBe('Step 2 of 3')
  })

  it('will not leave step 2 until every question is answered', () => {
    renderForm()
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    fireEvent.click(screen.getByTestId('wizard-next'))

    expect(screen.getByTestId('wizard-step-2')).toBeTruthy()
    expect(screen.getByText('Pick the line that fits you best.')).toBeTruthy()
    expect(screen.getByText('Pick what matters most.')).toBeTruthy()
    expect(screen.getByText(/Confirm the price/)).toBeTruthy()
  })

  it('asks a fixed page to confirm the price it shows, and a custom page for a band', () => {
    renderForm()
    expect(screen.queryByText(/I have seen the price — from NZ\$1,500/)).toBeNull()
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    expect(screen.getByText(/I have seen the price — from NZ\$1,500/)).toBeTruthy()

    cleanup()
    renderForm(CUSTOM_PAGE)
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    expect(screen.getByText('under €1,400')).toBeTruthy()
    expect(screen.getByText('over €3,200')).toBeTruthy()
  })
})

describe('the submit', () => {
  async function walkToSend(page: InquiryWizardPage = FIXED_PAGE) {
    renderForm(page)
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    completeStepTwo()
    fireEvent.click(screen.getByTestId('wizard-next'))
    completeStepThree()
    fireEvent.click(screen.getByTestId('wizard-next'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    return JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>
  }

  it('POSTs to the one inquiry endpoint, with the brief and the old fields', async () => {
    const body = await walkToSend()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/inquiries')
    expect(body.experience_page_id).toBe(PAGE_ID)
    expect(body.angler_name).toBe('Anna Angler')
    expect(body.angler_email).toBe('anna@angler.test')
    expect(body.angler_country).toBe('PL')
    expect(body.party_size).toBe(2)
    expect(body.brief).toEqual({
      dates_mode:  'flexible',
      flex_month:  nextMonthValue(),
      days:        1,
      anglers:     2,
      non_anglers: 0,
      skill_level: 3,
      priority:    'trophy',
      fitness:     'mid',
      wading_ok:   true,
      budget_ack:  true,
    })
  })

  it('sends the trap field and an elapsed time, exactly as the v1 widget does', async () => {
    const body = await walkToSend()
    expect(body).toHaveProperty('trip_notes_extra', '')
    expect(typeof body.form_elapsed_ms).toBe('number')
    expect(body.form_elapsed_ms as number).toBeGreaterThanOrEqual(0)
  })

  it('sends a band instead of an acknowledgement on a custom page', async () => {
    renderForm(CUSTOM_PAGE)
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    choose(/I cast 15 m/)
    choose(/One big fish/)
    choose(/A few kilometres/)
    choose('Yes')
    choose('€1,400–€2,300')
    fireEvent.click(screen.getByTestId('wizard-next'))
    completeStepThree()
    fireEvent.click(screen.getByTestId('wizard-next'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { brief: Record<string, unknown> }
    expect(body.brief.budget_band).toBe('EUR:140000-230000')
    expect(body.brief).not.toHaveProperty('budget_ack')
  })

  it('shows the thank-you with the SLA and the licence link, and keeps the link external', async () => {
    await walkToSend()
    const thanks = await screen.findByTestId('inquiry-thank-you')
    expect(thanks.textContent).toContain('24 hours')
    const link = thanks.querySelector('a')
    expect(link?.getAttribute('href')).toBe('https://fishandgame.example/licence')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('offers no licence link when the page stores something that is not an http(s) URL', async () => {
    renderForm({ ...FIXED_PAGE, licenseUrl: 'javascript:alert(1)' })
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    completeStepTwo()
    fireEvent.click(screen.getByTestId('wizard-next'))
    completeStepThree()
    fireEvent.click(screen.getByTestId('wizard-next'))

    const thanks = await screen.findByTestId('inquiry-thank-you')
    expect(thanks.querySelector('a')).toBeNull()
  })

  it('says it failed and does not pretend to have sent, when the server refuses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Invalid input' }) })
    renderForm()
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    completeStepTwo()
    fireEvent.click(screen.getByTestId('wizard-next'))
    completeStepThree()
    fireEvent.click(screen.getByTestId('wizard-next'))

    expect(await screen.findByText(/We could not send that/)).toBeTruthy()
    expect(screen.queryByTestId('inquiry-thank-you')).toBeNull()
  })
})

describe('what the browser is allowed to remember', () => {
  it('keeps the answers in sessionStorage while the form is being filled', () => {
    renderForm()
    completeStepOne()
    const stored = JSON.parse(window.sessionStorage.getItem(storageKey(PAGE_ID)) ?? '{}') as Record<string, unknown>
    expect(stored.flexMonth).toBe(nextMonthValue())
  })

  it('wipes the stored answers on a successful submit — no e-mail or phone left behind', async () => {
    renderForm()
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    completeStepTwo()
    fireEvent.click(screen.getByTestId('wizard-next'))
    completeStepThree()
    fill(/Phone or WhatsApp/, '+48 600 100 200')
    fireEvent.click(screen.getByTestId('wizard-next'))

    await screen.findByTestId('inquiry-thank-you')
    await waitFor(() => expect(window.sessionStorage.getItem(storageKey(PAGE_ID))).toBeNull())
  })

  it('ignores a stored shape from an older form instead of trusting it', () => {
    window.sessionStorage.setItem(storageKey(PAGE_ID), JSON.stringify({
      anglers: 'three', skillLevel: 'expert', email: 'kept@angler.test', bogusKey: 1,
    }))
    renderForm()
    // The bad types fall back to the defaults; the good one is kept.
    // days, anglers, non-anglers — all three back at their defaults
    expect([...screen.getByTestId('inquiry-inline').querySelectorAll('output')].map(o => o.textContent))
      .toEqual(['1', '2', '0'])
  })

  it('still works when sessionStorage throws on every access', () => {
    const throwing = () => { throw new Error('storage disabled') }
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(throwing)
    vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(throwing)

    renderForm()
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    expect(screen.getByTestId('wizard-step-2')).toBeTruthy()
  })
})

// ─── FA-1.60 — the GA4 funnel and the Ads conversion ─────────────────────────

describe('the GA4 funnel (FA-1.60)', () => {
  type GtagCall = [command: string, action: string, params: Record<string, unknown>]
  const V2_PAGE = { page_version: '2', page_slug: 'seed-backcountry-day' }
  const GA4     = 'G-Z3Y8GMHR4J'

  let gtag: ReturnType<typeof vi.fn>
  const events  = () => (gtag.mock.calls as GtagCall[]).map(([, action]) => action)
  const callsOf = (action: string) => (gtag.mock.calls as GtagCall[]).filter(([, a]) => a === action).map(([, , p]) => p)

  beforeEach(() => {
    gtag = vi.fn()
    vi.stubGlobal('gtag', gtag)
  })

  function renderInFunnel() {
    return render(
      <ExperienceFunnelProvider version={2} slug="seed-backcountry-day" sections={{}}>
        <InquiryWizardProvider page={FIXED_PAGE}>
          <InquiryInline />
        </InquiryWizardProvider>
      </ExperienceFunnelProvider>,
    )
  }

  async function send() {
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    completeStepTwo()
    fireEvent.click(screen.getByTestId('wizard-next'))
    completeStepThree()
    fireEvent.click(screen.getByTestId('wizard-next'))
    await waitFor(() => expect(callsOf('SUBMIT_LEAD_FORM')).toHaveLength(1))
    return JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>
  }

  it('goes experience_view → form_open → trip → angler → contact → conversion + SUBMIT_LEAD_FORM', async () => {
    renderInFunnel()
    const body = await send()

    expect(events()).toEqual([
      'experience_view', 'form_open', 'form_step', 'form_step', 'form_step', 'conversion', 'SUBMIT_LEAD_FORM',
    ])
    expect(callsOf('form_open')).toEqual([{ send_to: GA4, ...V2_PAGE }])
    expect(callsOf('form_step')).toEqual([
      { send_to: GA4, ...V2_PAGE, step: 'trip',    step_index: 1, total_steps: 3 },
      { send_to: GA4, ...V2_PAGE, step: 'angler',  step_index: 2, total_steps: 3 },
      { send_to: GA4, ...V2_PAGE, step: 'contact', step_index: 3, total_steps: 3 },
    ])
    // New Zealand, 1 day = 500, two anglers = × 1 — the v1 formula (estimateLeadValue), in PLN.
    expect(callsOf('conversion')).toEqual([{ send_to: 'AW-18171634204/yydcCKmuoe0cEJzE9NhD', value: 500, currency: 'PLN' }])
    expect(callsOf('SUBMIT_LEAD_FORM')).toEqual([{
      send_to: GA4, value: 500, currency: 'PLN', trip_name: 'Seed Backcountry Day', ...V2_PAGE,
    }])
    expect(body).toMatchObject({ page_version: 2, page_slug: 'seed-backcountry-day' })
  })

  it('counts each step once when the visitor goes back, closes and comes again', () => {
    renderInFunnel()
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    fireEvent.click(screen.getByText('← Back'))
    fireEvent.click(screen.getByTestId('wizard-next'))
    fireEvent.click(screen.getByLabelText('Close'))
    fireEvent.click(screen.getByText(/Continue →/))

    expect(callsOf('form_open')).toHaveLength(1)
    expect(callsOf('form_step').map(p => p.step)).toEqual(['trip', 'angler'])
  })

  it('a second submit click while sending does not send a second conversion', async () => {
    renderInFunnel()
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    completeStepTwo()
    fireEvent.click(screen.getByTestId('wizard-next'))
    completeStepThree()
    fireEvent.click(screen.getByTestId('wizard-next'))
    fireEvent.click(screen.getByTestId('wizard-next'))
    await waitFor(() => expect(callsOf('SUBMIT_LEAD_FORM')).toHaveLength(1))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(callsOf('conversion')).toHaveLength(1)
  })

  it('no conversion when the server refuses the inquiry', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'nope' }) })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderInFunnel()
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
    completeStepTwo()
    fireEvent.click(screen.getByTestId('wizard-next'))
    completeStepThree()
    fireEvent.click(screen.getByTestId('wizard-next'))
    await waitFor(() => expect(screen.getByText(/We could not send that/)).toBeTruthy())
    expect(callsOf('conversion')).toEqual([])
    expect(callsOf('SUBMIT_LEAD_FORM')).toEqual([])
  })

  it('outside an experience page: the conversion still fires, no funnel events, nothing new in the body', async () => {
    renderForm()
    const body = await send()
    expect(events()).toEqual(['conversion', 'SUBMIT_LEAD_FORM'])
    expect(body).not.toHaveProperty('page_version')
    expect(body).not.toHaveProperty('page_slug')
  })
})


// ─── FA-1.61 — a failed Next / Send takes the angler to the first invalid question ───

describe('scroll and focus on the first error (FA-1.61)', () => {
  let scrollIntoView: ReturnType<typeof vi.fn<Element['scrollIntoView']>>

  beforeEach(() => {
    scrollIntoView = vi.fn<Element['scrollIntoView']>()
    Element.prototype.scrollIntoView = scrollIntoView
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false, media: query,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
      onchange: null, dispatchEvent: () => false,
    }))
  })

  afterEach(() => {
    // jsdom ships no scrollIntoView; leave the prototype as it was found.
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
  })

  const scrolledElements = () => scrollIntoView.mock.contexts as Element[]

  function openStepTwo() {
    renderForm()
    completeStepOne()
    fireEvent.click(screen.getByText(/Continue →/))
  }

  function openStepThree() {
    openStepTwo()
    completeStepTwo()
    fireEvent.click(screen.getByTestId('wizard-next'))
  }

  /** The fieldset of a step-2 question, by the key its error is filed under. */
  function group(field: string): HTMLFieldSetElement {
    const el = screen.getByTestId('wizard-step-2').querySelector<HTMLFieldSetElement>(`fieldset[data-field="${field}"]`)
    if (el == null) throw new Error(`no group ${field}`)
    return el
  }

  it('step 3, Send with the first name empty: the first-name input is scrolled to and focused', () => {
    openStepThree()
    fill(/E-mail/, 'anna@angler.test')
    fireEvent.change(screen.getByLabelText(/Travelling from/), { target: { value: 'PL' } })
    fireEvent.click(screen.getByTestId('wizard-next'))

    const first = screen.getByLabelText(/First name/)
    expect(scrolledElements()).toEqual([first])
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(document.activeElement).toBe(first)
    expect(first.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText(/Last name/).getAttribute('aria-invalid')).toBe('true')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('step 3: the country select is the target when it is the only thing missing', () => {
    openStepThree()
    completeStepThree()
    fireEvent.change(screen.getByLabelText(/Travelling from/), { target: { value: '' } })
    fireEvent.click(screen.getByTestId('wizard-next'))

    expect(document.activeElement).toBe(screen.getByLabelText(/Travelling from/))
  })

  it('step 3 uses an instant jump when the visitor prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)', media: query,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
      onchange: null, dispatchEvent: () => false,
    }))
    openStepThree()
    fireEvent.click(screen.getByTestId('wizard-next'))

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' })
  })

  it('step 2, Next with nothing picked: the first group is scrolled to, its first radio focused, the group flagged and described by its error', () => {
    openStepTwo()
    fireEvent.click(screen.getByTestId('wizard-next'))

    const skill = group('skillLevel')
    expect(scrolledElements()).toEqual([skill])
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })

    const firstRadio = skill.querySelector<HTMLInputElement>('input[type="radio"]')
    expect(firstRadio).not.toBeNull()
    expect(document.activeElement).toBe(firstRadio)

    expect(skill.getAttribute('aria-invalid')).toBe('true')
    const alert = skill.querySelector('[role="alert"]')
    expect(alert?.textContent).toBe('Pick the line that fits you best.')
    expect(alert?.id).not.toBe('')
    expect(skill.getAttribute('aria-describedby')).toBe(alert?.id)

    // The other unanswered groups carry the same pair, each pointing at its own message.
    const priority = group('priority')
    expect(priority.getAttribute('aria-invalid')).toBe('true')
    expect(priority.getAttribute('aria-describedby')).toBe(priority.querySelector('[role="alert"]')?.id)
    expect(priority.getAttribute('aria-describedby')).not.toBe(skill.getAttribute('aria-describedby'))
  })

  it('step 2: an answered group is neither flagged nor targeted — focus goes to the first one still open', () => {
    openStepTwo()
    choose(/I cast 15 m/)
    choose(/One big fish/)
    fireEvent.click(screen.getByTestId('wizard-next'))

    expect(scrolledElements()).toEqual([group('fitness')])
    expect(document.activeElement).toBe(group('fitness').querySelector('input'))
    expect(group('skillLevel').hasAttribute('aria-invalid')).toBe(false)
    expect(group('skillLevel').hasAttribute('aria-describedby')).toBe(false)
  })

  it('step 2: the price acknowledgement is a checkbox, and that is what takes focus', () => {
    openStepTwo()
    choose(/I cast 15 m/)
    choose(/One big fish/)
    choose(/A few kilometres/)
    choose('Yes')
    fireEvent.click(screen.getByTestId('wizard-next'))

    const price = group('budgetAck')
    expect(scrolledElements()).toEqual([price])
    expect(document.activeElement).toBe(price.querySelector('input[type="checkbox"]'))
    expect(price.getAttribute('aria-invalid')).toBe('true')
  })

  it('step 2: a group taller than the scroll area is aligned to its top, so the question stays readable', () => {
    // jsdom has no layout: say the scroll area is 500 px high with more inside, and the group 600 px.
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500)
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000)
    openStepTwo()
    vi.spyOn(group('skillLevel'), 'getBoundingClientRect').mockReturnValue({ height: 600 } as DOMRect)
    fireEvent.click(screen.getByTestId('wizard-next'))

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    expect(scrolledElements()).toEqual([group('skillLevel')])
    expect(document.activeElement).toBe(group('skillLevel').querySelector('input'))
  })

  it('goes there on every failed attempt, not only the first', () => {
    openStepTwo()
    fireEvent.click(screen.getByTestId('wizard-next'))
    ;(document.activeElement as HTMLElement).blur()
    fireEvent.click(screen.getByTestId('wizard-next'))

    expect(scrollIntoView).toHaveBeenCalledTimes(2)
    expect(document.activeElement).toBe(group('skillLevel').querySelector('input'))
  })

  it('does nothing of the kind when the step is complete', () => {
    openStepTwo()
    completeStepTwo()
    fireEvent.click(screen.getByTestId('wizard-next'))

    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(screen.getByTestId('wizard-step-3')).toBeTruthy()
  })

  it('the inline Continue (S14) is unchanged: it shows the error and moves nothing', () => {
    renderForm()
    const before = document.activeElement
    fireEvent.click(screen.getByText(/Continue →/))

    expect(screen.getByText('Pick a month.')).toBeTruthy()
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(before)
  })
})
