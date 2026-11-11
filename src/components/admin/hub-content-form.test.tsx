// @vitest-environment jsdom
/**
 * FA-1.85 — the hub editor form. The server re-checks everything (hub-actions.test.ts); what is
 * pinned here is what the author sees: the meta counters turn red past 60 / 160 and switch saving
 * off, a best month cannot be picked outside the season, the quote and the contact are all-or-none
 * with the missing field named, FAQ entries can be added, reordered and removed, and the server's
 * message is shown as it is.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }))

vi.mock('@/actions/hubs', () => ({ saveHubContent: h.save }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: h.refresh }) }))

import { HubContentForm, type HubContentFormValues } from './hub-content-form'

const values: HubContentFormValues = {
  h1: 'Norway Fly Fishing Trips',
  intro: 'Guides in Norway.',
  metaTitle: 'Norway Fly Fishing Trips',
  metaDescription: 'Fly fishing guides in Norway.',
  seasonMonths: [5, 6, 7],
  peakMonths: [6],
  seasonNote: '',
  species: ['Brown trout'],
  faq: [
    { question: 'First?', answer: 'One.' },
    { question: 'Second?', answer: 'Two.' },
  ],
  heroQuoteText: '', heroQuoteAuthor: '', heroQuoteCountry: '',
  proofNote: '',
  contactName: '', contactEmail: '', contactWhatsapp: '',
}

const renderForm = (over: Partial<HubContentFormValues> = {}) =>
  render(<HubContentForm slug="norway" initialValues={{ ...values, ...over }} />)

const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

const saveButton = () => screen.getByRole('button', { name: /Save changes|Saving/ }) as HTMLButtonElement
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

beforeEach(() => { h.save.mockReset(); h.refresh.mockReset() })
afterEach(cleanup)

describe('meta counters', () => {
  it('meta title: 60 is fine; 61 turns the counter red and switches saving off', () => {
    renderForm()
    type(/Meta title/i, 'x'.repeat(60))
    expect(document.getElementById('meta-title-count')?.dataset.over).toBe('false')
    expect(saveButton().disabled).toBe(false)

    type(/Meta title/i, 'x'.repeat(61))
    expect(document.getElementById('meta-title-count')?.dataset.over).toBe('true')
    expect(document.getElementById('meta-title-count')?.textContent).toContain('61/60')
    expect(saveButton().disabled).toBe(true)
    expect(screen.getByTestId('blocked-reason').textContent).toMatch(/Meta title is too long/)

    fireEvent.click(saveButton())
    expect(h.save).not.toHaveBeenCalled()
  })

  it('meta description: 160 is fine (the blog stops at 155); 161 switches saving off', () => {
    renderForm()
    type(/Meta description/i, 'y'.repeat(160))
    expect(document.getElementById('meta-description-count')?.dataset.over).toBe('false')
    expect(saveButton().disabled).toBe(false)

    type(/Meta description/i, 'y'.repeat(161))
    expect(document.getElementById('meta-description-count')?.dataset.over).toBe('true')
    expect(saveButton().disabled).toBe(true)
  })

  it('a blank required field switches saving off', () => {
    renderForm()
    type(/^Intro/i, '')
    expect(saveButton().disabled).toBe(true)
    expect(screen.getByTestId('blocked-reason').textContent).toMatch(/Intro cannot be blank/)
  })
})

describe('season months', () => {
  it('shows the saved months as pressed', () => {
    renderForm()
    expect(pressed('Season: May')).toBe('true')
    expect(pressed('Season: Sep')).toBe('false')
    expect(pressed('Best months: Jun')).toBe('true')
  })

  it('a best month outside the season cannot be picked; leaving a month out of the season takes it out of the best months', () => {
    renderForm()
    expect((screen.getByRole('button', { name: 'Best months: Sep' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Season: Sep' }))
    expect((screen.getByRole('button', { name: 'Best months: Sep' }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Season: Jun' }))
    expect(pressed('Season: Jun')).toBe('false')
    expect(pressed('Best months: Jun')).toBe('false')
    expect(saveButton().disabled).toBe(false)
  })
})

describe('all-or-none groups', () => {
  it('a quote without its author switches saving off and names the missing field', () => {
    renderForm()
    type(/^Quote$/i, 'Great days.')
    type(/Author’s country/i, 'New Zealand')
    expect(saveButton().disabled).toBe(true)
    expect(screen.getByTestId('blocked-reason').textContent).toMatch(/the author is missing/)

    type(/^Author$/i, 'A. Angler')
    expect(saveButton().disabled).toBe(false)
  })

  it('a contact needs name, e-mail and WhatsApp; a malformed e-mail is refused', () => {
    renderForm()
    type(/^Name$/i, 'Krzysztof')
    expect(saveButton().disabled).toBe(true)
    type(/E-mail/i, 'krzysztof')
    type(/WhatsApp number/i, '+48 123 456 789')
    expect(screen.getByTestId('blocked-reason').textContent).toMatch(/e-mail address does not look right/)
    type(/E-mail/i, 'k@example.com')
    expect(saveButton().disabled).toBe(false)
  })
})

describe('FAQ entries', () => {
  it('can be added, moved and removed; an entry with no answer blocks saving', () => {
    renderForm()
    expect(screen.getByLabelText('Question 1')).toHaveProperty('value', 'First?')

    fireEvent.click(screen.getByRole('button', { name: 'Move question 1 down' }))
    expect(screen.getByLabelText('Question 1')).toHaveProperty('value', 'Second?')
    expect(screen.getByLabelText('Question 2')).toHaveProperty('value', 'First?')

    fireEvent.click(screen.getByRole('button', { name: 'Remove question 1' }))
    expect(screen.queryByLabelText('Question 2')).toBeNull()
    expect(screen.getByLabelText('Question 1')).toHaveProperty('value', 'First?')

    fireEvent.click(screen.getByRole('button', { name: /Add a question/ }))
    expect(screen.getByTestId('faq-entry-1')).toBeTruthy()
    expect(saveButton().disabled).toBe(true) // the new entry is empty
    type('Question 2', 'Third?')
    type('Answer 2', 'Three.')
    expect(saveButton().disabled).toBe(false)
  })

  it('stops at 12 entries', () => {
    renderForm({ faq: Array.from({ length: 12 }, (_, i) => ({ question: `Q${i}?`, answer: 'A.' })) })
    expect((screen.getByRole('button', { name: /Add a question/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('saving', () => {
  it('sends the slug and the payload, with species taken one per line', async () => {
    h.save.mockResolvedValue({ success: true, slug: 'norway', changed: true })
    renderForm()
    type(/^Species/i, 'Brown trout\n\n  Arctic char  \n')
    fireEvent.click(saveButton())

    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1))
    const [slug, payload] = h.save.mock.calls[0]
    expect(slug).toBe('norway')
    expect(payload).toMatchObject({
      h1: 'Norway Fly Fishing Trips', seasonMonths: [5, 6, 7], peakMonths: [6],
      species: ['Brown trout', 'Arctic char'],
      faq: [{ question: 'First?', answer: 'One.' }, { question: 'Second?', answer: 'Two.' }],
    })
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Saved/))
    expect(h.refresh).toHaveBeenCalled()
  })

  it('shows the server’s refusal as it is, and keeps the form', async () => {
    h.save.mockResolvedValue({ success: false, error: 'The hub could not be saved. Try again.' })
    renderForm()
    fireEvent.click(saveButton())
    await waitFor(() => expect(screen.getByTestId('form-error').textContent).toBe('The hub could not be saved. Try again.'))
    expect(screen.getByLabelText(/Headline/)).toHaveProperty('value', 'Norway Fly Fishing Trips')
  })

  it('says so when nothing changed', async () => {
    h.save.mockResolvedValue({ success: true, slug: 'norway', changed: false })
    renderForm()
    fireEvent.click(saveButton())
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Nothing was changed/))
  })
})
