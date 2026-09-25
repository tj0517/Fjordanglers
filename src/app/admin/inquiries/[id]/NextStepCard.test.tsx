// @vitest-environment jsdom
/**
 * FA-1.32 — the "Next step" card (ex "Thread actions") renders nothing at all when
 * the stage has no action; an empty frame is a bug.
 */
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextStepCard } from './NextStepCard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('@/actions/messages', () => ({
  markAsGuideOffer:      vi.fn(),
  markOfferPresented:    vi.fn(),
  markClientAccepted:    vi.fn(),
  markClientDeclined:    vi.fn(),
  markGuideNotifiedPaid: vi.fn(),
  markContactsExchanged: vi.fn(),
  createPaymentLink:     vi.fn(),
}))
vi.mock('@/actions/inquiries', () => ({
  setDepositAmount: vi.fn(),
}))

afterEach(() => { cleanup(); vi.clearAllMocks() })

const base = {
  inquiryId:                     'inq-1',
  offer:                         null,
  latestInboundMsgId:            null,
  latestOutboundAnglerId:        null,
  latestOutboundGuideId:         null,
  guideId:                       null,
  depositAmountCents:            null,
  depositCurrency:               null,
  depositPaymentLinkId:          null,
  depositPaymentLinkUrl:         null,
  depositPaymentLinkAmountCents: null,
  depositPaymentLinkCurrency:    null,
  guideNotifiedPaid:             false,
}

describe('NextStepCard — no action for the stage → no frame', () => {
  it('awaiting_payment with a declined offer renders nothing', () => {
    const { container } = render(
      <NextStepCard
        {...base}
        inquiryStatus="awaiting_payment"
        offer={{ id: 'o1', status: 'declined', source_message_id: null, options: [] }}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('paid, guide already notified, no guide message → nothing', () => {
    const { container } = render(
      <NextStepCard {...base} inquiryStatus="paid" guideNotifiedPaid={true} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('handed_over renders nothing', () => {
    const { container } = render(<NextStepCard {...base} inquiryStatus="handed_over" />)
    expect(container.innerHTML).toBe('')
  })

  it('paid, guide not yet notified, guide message exists → "Notify guide" action is present', () => {
    render(
      <NextStepCard {...base} inquiryStatus="paid" latestOutboundGuideId="m-guide-1" />,
    )
    expect(screen.getByRole('button', { name: /notify guide/i })).toBeTruthy()
  })
})
