// @vitest-environment jsdom
/**
 * FA-M.13 — the guide panel's calendar preview as components: the status line (ok / failing /
 * disconnected / none, with the last successful sync) and the month grid telling a calendar-busy day
 * from a day the guide blocked by hand.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'

const setAvailability = vi.fn(async () => ({ success: true as const }))
vi.mock('@/actions/availability', () => ({
  setAvailability: (...args: unknown[]) => setAvailability(...(args as [])),
  setOpenSeason: vi.fn(),
}))

import { AvailabilityCalendar } from './availability-calendar'
import { CalendarSyncStatus } from './calendar-sync-status'
import type { CalendarStatus } from '@/lib/calendar/connections'

const NOW = Date.parse('2027-01-05T12:00:00Z')

function conn(over: Partial<CalendarStatus> = {}): CalendarStatus {
  return {
    provider: 'google', host: 'www.googleapis.com', status: 'ok',
    lastSyncedAt: '2027-01-05T10:00:00Z', lastError: null, ...over,
  }
}

afterEach(() => { cleanup(); vi.useRealTimers(); setAvailability.mockClear() })

describe('CalendarSyncStatus', () => {
  it('ok: provider connected and the last sync', () => {
    const { getByTestId } = render(<CalendarSyncStatus connection={conn()} now={NOW} />)
    const el = getByTestId('calendar-sync-status')
    expect(el.dataset.status).toBe('ok')
    expect(el.textContent).toContain('Google Calendar connected')
    expect(el.textContent).toContain('Last sync 2 h ago')
    expect(el.querySelector('time')?.getAttribute('datetime')).toBe('2027-01-05T10:00:00Z')
  })

  it('failing: says so, with the last successful sync as a date once it is old', () => {
    const { getByTestId } = render(
      <CalendarSyncStatus now={NOW}
        connection={conn({ provider: 'apple_ics', status: 'error', lastError: 'timeout', lastSyncedAt: '2027-01-01T08:00:00Z' })} />,
    )
    const el = getByTestId('calendar-sync-status')
    expect(el.dataset.status).toBe('error')
    expect(el.textContent).toContain('Apple Calendar — sync failing')
    expect(el.textContent).toContain('Last successful sync 1 Jan')
  })

  it('disconnected (Google refused access): says so and offers Connect', () => {
    const { getByTestId, getByRole } = render(
      <CalendarSyncStatus now={NOW} manageHref="/dashboard/account#calendar"
        connection={conn({ status: 'disconnected', lastError: 'invalid_grant' })} />,
    )
    expect(getByTestId('calendar-sync-status').dataset.status).toBe('disconnected')
    expect(getByTestId('calendar-sync-status').textContent).toContain('Google Calendar disconnected')
    expect(getByRole('link').textContent).toBe('Connect')
  })

  it('none: no calendar connected', () => {
    const { getByTestId } = render(<CalendarSyncStatus connection={null} now={NOW} />)
    expect(getByTestId('calendar-sync-status').dataset.status).toBe('none')
    expect(getByTestId('calendar-sync-status').textContent).toContain('No calendar connected')
  })
})

describe('AvailabilityCalendar — sources', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2027-01-05T12:00:00')) })

  function cell(container: HTMLElement, date: string) {
    return container.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)!
  }

  it('calendar-busy, manual, both and free days are told apart', () => {
    const { container, getByText } = render(
      <AvailabilityCalendar initialDates={['2027-01-14', '2027-01-20']} calendarDates={['2027-01-12', '2027-01-20']} />,
    )
    expect(cell(container, '2027-01-12').dataset.source).toBe('calendar')
    expect(cell(container, '2027-01-14').dataset.source).toBe('manual')
    expect(cell(container, '2027-01-20').dataset.source).toBe('calendar')   // busy in both: shown as calendar
    expect(cell(container, '2027-01-13').dataset.source).toBeUndefined()
    expect(cell(container, '2027-01-12').getAttribute('aria-label')).toBe('12 — busy in your calendar')
    expect(cell(container, '2027-01-14').getAttribute('aria-label')).toBe('14 — blocked by you')
    expect(getByText('Busy — from your calendar')).toBeTruthy()
    expect(getByText('Blocked here by you')).toBeTruthy()
    expect(getByText('3 days blocked')).toBeTruthy()
  })

  it('a calendar-busy day explains itself and writes nothing; a free day still blocks by hand', () => {
    const { container, getByText } = render(<AvailabilityCalendar initialDates={[]} calendarDates={['2027-01-12']} />)
    fireEvent.click(cell(container, '2027-01-12'))
    expect(setAvailability).not.toHaveBeenCalled()
    expect(getByText(/busy in your connected calendar/)).toBeTruthy()
    fireEvent.click(cell(container, '2027-01-13'))
    expect(setAvailability).toHaveBeenCalledWith(['2027-01-13'], true)
    expect(cell(container, '2027-01-13').dataset.source).toBe('manual')
  })
})
