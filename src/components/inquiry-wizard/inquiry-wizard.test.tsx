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

const PAGE_ID = '550e8400-e29b-41d4-a716-446655440000'

const FIXED_PAGE: InquiryWizardPage = {
  experiencePageId:   PAGE_ID,
  experienceName:     'Seed Backcountry Day',
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
