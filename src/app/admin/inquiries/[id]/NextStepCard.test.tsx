// @vitest-environment jsdom
/**
 * FA-1.32 — the "Next step" card (ex "Thread actions") renders nothing at all when
 * the stage has no action; an empty frame is a bug.
 * FA-1.74 — multi-option offer form, offer without a thread reply, "Edit offer",
 * old-price deposit warning.
 * FA-1.76 — stages without needless blocks: "Client accepted" on a draft offer, "Back
 * to draft", "Change accepted option" (+ confirmation with a live link), guide steps
 * without a message, "Restore inquiry" on lost, declined offer → reopen / new offer.
 */
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextStepCard } from './NextStepCard'
import {
  markAsGuideOffer,
  updateOfferOptions,
  markOfferPresented,
  markClientAccepted,
  markGuideNotifiedPaid,
  markContactsExchanged,
  backToDraft,
  changeAcceptedOption,
  reopenOffer,
} from '@/actions/messages'
import { updateInquiryStatus } from '@/actions/inquiries'

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
  backToDraft:           vi.fn(),
  changeAcceptedOption:  vi.fn(),
  reopenOffer:           vi.fn(),
}))
vi.mock('@/actions/inquiries', () => ({
  setDepositAmount:    vi.fn(),
  updateInquiryStatus: vi.fn(),
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
  it('cancelled renders nothing (stays terminal, FA-1.76)', () => {
    const { container } = render(<NextStepCard {...base} inquiryStatus="cancelled" />)
    expect(container.innerHTML).toBe('')
  })

  it('a superseded latest offer renders nothing', () => {
    const { container } = render(
      <NextStepCard
        {...base}
        inquiryStatus="offer_presented"
        offer={{ id: 'o1', status: 'superseded', source_message_id: null, options: [] }}
      />,
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
      supersedesOfferId: null,
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

// ─── FA-1.76 ──────────────────────────────────────────────────────────────────

const draftOffer    = { id: 'off-1', status: 'draft',     source_message_id: null, options: twoOptions }
const presentedOffer = { ...draftOffer, status: 'presented' }
const acceptedOffer = {
  ...draftOffer,
  status:  'accepted',
  options: [{ ...twoOptions[0], is_accepted: true }, twoOptions[1]],
}

describe('NextStepCard — stage present: skip "presented" (FA-1.76 D2.2)', () => {
  it('shows "Client accepted" on every option and "Mark offer as presented" enabled without a message', () => {
    render(<NextStepCard {...base} inquiryStatus="waiting_guide" offer={draftOffer} latestOutboundAnglerId={null} />)
    expect(screen.getAllByRole('button', { name: 'Client accepted' })).toHaveLength(2)
    const present = screen.getByRole('button', { name: 'Mark offer as presented' }) as HTMLButtonElement
    expect(present.disabled).toBe(false)
    expect(screen.queryByText(/with the offer first/i)).toBeNull()
  })

  it('"Client accepted" on a draft offer calls markClientAccepted with that option', async () => {
    vi.mocked(markClientAccepted).mockResolvedValue({ success: true })
    render(<NextStepCard {...base} inquiryStatus="waiting_guide" offer={draftOffer} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Client accepted' })[1])
    await waitFor(() => expect(vi.mocked(markClientAccepted)).toHaveBeenCalledWith('off-1', 'opt-2'))
  })

  it('"Mark offer as presented" without a message sends null; with one, attaches it', async () => {
    vi.mocked(markOfferPresented).mockResolvedValue({ success: true })
    const { unmount } = render(<NextStepCard {...base} inquiryStatus="waiting_guide" offer={draftOffer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark offer as presented' }))
    await waitFor(() => expect(vi.mocked(markOfferPresented)).toHaveBeenLastCalledWith('off-1', null))
    unmount()

    render(<NextStepCard {...base} inquiryStatus="waiting_guide" offer={draftOffer} latestOutboundAnglerId="m-out-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark offer as presented' }))
    await waitFor(() => expect(vi.mocked(markOfferPresented)).toHaveBeenLastCalledWith('off-1', 'm-out-1'))
  })
})

describe('NextStepCard — step back (FA-1.76 D2.3, D2.5)', () => {
  it('stage decision has "Back to draft"', async () => {
    vi.mocked(backToDraft).mockResolvedValue({ success: true })
    render(<NextStepCard {...base} inquiryStatus="offer_presented" offer={presentedOffer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back to draft' }))
    await waitFor(() => expect(vi.mocked(backToDraft)).toHaveBeenCalledWith('off-1'))
  })

  it('stage deposit without a link: "Change accepted option" runs straight away', async () => {
    vi.mocked(changeAcceptedOption).mockResolvedValue({ success: true })
    render(<NextStepCard {...base} inquiryStatus="offer_presented" offer={acceptedOffer} />)
    fireEvent.click(screen.getByRole('button', { name: 'Change accepted option' }))
    await waitFor(() => expect(vi.mocked(changeAcceptedOption)).toHaveBeenCalledWith('off-1'))
    expect(screen.queryByTestId('change-option-confirm')).toBeNull()
  })

  it('stage deposit with an active link: asks first, then deactivates and changes', async () => {
    vi.mocked(changeAcceptedOption).mockResolvedValue({ success: true })
    render(
      <NextStepCard
        {...base}
        inquiryStatus="awaiting_payment"
        offer={acceptedOffer}
        depositAmountCents={60000}
        depositCurrency="EUR"
        depositPaymentLinkId="plink_1"
        depositPaymentLinkUrl="https://buy.stripe.com/test_1"
        depositPaymentLinkAmountCents={60000}
        depositPaymentLinkCurrency="EUR"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Change accepted option' }))
    expect(vi.mocked(changeAcceptedOption)).not.toHaveBeenCalled()
    expect(screen.getByTestId('change-option-confirm').textContent).toMatch(/deactivated in Stripe/i)

    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByTestId('change-option-confirm')).toBeNull()
    expect(vi.mocked(changeAcceptedOption)).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Change accepted option' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate link and change' }))
    await waitFor(() => expect(vi.mocked(changeAcceptedOption)).toHaveBeenCalledWith('off-1'))
  })
})

describe('NextStepCard — deposit cleared on option change (tj 2026-10-27, option B)', () => {
  it('after "Change accepted option" and a new "Client accepted", the deposit stage asks for the amount again', async () => {
    vi.mocked(changeAcceptedOption).mockResolvedValue({ success: true })
    vi.mocked(markClientAccepted).mockResolvedValue({ success: true })
    const withDeposit = {
      depositAmountCents:            60000,
      depositCurrency:               'EUR',
      depositPaymentLinkId:          'plink_1',
      depositPaymentLinkUrl:         'https://buy.stripe.com/test_1',
      depositPaymentLinkAmountCents: 60000,
      depositPaymentLinkCurrency:    'EUR',
    }
    // Deposit stage for option 1 (3 days): 600 EUR set, link out.
    const { rerender } = render(<NextStepCard {...base} {...withDeposit} inquiryStatus="awaiting_payment" offer={acceptedOffer} />)
    expect(screen.getByText(/Send the deposit link/)).toBeTruthy()
    expect(screen.queryByLabelText(/Deposit amount/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Change accepted option' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate link and change' }))
    await waitFor(() => expect(vi.mocked(changeAcceptedOption)).toHaveBeenCalledWith('off-1'))

    // What router.refresh() brings back: offer presented, no deposit, no link.
    rerender(<NextStepCard {...base} inquiryStatus="offer_presented" offer={presentedOffer} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Client accepted' })[1])
    await waitFor(() => expect(vi.mocked(markClientAccepted)).toHaveBeenCalledWith('off-1', 'opt-2'))

    // …and then: option 2 (5 days, 4,500 EUR) accepted, deposit still empty.
    const opt2Accepted = { ...draftOffer, status: 'accepted', options: [twoOptions[0], { ...twoOptions[1], is_accepted: true }] }
    rerender(<NextStepCard {...base} inquiryStatus="offer_presented" offer={opt2Accepted} />)

    expect(screen.getByText('Set the deposit amount for the angler')).toBeTruthy()
    const input = screen.getByLabelText('Deposit amount (EUR)') as HTMLInputElement
    expect(input.value).toBe('900.00')               // 20% of 4,500 EUR, not the old 600
    expect(screen.getByRole('button', { name: 'Save deposit amount' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Create deposit link/ })).toBeNull()
  })
})

describe('NextStepCard — guide steps without a message (FA-1.76 D2.4)', () => {
  it('"Notify guide" is enabled with no guide message and sends null', async () => {
    vi.mocked(markGuideNotifiedPaid).mockResolvedValue({ success: true })
    render(<NextStepCard {...base} inquiryStatus="paid" latestOutboundGuideId={null} />)
    const btn = screen.getByRole('button', { name: 'Notify guide' }) as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    await waitFor(() => expect(vi.mocked(markGuideNotifiedPaid)).toHaveBeenCalledWith('inq-1', null))
  })

  it('"Notify guide" attaches the latest guide message when there is one', async () => {
    vi.mocked(markGuideNotifiedPaid).mockResolvedValue({ success: true })
    render(<NextStepCard {...base} inquiryStatus="paid" latestOutboundGuideId="m-guide-1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Notify guide' }))
    await waitFor(() => expect(vi.mocked(markGuideNotifiedPaid)).toHaveBeenCalledWith('inq-1', 'm-guide-1'))
  })

  it('stage contacts is reached without a guide message', async () => {
    vi.mocked(markContactsExchanged).mockResolvedValue({ success: true })
    render(<NextStepCard {...base} inquiryStatus="paid" guideNotifiedPaid={true} latestOutboundGuideId={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Contacts exchanged' }))
    await waitFor(() => expect(vi.mocked(markContactsExchanged)).toHaveBeenCalledWith('inq-1', null))
  })
})

describe('NextStepCard — lost and declined (FA-1.76 D5 a)', () => {
  it('lost shows "Restore inquiry" with exactly qualifying, waiting_guide, offer_presented', async () => {
    vi.mocked(updateInquiryStatus).mockResolvedValue({ success: true })
    render(<NextStepCard {...base} inquiryStatus="lost" offer={acceptedOffer} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map(r => r.value).sort()).toEqual(['offer_presented', 'qualifying', 'waiting_guide'])

    fireEvent.click(screen.getByRole('radio', { name: /Waiting guide/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore inquiry' }))
    await waitFor(() => expect(vi.mocked(updateInquiryStatus)).toHaveBeenCalledWith('inq-1', 'waiting_guide'))
  })

  it('a declined offer after restore offers "Reopen offer" and "New offer"', async () => {
    vi.mocked(reopenOffer).mockResolvedValue({ success: true })
    vi.mocked(markAsGuideOffer).mockResolvedValue({ success: true, offerId: 'off-2' })
    const declined = { ...draftOffer, status: 'declined' }
    render(<NextStepCard {...base} inquiryStatus="qualifying" offer={declined} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reopen offer' }))
    await waitFor(() => expect(vi.mocked(reopenOffer)).toHaveBeenCalledWith('off-1'))
    cleanup()

    render(<NextStepCard {...base} inquiryStatus="qualifying" offer={declined} />)
    fireEvent.click(screen.getByRole('button', { name: 'New offer' }))
    fill('Option 1 name', '4 days')
    fill('Option 1 price', '3800')
    fireEvent.click(screen.getByRole('button', { name: 'Create new offer' }))
    await waitFor(() => expect(vi.mocked(markAsGuideOffer)).toHaveBeenCalledWith('inq-1', expect.objectContaining({
      options:           [{ label: '4 days', priceCents: 380000, currency: 'eur' }],
      supersedesOfferId: 'off-1',
    })))
  })
})
