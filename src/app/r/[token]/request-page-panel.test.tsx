// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

/**
 * FA-M.04 — the answer panel in the browser: what is sent and how each server outcome is shown.
 * The server action is mocked; the server-side checks are in the request-page integration test.
 */

const submitRequestAnswer = vi.fn()
vi.mock('./actions', () => ({
  submitRequestAnswer: (t: string, i: unknown) => submitRequestAnswer(t, i),
  markRequestOpened: async () => undefined,
}))

import { RequestPanel } from './RequestPanel'

const TOKEN = 'A'.repeat(43)
const panel = () => render(<RequestPanel token={TOKEN} earliestAltDate="2027-06-10" initialAnswer={null} />)

beforeEach(() => submitRequestAnswer.mockReset())
afterEach(cleanup)

describe('RequestPanel', () => {
  it('Accept sends { answer: accepted } with one tap and shows the confirmation', async () => {
    submitRequestAnswer.mockResolvedValue({ kind: 'saved', answered: { answer: 'accepted', altDates: [], note: null, answeredAt: 'x' } })
    panel()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await screen.findByText('You accepted this trip')
    expect(submitRequestAnswer).toHaveBeenCalledWith(TOKEN, { answer: 'accepted' })
  })

  it('Decline sends the optional reason', async () => {
    submitRequestAnswer.mockResolvedValue({ kind: 'saved', answered: { answer: 'declined', altDates: [], note: 'Booked', answeredAt: 'x' } })
    panel()
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Booked' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send decline' }))
    await screen.findByText('You declined this trip')
    expect(submitRequestAnswer).toHaveBeenCalledWith(TOKEN, { answer: 'declined', note: 'Booked' })
  })

  it('Other dates: days before the earliest are disabled, a 4th day cannot be picked, 1–3 are sent', async () => {
    submitRequestAnswer.mockResolvedValue({ kind: 'saved', answered: { answer: 'other_dates', altDates: ['2027-06-10', '2027-06-11', '2027-06-12'], note: null, answeredAt: 'x' } })
    panel()
    fireEvent.click(screen.getByRole('button', { name: 'Other dates' }))
    expect((screen.getByRole('button', { name: 'Pick a date' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '2027-06-09' }) as HTMLButtonElement).disabled).toBe(true)
    for (const d of ['2027-06-10', '2027-06-11', '2027-06-12']) fireEvent.click(screen.getByRole('button', { name: d }))
    expect((screen.getByRole('button', { name: '2027-06-13' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Send 3 dates' }))
    await screen.findByText('You proposed other dates')
    expect(submitRequestAnswer).toHaveBeenCalledWith(TOKEN, { answer: 'other_dates', altDates: ['2027-06-10', '2027-06-11', '2027-06-12'] })
  })

  it('each refusal from the server gets a clear message', async () => {
    const cases: Array<[object, RegExp]> = [
      [{ kind: 'date_not_in_future' }, /Pick dates from/],
      [{ kind: 'invalid' }, /Pick 1–3 dates/],
      [{ kind: 'error' }, /Something went wrong/],
    ]
    for (const [outcome, message] of cases) {
      submitRequestAnswer.mockResolvedValueOnce(outcome)
      panel()
      fireEvent.click(screen.getByRole('button', { name: 'Other dates' }))
      fireEvent.click(screen.getByRole('button', { name: '2027-06-10' }))
      fireEvent.click(screen.getByRole('button', { name: 'Send 1 date' }))
      await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(message))
      cleanup()
    }
  })

  it('already answered: shows the stored answer, not the new one', async () => {
    submitRequestAnswer.mockResolvedValue({ kind: 'already_answered', answered: { answer: 'accepted', altDates: [], note: null, answeredAt: 'x' } })
    panel()
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send decline' }))
    await screen.findByText('This request was already answered:')
    expect(screen.getByText('You accepted this trip')).toBeTruthy()
  })

  it('a link refused while the page was open switches to the expired notice', async () => {
    submitRequestAnswer.mockResolvedValue({ kind: 'expired' })
    panel()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await screen.findByText('This link has expired')
  })
})
