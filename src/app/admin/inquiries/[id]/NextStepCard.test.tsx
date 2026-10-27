// @vitest-environment jsdom
/**
 * FA-1.32 — the "Next step" card (ex "Thread actions") renders nothing at all when
 * the stage has no action; an empty frame is a bug.
 * FA-1.74 — multi-option offer form, offer without a thread reply, "Edit offer",
 * old-price deposit warning.
 */
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextStepCard } from './NextStepCard'
import { markAsGuideOffer, updateOfferOptions } from '@/actions/messages'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('@/actions/messages', () => ({
  markAsGuideOffer:      vi.fn(),
  updateOfferOptions:    vi.fn(),
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

// ─── FA-1.74 ──────────────────────────────────────────────────────────────────

const twoOptions = [
  { id: 'opt-1', label: '3 days', price_cents: 300000, currency: 'eur', is_accepted: false },
  { id: 'opt-2', label: '5 days', price_cents: 450000, currency: 'eur', is_accepted: false },
]

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

describe('NextStepCard — create offer without a thread reply, several options (FA-1.74)', () => {
  it('"Create guide offer" is enabled with latestInboundMsgId = null and the old hint is gone', () => {
    render(<NextStepCard {...base} inquiryStatus="waiting_guide" latestInboundMsgId={null} />)
    const btn = screen.getByRole('button', { name: 'Create guide offer' }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(screen.queryByText(/unlocks after the first reply/i)).toBeNull()
  })

  it('creates a two-option offer with messageId null', async () => {
    vi.mocked(markAsGuideOffer).mockResolvedValue({ success: true, offerId: 'off-new' })
    render(<NextStepCard {...base} inquiryStatus="waiting_guide" latestInboundMsgId={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Create guide offer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add option' }))
    fill('Option 1 name', '3 days')
    fill('Option 1 price', '3000')
    fill('Option 2 name', '5 days')
    fill('Option 2 price', '4500.50')
    fireEvent.change(screen.getByLabelText('Option 2 currency'), { target: { value: 'nzd' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create guide offer' }))

    await waitFor(() => expect(vi.mocked(markAsGuideOffer)).toHaveBeenCalledTimes(1))
    expect(vi.mocked(markAsGuideOffer)).toHaveBeenCalledWith('inq-1', {
      messageId: null,
      guideId:   undefined,
      options:   [
        { label: '3 days', priceCents: 300000, currency: 'eur' },
        { label: '5 days', priceCents: 450050, currency: 'nzd' },
      ],
    })
  })

  it('a thread reply is still passed as the source message', async () => {
    vi.mocked(markAsGuideOffer).mockResolvedValue({ success: true, offerId: 'off-new' })
    render(<NextStepCard {...base} inquiryStatus="waiting_guide" latestInboundMsgId="msg-9" />)
    fireEvent.click(screen.getByRole('button', { name: 'Create guide offer' }))
    fill('Option 1 name', '3 days')
    fill('Option 1 price', '3000')
    fireEvent.click(screen.getByRole('button', { name: 'Create guide offer' }))
    await waitFor(() => expect(vi.mocked(markAsGuideOffer)).toHaveBeenCalled())
    expect(vi.mocked(markAsGuideOffer).mock.calls[0][1].messageId).toBe('msg-9')
  })

  it('submit stays disabled while an option is incomplete; the last option cannot be removed', () => {
    render(<NextStepCard {...base} inquiryStatus="waiting_guide" />)
    fireEvent.click(screen.getByRole('button', { name: 'Create guide offer' }))
    expect(screen.queryByRole('button', { name: /remove option/i })).toBeNull()
    fill('Option 1 name', '3 days')
    expect((screen.getByRole('button', { name: 'Create guide offer' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('NextStepCard — "Edit offer" (FA-1.74)', () => {
  it('present stage: Edit offer opens the form pre-filled and saves through updateOfferOptions', async () => {
    vi.mocked(updateOfferOptions).mockResolvedValue({ success: true })
    render(
      <NextStepCard
        {...base}
        inquiryStatus="waiting_guide"
        offer={{ id: 'off-1', status: 'draft', source_message_id: null, options: twoOptions }}
      />,
    )
    expect(screen.getByRole('button', { name: /mark offer as presented/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Edit offer' }))
    expect((screen.getByLabelText('Option 1 name') as HTMLInputElement).value).toBe('3 days')
    expect((screen.getByLabelText('Option 1 price') as HTMLInputElement).value).toBe('3000')
    expect((screen.getByLabelText('Option 2 price') as HTMLInputElement).value).toBe('4500')

    fill('Option 1 price', '3200')
    fireEvent.click(screen.getByRole('button', { name: 'Remove option 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save offer' }))

    await waitFor(() => expect(vi.mocked(updateOfferOptions)).toHaveBeenCalledTimes(1))
    expect(vi.mocked(updateOfferOptions)).toHaveBeenCalledWith('off-1', [
      { id: 'opt-1', label: '3 days', priceCents: 320000, currency: 'eur' },
    ])
    // stage unchanged — back on "present"
    await waitFor(() => expect(screen.getByRole('button', { name: /mark offer as presented/i })).toBeTruthy())
    expect(screen.getByText('Offer updated')).toBeTruthy()
  })

  it('decision stage shows Edit offer', () => {
    render(
      <NextStepCard
        {...base}
        inquiryStatus="offer_presented"
        offer={{ id: 'off-1', status: 'presented', source_message_id: null, options: twoOptions }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Edit offer' })).toBeTruthy()
  })

  it('deposit stage: Edit offer is there and the accepted option has no remove button', () => {
    render(
      <NextStepCard
        {...base}
        inquiryStatus="offer_presented"
        offer={{ id: 'off-1', status: 'accepted', source_message_id: null, options: [{ ...twoOptions[0], is_accepted: true }, twoOptions[1]] }}
        depositAmountCents={60000}
        depositCurrency="EUR"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit offer' }))
    expect(screen.queryByRole('button', { name: 'Remove option 1' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove option 2' })).toBeTruthy()
    expect(screen.getByText('Option 1 · accepted')).toBeTruthy()
  })

  it('a server refusal is shown in the form', async () => {
    vi.mocked(updateOfferOptions).mockResolvedValue({ success: false, error: 'The offer cannot be edited — the inquiry is paid' })
    render(
      <NextStepCard
        {...base}
        inquiryStatus="offer_presented"
        offer={{ id: 'off-1', status: 'presented', source_message_id: null, options: twoOptions }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit offer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save offer' }))
    expect(await screen.findByText('The offer cannot be edited — the inquiry is paid')).toBeTruthy()
  })
})

describe('NextStepCard — old-price deposit warning (FA-1.74)', () => {
  const accepted = { id: 'off-1', status: 'accepted', source_message_id: null, options: [{ ...twoOptions[0], price_cents: 320000, is_accepted: true }] }

  it('shows the warning with the hint from the new price', () => {
    render(
      <NextStepCard
        {...base}
        inquiryStatus="offer_presented"
        offer={accepted}
        depositAmountCents={60000}
        depositCurrency="EUR"
        depositFromOldPrice={true}
      />,
    )
    const warning = screen.getByTestId('deposit-old-price')
    expect(warning.textContent).toContain('Deposit was set from the old price — check the amount')
    // DEPOSIT_PERCENT (20%) of 3,200.00
    expect(warning.textContent).toContain('20% = 640.00 EUR')
  })

  it('no warning when the price has not changed since the deposit', () => {
    render(
      <NextStepCard
        {...base}
        inquiryStatus="offer_presented"
        offer={accepted}
        depositAmountCents={60000}
        depositCurrency="EUR"
      />,
    )
    expect(screen.queryByTestId('deposit-old-price')).toBeNull()
  })
})
