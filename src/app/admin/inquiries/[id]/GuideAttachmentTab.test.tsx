// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react'

/**
 * FA-M.05 — the Guide tab of the inquiry card: request timeline (sent / opened / answer, other dates
 * with the guide's dates and note, history of earlier requests) and "Send request" → "Open WhatsApp"
 * + copy link shown once, or the no-number error. Server actions are mocked; the server side is in
 * src/actions/__tests__/send-guide-request.test.ts.
 */

const sendGuideRequest = vi.fn()
const withdrawGuideRequestAction = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
const acceptGuideRequestOnBehalfAction = vi.fn()
const unassignGuideWithoutRequestAction = vi.fn()
vi.mock('@/actions/guide-requests', () => ({
  sendGuideRequest: (i: string, g: string) => sendGuideRequest(i, g),
  withdrawGuideRequestAction: (i: string, r: string) => withdrawGuideRequestAction(i, r),
  acceptGuideRequestOnBehalfAction: (i: string, r: string) => acceptGuideRequestOnBehalfAction(i, r),
  unassignGuideWithoutRequestAction: (i: string) => unassignGuideWithoutRequestAction(i),
}))
vi.mock('@/actions/inquiries', () => ({ setExternalOffer: vi.fn() }))
vi.mock('@/actions/calendar', () => ({ issueCalendarConnectLink: vi.fn() }))

import { GuideAttachmentTab, type GuideWithCalendar } from './GuideAttachmentTab'
import type { InquiryGuideRequest } from '@/lib/guide-requests/requests'

const INQ = '11111111-1111-4111-8111-111111111111'
const GUIDE: GuideWithCalendar = {
  id: '22222222-2222-4222-8222-222222222222', full_name: 'Tama Ngata', avatar_url: null, country: 'New Zealand',
  blockedDates: [], calendarDates: [], manualDates: [], calendar: null,
}
const FUTURE = '2099-01-01T00:00:00Z'

const OTHER_DATES: InquiryGuideRequest = {
  requestId: 'r-2', guideId: GUIDE.id, guideName: 'Tama Ngata', channel: 'whatsapp',
  sentAt: '2026-11-22T09:00:00Z', expiresAt: FUTURE, expired: false, firstOpenedAt: '2026-11-22T10:15:00Z',
  answeredAt: '2026-11-22T11:00:00Z', answer: 'other_dates', altDates: ['2027-01-20', '2027-01-21'],
  note: 'River is high that week', withdrawnAt: null,
}
const EARLIER_DECLINED: InquiryGuideRequest = {
  requestId: 'r-1', guideId: 'g-old', guideName: 'Old Guide', channel: 'whatsapp',
  sentAt: '2026-11-20T09:00:00Z', expiresAt: FUTURE, expired: false, firstOpenedAt: '2026-11-20T09:30:00Z',
  answeredAt: '2026-11-20T12:00:00Z', answer: 'declined', altDates: [], note: 'Fully booked', withdrawnAt: null,
}

function tab(props: Partial<Parameters<typeof GuideAttachmentTab>[0]> = {}) {
  return render(
    <GuideAttachmentTab
      inquiryId={INQ}
      currentAssignedGuideId={null}
      guides={[GUIDE]}
      requestedDates={[]}
      tripCountry="New Zealand"
      guideAcceptance={null}
      guideDeclineReason={null}
      externalOfferSent={false}
      requests={[]}
      {...props}
    />,
  )
}

beforeEach(() => {
  sendGuideRequest.mockReset()
  withdrawGuideRequestAction.mockReset()
  refresh.mockReset()
})
afterEach(cleanup)

describe('request timeline', () => {
  it('shows sent / opened / other dates with the guide’s dates and note, and the earlier request as history', () => {
    tab({ currentAssignedGuideId: GUIDE.id, guideAcceptance: 'other_dates', requests: [OTHER_DATES, EARLIER_DECLINED] })

    const cards = screen.getAllByTestId('guide-request')
    expect(cards).toHaveLength(2)

    const latest = within(cards[0])
    expect(latest.getByText('Tama Ngata')).toBeTruthy()
    expect(latest.getByText('Sent via WhatsApp')).toBeTruthy()
    expect(latest.getByText('Opened')).toBeTruthy()
    expect(latest.getByText('Proposed other dates')).toBeTruthy()
    const dates = within(latest.getByRole('list', { name: "Guide's proposed dates" }))
    expect(dates.getAllByRole('listitem').map(li => li.textContent)).toEqual(['Wed, 20 Jan 2027', 'Thu, 21 Jan 2027'])
    expect(latest.getByTestId('guide-note').textContent).toBe('“River is high that week”')

    expect(screen.getByText('Earlier requests (1)')).toBeTruthy()
    const earlier = within(cards[1])
    expect(earlier.getByText('Old Guide')).toBeTruthy()
    expect(earlier.getByText('Declined — “Fully booked”')).toBeTruthy()

    // The guide card shows the other-dates badge for the assigned guide.
    expect(screen.getByText('↻ Other dates proposed')).toBeTruthy()
  })

  it('an unopened, unanswered request shows "Not opened yet" and "Waiting for an answer"; a withdrawn one shows Withdrawn and no button', () => {
    const waiting: InquiryGuideRequest = { ...OTHER_DATES, requestId: 'r-3', firstOpenedAt: null, answeredAt: null, answer: null, altDates: [], note: null }
    const withdrawn: InquiryGuideRequest = { ...waiting, requestId: 'r-4', withdrawnAt: '2026-11-21T08:00:00Z' }
    tab({ requests: [waiting, withdrawn] })
    const [a, b] = screen.getAllByTestId('guide-request')
    expect(within(a).getByText('Not opened yet')).toBeTruthy()
    expect(within(a).getByText('Waiting for an answer')).toBeTruthy()
    expect(within(a).getByRole('button', { name: 'Withdraw' })).toBeTruthy()
    expect(within(b).getByText('Withdrawn')).toBeTruthy()
    expect(within(b).queryByRole('button', { name: 'Withdraw' })).toBeNull()
  })

  it('no requests → empty state', () => {
    tab()
    expect(screen.getByText('No guide request sent yet.')).toBeTruthy()
  })
})

describe('Send request', () => {
  it('shows "Open WhatsApp" with the wa.me link and the plain link once the request is created', async () => {
    const waUrl = 'https://wa.me/64211234567?text=Hi%20Tama'
    const link = `https://fa.test/r/${'A'.repeat(43)}`
    sendGuideRequest.mockResolvedValue({ success: true, waUrl, link, warning: null })
    tab()
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))

    const open = await screen.findByRole('link', { name: 'Open WhatsApp' })
    expect(open.getAttribute('href')).toBe(waUrl)
    expect(open.getAttribute('target')).toBe('_blank')
    expect(open.getAttribute('rel')).toContain('noopener')
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy()
    expect(screen.getByText(link)).toBeTruthy()
    expect(sendGuideRequest).toHaveBeenCalledWith(INQ, GUIDE.id)
    expect(refresh).toHaveBeenCalled()
    expect(screen.queryByTestId('previous-link-warning')).toBeNull()
  })

  it('D5: the previous link could not be withdrawn → a visible warning next to Open WhatsApp', async () => {
    sendGuideRequest.mockResolvedValue({
      success: true, waUrl: 'https://wa.me/64211234567?text=x', link: `https://fa.test/r/${'B'.repeat(43)}`,
      warning: 'Previous link still active — withdraw it manually.',
    })
    tab()
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    const warning = await screen.findByTestId('previous-link-warning')
    expect(warning.textContent).toContain('Previous link still active — withdraw it manually.')
    expect(warning.getAttribute('role')).toBe('alert')
    expect(screen.getByRole('link', { name: 'Open WhatsApp' })).toBeTruthy()
  })

  it('no WhatsApp number → the error in red, no WhatsApp button', async () => {
    sendGuideRequest.mockResolvedValue({ success: false, error: 'This guide has no WhatsApp number. Add it on the guide’s edit page first.' })
    tab()
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('no WhatsApp number')
    expect(alert.className).toContain('text-red-600')
    expect(screen.queryByRole('link', { name: 'Open WhatsApp' })).toBeNull()
  })
})

describe('legacy assign replaced (D1, D3)', () => {
  it('no "Link silently" / "Assign & notify" anywhere', () => {
    tab({ currentAssignedGuideId: GUIDE.id })
    expect(screen.queryByRole('button', { name: /Link silently|Assign & notify/ })).toBeNull()
  })

  it('"Unassign" shows only for a guide attached without an open request, and calls the D3 action', async () => {
    unassignGuideWithoutRequestAction.mockResolvedValue({ success: true })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    tab({ currentAssignedGuideId: GUIDE.id, guideAcceptance: 'accepted', requests: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Unassign' }))
    await vi.waitFor(() => expect(unassignGuideWithoutRequestAction).toHaveBeenCalledWith(INQ))
    cleanup()

    const open: InquiryGuideRequest = { ...OTHER_DATES, requestId: 'r-9', answer: null, answeredAt: null, altDates: [], note: null }
    tab({ currentAssignedGuideId: GUIDE.id, requests: [open] })
    expect(screen.queryByRole('button', { name: 'Unassign' })).toBeNull()
  })

  it('"Mark accepted" on an open unanswered request calls the D1 action; not shown once answered', async () => {
    acceptGuideRequestOnBehalfAction.mockResolvedValue({ success: true })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const open: InquiryGuideRequest = { ...OTHER_DATES, requestId: 'r-9', answer: null, answeredAt: null, altDates: [], note: null }
    tab({ currentAssignedGuideId: GUIDE.id, requests: [open, EARLIER_DECLINED] })
    const [latest, earlier] = screen.getAllByTestId('guide-request')
    expect(within(earlier).queryByRole('button', { name: 'Mark accepted' })).toBeNull()
    fireEvent.click(within(latest).getByRole('button', { name: 'Mark accepted' }))
    await vi.waitFor(() => expect(acceptGuideRequestOnBehalfAction).toHaveBeenCalledWith(INQ, 'r-9'))
    expect(refresh).toHaveBeenCalled()
  })
})

