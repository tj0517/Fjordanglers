'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  markAsGuideOffer,
  markOfferPresented,
  markClientAccepted,
  markClientDeclined,
  markGuideNotifiedPaid,
  markContactsExchanged,
  createPaymentLink,
} from '@/actions/messages'
import { setDepositAmount, type SetDepositAmountResult } from '@/actions/inquiries'
import { DEPOSIT_PERCENT, depositHintCents, formatDepositAmount } from '@/lib/inquiries/deposit'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OfferForPanel {
  id:                string
  status:            string
  source_message_id: string | null
  options:           Array<{ id: string; label: string; price_cents: number; currency: string; is_accepted: boolean }>
}

export interface NextStepCardProps {
  inquiryId:              string
  inquiryStatus:          string
  offer:                  OfferForPanel | null
  /** ID of the latest inbound message (any counterpart) — used as source for guide offer */
  latestInboundMsgId:     string | null
  /** ID of the latest outbound message to angler — used as message for markOfferPresented */
  latestOutboundAnglerId: string | null
  /** ID of the latest outbound message to guide — used for markGuideNotifiedPaid / markContactsExchanged */
  latestOutboundGuideId:  string | null
  guideId:                string | null
  /** FA-1.28: deposit amount in minor units ×100 (null = not yet set) */
  depositAmountCents:     number | null
  /** FA-1.28: deposit currency uppercase ISO (null = not yet set) */
  depositCurrency:        string | null
  /** FA-1.29: active Stripe Payment Link id stored on the inquiry row */
  depositPaymentLinkId:   string | null
  /** FA-1.29: active Stripe Payment Link URL stored on the inquiry row */
  depositPaymentLinkUrl:  string | null
  /** FA-1.29: amount_cents the active link was created for (from payment.link_sent event payload) */
  depositPaymentLinkAmountCents: number | null
  /** FA-1.29: currency the active link was created for (from payment.link_sent event payload) */
  depositPaymentLinkCurrency:    string | null
  guideNotifiedPaid:      boolean
  /** Display only (FA-1.32) */
  anglerFirstName?:       string
  guideName?:             string | null
  depositPaidAt?:         string | null
  /** True when an agent draft carrying the active payment link is waiting in Conversation */
  hasDepositDraft?:       boolean
}

// ─── Small presentational pieces ──────────────────────────────────────────────

function FlashBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
      <Check size={12} className="text-emerald-700" />
      <p className="text-xs font-semibold f-body text-emerald-700">{message}</p>
    </div>
  )
}

function ErrorLine({ message }: { message: string | null }) {
  if (message == null) return null
  return <p className="text-xs f-body text-destructive">{message}</p>
}

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="f-display text-[22px] font-semibold leading-tight text-foreground">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground f-body max-w-[520px]">{text}</p>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs f-body text-muted-foreground/80">{children}</p>
}

const PRIMARY   = 'h-11 px-5 rounded-xl text-sm font-bold f-body bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed'
const SECONDARY = 'h-11 px-5 rounded-xl text-sm font-semibold f-body border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed'
const INPUT     = 'h-11 px-3.5 rounded-xl text-sm f-body outline-none bg-muted/40 border border-input text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50'

function Spinner({ on }: { on: boolean }) {
  return on ? <Loader2 size={12} className="animate-spin" /> : null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NextStepCard({
  inquiryId,
  inquiryStatus,
  offer,
  latestInboundMsgId,
  latestOutboundAnglerId,
  latestOutboundGuideId,
  guideId,
  depositAmountCents,
  depositCurrency,
  depositPaymentLinkId,
  depositPaymentLinkUrl,
  depositPaymentLinkAmountCents,
  depositPaymentLinkCurrency,
  guideNotifiedPaid: initialGuideNotifiedPaid,
  anglerFirstName = 'the angler',
  guideName = null,
  depositPaidAt = null,
  hasDepositDraft = false,
}: NextStepCardProps) {
  const router = useRouter()

  // ── Guide offer form state ────────────────────────────────────────────────
  const [showOfferForm,  setShowOfferForm]  = useState(false)
  const [optionLabel,    setOptionLabel]    = useState('')
  const [optionPrice,    setOptionPrice]    = useState('')
  const [optionCurrency, setOptionCurrency] = useState('eur')
  const [offerPending,   startOffer]        = useTransition()
  const [offerError,     setOfferError]     = useState<string | null>(null)
  const [offerFlash,     setOfferFlash]     = useState(false)

  // ── Present offer state ───────────────────────────────────────────────────
  const [presentPending, startPresent]    = useTransition()
  const [presentFlash,   setPresentFlash] = useState(false)
  const [presentError,   setPresentError] = useState<string | null>(null)

  // ── Accept / decline state ────────────────────────────────────────────────
  const [acceptPending,  startAccept]    = useTransition()
  const [acceptFlash,    setAcceptFlash] = useState(false)
  const [acceptError,    setAcceptError] = useState<string | null>(null)

  // ── Deposit amount state ──────────────────────────────────────────────────
  const acceptedOption = offer?.options.find(o => o.is_accepted) ?? null
  const hintCents      = acceptedOption != null ? depositHintCents(acceptedOption.price_cents) : null
  const amountSet      = depositAmountCents != null && depositCurrency != null
  const initialInput   = depositAmountCents != null
    ? (depositAmountCents / 100).toFixed(2)
    : hintCents != null ? (hintCents / 100).toFixed(2) : ''
  const [depositInput,     setDepositInput]     = useState(initialInput)
  const [showAmountForm,   setShowAmountForm]   = useState(!amountSet)
  const [setAmountPending, startSetAmount]      = useTransition()
  const [setAmountError,   setSetAmountError]   = useState<string | null>(null)
  const [setAmountFlash,   setSetAmountFlash]   = useState(false)

  // ── Deposit link state ────────────────────────────────────────────────────
  const [depositPending, startDeposit]    = useTransition()
  const [depositFlash,   setDepositFlash] = useState(false)
  const [depositUrl,     setDepositUrl]   = useState<string | null>(depositPaymentLinkUrl ?? null)
  const [depositError,   setDepositError] = useState<string | null>(null)
  const [copied,         setCopied]       = useState(false)

  // ── Guide notified state ──────────────────────────────────────────────────
  const [guideNotifiedPaid, setGuideNotifiedPaid] = useState(initialGuideNotifiedPaid)
  const [notifyPending, startNotify]    = useTransition()
  const [notifyFlash,   setNotifyFlash] = useState(false)
  const [notifyError,   setNotifyError] = useState<string | null>(null)

  // ── Contacts exchanged state ──────────────────────────────────────────────
  const [contactsPending, startContacts]    = useTransition()
  const [contactsFlash,   setContactsFlash] = useState(false)
  const [contactsError,   setContactsError] = useState<string | null>(null)

  function flash(setF: (v: boolean) => void) {
    setF(true)
    setTimeout(() => setF(false), 4000)
  }

  // ─── Handlers (unchanged server actions) ─────────────────────────────────

  function handleCreateGuideOffer() {
    if (latestInboundMsgId == null) return
    const priceCents = Math.round(parseFloat(optionPrice) * 100)
    if (!optionLabel.trim() || !Number.isFinite(priceCents) || priceCents <= 0) return
    setOfferError(null)
    startOffer(async () => {
      const res = await markAsGuideOffer(latestInboundMsgId, {
        guideId: guideId ?? undefined,
        options: [{ label: optionLabel.trim(), priceCents, currency: optionCurrency }],
      })
      if (res.success) {
        setShowOfferForm(false)
        setOptionLabel('')
        setOptionPrice('')
        flash(setOfferFlash)
        router.refresh()
      } else {
        setOfferError(res.error)
      }
    })
  }

  const presentMsgId = offer != null
    ? (latestOutboundAnglerId ?? offer.source_message_id ?? latestInboundMsgId)
    : null

  function handlePresentOffer() {
    if (offer == null || presentMsgId == null) return
    setPresentError(null)
    startPresent(async () => {
      const res = await markOfferPresented(offer.id, presentMsgId)
      if (res.success) { flash(setPresentFlash); router.refresh() }
      else setPresentError(res.error)
    })
  }

  function handleClientAccepted(optionId: string) {
    if (offer == null) return
    setAcceptError(null)
    startAccept(async () => {
      const res = await markClientAccepted(offer.id, optionId)
      if (res.success) { flash(setAcceptFlash); router.refresh() }
      else setAcceptError(res.error)
    })
  }

  function handleClientDeclined() {
    if (offer == null) return
    setAcceptError(null)
    startAccept(async () => {
      const res = await markClientDeclined(offer.id)
      if (res.success) { flash(setAcceptFlash); router.refresh() }
      else setAcceptError(res.error)
    })
  }

  function handleSetDepositAmount() {
    const parsed = parseFloat(depositInput)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSetAmountError('Enter a positive amount')
      return
    }
    const amountCents = Math.round(parsed * 100)
    setSetAmountError(null)
    startSetAmount(async () => {
      const res: SetDepositAmountResult = await setDepositAmount(inquiryId, amountCents)
      if (res.success) {
        flash(setSetAmountFlash)
        setShowAmountForm(false)
        router.refresh()
      } else {
        setSetAmountError(res.error)
      }
    })
  }

  function handleCreateDepositLink() {
    setDepositError(null)
    startDeposit(async () => {
      const res = await createPaymentLink(inquiryId)
      if (res.success) {
        setDepositUrl(res.url)
        if (res.draftError) {
          setDepositError(`Link created — draft failed: ${res.draftError}`)
        } else {
          flash(setDepositFlash)
        }
        router.refresh()
      } else {
        setDepositError(res.error)
      }
    })
  }

  function handleCopyLink() {
    if (depositUrl == null) return
    void navigator.clipboard.writeText(depositUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleGuideNotifiedPaid() {
    const msgId = latestOutboundGuideId
    if (msgId == null) return
    setNotifyError(null)
    startNotify(async () => {
      const res = await markGuideNotifiedPaid(msgId)
      if (res.success) {
        setGuideNotifiedPaid(true)
        flash(setNotifyFlash)
        router.refresh()
      } else {
        setNotifyError(res.error)
      }
    })
  }

  function handleContactsExchanged() {
    const msgId = latestOutboundGuideId
    if (msgId == null) return
    setContactsError(null)
    startContacts(async () => {
      const res = await markContactsExchanged(msgId)
      if (res.success) { flash(setContactsFlash); router.refresh() }
      else setContactsError(res.error)
    })
  }

  // ─── Derived state ────────────────────────────────────────────────────────

  const isPaid       = ['paid', 'handed_over', 'completed'].includes(inquiryStatus)
  const isHandedOver = ['handed_over', 'completed'].includes(inquiryStatus)
  const isTerminal   = ['lost', 'cancelled'].includes(inquiryStatus)

  const guideFirstName = guideName != null && guideName.trim() !== '' ? guideName.trim().split(/\s+/)[0] : null

  // Which single stage view applies. `null` = no action for this stage → no frame.
  type Stage = 'no_offer' | 'present' | 'decision' | 'deposit' | 'notify_guide' | 'contacts'
  let stage: Stage | null = null
  if (isHandedOver || isTerminal) stage = null
  else if (isPaid) {
    if (!guideNotifiedPaid) stage = 'notify_guide'
    else if (latestOutboundGuideId != null) stage = 'contacts'
  } else if (offer == null) stage = 'no_offer'
  else if (offer.status === 'draft') stage = 'present'
  else if (offer.status === 'presented') stage = 'decision'
  else if (offer.status === 'accepted' && acceptedOption != null) stage = 'deposit'

  if (stage == null) return null

  // Deposit-flow derived values
  const linkMatches = depositUrl != null
    && depositPaymentLinkAmountCents === depositAmountCents
    && depositPaymentLinkCurrency === depositCurrency
  const linkOutdated = depositPaymentLinkId != null && !linkMatches
  const depositDisplay = amountSet ? formatDepositAmount(depositAmountCents, depositCurrency) : null
  const depositPct = amountSet && acceptedOption != null
    && acceptedOption.currency.toUpperCase() === depositCurrency && acceptedOption.price_cents > 0
    ? Math.round((depositAmountCents / acceptedOption.price_cents) * 100)
    : null

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <section
      data-testid="next-step"
      className="rounded-2xl border border-border bg-card px-7 py-6 flex flex-col gap-4"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">Next step</p>

      {/* ── No offer yet ─────────────────────────────────────────────────── */}
      {stage === 'no_offer' && (
        <>
          {offerFlash && <FlashBanner message="Guide offer created" />}
          <Heading
            title="No offer yet"
            text="Attach a guide in the Guide tab and wait for their proposal. When the guide replies with prices, turn it into an offer here."
          />
          {!showOfferForm ? (
            <>
              <div className="flex flex-wrap gap-3">
                <Button nativeButton={false} render={<Link href="?tab=guide" scroll={false} />} className={SECONDARY}>
                  Go to Guide tab
                </Button>
                <Button
                  type="button"
                  disabled={latestInboundMsgId == null}
                  onClick={() => setShowOfferForm(true)}
                  className={SECONDARY}
                >
                  Create guide offer
                </Button>
              </div>
              {latestInboundMsgId == null && (
                <Hint>“Create guide offer” unlocks after the first reply in this thread.</Hint>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">Guide offer — option 1</p>
              <input
                type="text"
                value={optionLabel}
                onChange={e => setOptionLabel(e.target.value)}
                placeholder="e.g. Trout fly fishing — 3 days"
                className={cn(INPUT, 'w-full')}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={optionPrice}
                  onChange={e => setOptionPrice(e.target.value)}
                  placeholder="Price"
                  className={cn(INPUT, 'flex-1')}
                />
                <select
                  value={optionCurrency}
                  onChange={e => setOptionCurrency(e.target.value)}
                  className={INPUT}
                >
                  <option value="eur">EUR</option>
                  <option value="usd">USD</option>
                  <option value="isk">ISK</option>
                </select>
              </div>
              <ErrorLine message={offerError} />
              <div className="flex justify-end gap-3">
                <Button type="button" onClick={() => { setShowOfferForm(false); setOfferError(null) }} className={SECONDARY}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCreateGuideOffer}
                  disabled={offerPending || !optionLabel.trim() || !optionPrice}
                  className={PRIMARY}
                >
                  <Spinner on={offerPending} />
                  Create guide offer
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Offer drafted — present it ───────────────────────────────────── */}
      {stage === 'present' && offer != null && (
        <>
          {presentFlash && <FlashBanner message="Offer presented" />}
          <Heading
            title={`Present the offer to ${anglerFirstName}`}
            text={`Send ${anglerFirstName} the offer from Conversation, then mark it as presented here. The status moves to Offer presented.`}
          />
          <div className="flex flex-col gap-2">
            {offer.options.map((opt, i) => (
              <div key={opt.id} className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold text-foreground f-body">{opt.label}</span>
                  <span className="text-[13px] text-muted-foreground f-body">
                    Option {i + 1}{guideName != null ? ` · guide ${guideName}` : ''}
                  </span>
                </div>
                <span className="text-base font-bold text-foreground f-body">{formatDepositAmount(opt.price_cents, opt.currency)}</span>
              </div>
            ))}
          </div>
          <ErrorLine message={presentError} />
          <div className="flex justify-end">
            <Button type="button" onClick={handlePresentOffer} disabled={presentPending || presentMsgId == null} className={PRIMARY}>
              <Spinner on={presentPending} />
              Mark offer as presented
            </Button>
          </div>
          {presentMsgId == null && <Hint>Send {anglerFirstName} a message with the offer first.</Hint>}
        </>
      )}

      {/* ── Offer presented — waiting for the angler ─────────────────────── */}
      {stage === 'decision' && offer != null && (
        <>
          {acceptFlash && <FlashBanner message="Done" />}
          <Heading
            title={`Waiting for ${anglerFirstName}'s decision`}
            text="Mark the option the angler accepts, or record a decline."
          />
          <div className="flex flex-col gap-2">
            {offer.options.map((opt, i) => (
              <div key={opt.id} className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-[15px] font-semibold text-foreground f-body">{opt.label}</span>
                  <span className="text-[13px] text-muted-foreground f-body">
                    Option {i + 1}{guideName != null ? ` · guide ${guideName}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-base font-bold text-foreground f-body">{formatDepositAmount(opt.price_cents, opt.currency)}</span>
                  <Button
                    type="button"
                    onClick={() => handleClientAccepted(opt.id)}
                    disabled={acceptPending}
                    className={PRIMARY}
                  >
                    <Spinner on={acceptPending} />
                    Client accepted
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <ErrorLine message={acceptError} />
          <div className="flex justify-end">
            <Button type="button" onClick={handleClientDeclined} disabled={acceptPending} className={SECONDARY}>
              Client declined
            </Button>
          </div>
        </>
      )}

      {/* ── Offer accepted — deposit amount → link → send ────────────────── */}
      {stage === 'deposit' && acceptedOption != null && (
        <>
          {setAmountFlash && <FlashBanner message="Deposit amount saved" />}
          {depositFlash && <FlashBanner message="Deposit link created" />}

          {!amountSet ? (
            <Heading
              title={`Set the deposit amount for ${anglerFirstName}`}
              text={`${anglerFirstName} accepted “${acceptedOption.label}”. Set the deposit FA collects — the hint is ${DEPOSIT_PERCENT}% of the trip price.`}
            />
          ) : !linkMatches ? (
            <Heading
              title={`Create the deposit link for ${anglerFirstName}`}
              text="Stripe creates a payment link for this amount. A draft message with the link lands in Conversation, ready to review and send."
            />
          ) : (
            <Heading
              title={`Send the deposit link to ${anglerFirstName}`}
              text={hasDepositDraft
                ? 'A draft with this link is ready in Conversation. The status moves to Paid on its own when Stripe confirms the payment.'
                : `Copy the link below and send it to ${anglerFirstName} from Conversation. The status moves to Paid on its own when Stripe confirms the payment.`}
            />
          )}

          {amountSet && depositDisplay != null && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border px-4 py-3.5 flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">Deposit</span>
                <span className="text-xl font-bold text-foreground f-body">{depositDisplay}</span>
                {depositPct != null && (
                  <span className="text-xs text-muted-foreground f-body">
                    {depositPct}% of {formatDepositAmount(acceptedOption.price_cents, acceptedOption.currency)}
                  </span>
                )}
              </div>
              <div className="rounded-xl border border-border px-4 py-3.5 flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">Link</span>
                {linkMatches ? (
                  <>
                    <span className="text-[15px] font-semibold text-foreground f-body flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-700" aria-hidden="true" />Active
                    </span>
                    <span className="text-xs text-muted-foreground f-body">Stripe · not paid yet</span>
                  </>
                ) : linkOutdated ? (
                  <>
                    <span className="text-[15px] font-semibold text-amber-700 f-body flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />Outdated
                    </span>
                    <span className="text-xs text-muted-foreground f-body">Amount changed — create a new link</span>
                  </>
                ) : (
                  <>
                    <span className="text-[15px] font-semibold text-muted-foreground f-body">Not created yet</span>
                    <span className="text-xs text-muted-foreground f-body">Stripe</span>
                  </>
                )}
              </div>
            </div>
          )}

          {showAmountForm && (
            <div className="flex flex-col gap-2">
              <label htmlFor="deposit-amount" className="text-[13px] font-semibold text-foreground f-body">
                Deposit amount ({acceptedOption.currency.toUpperCase()})
              </label>
              <div className="flex gap-2">
                <input
                  id="deposit-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={depositInput}
                  onChange={e => setDepositInput(e.target.value)}
                  disabled={setAmountPending}
                  placeholder="Amount"
                  className={cn(INPUT, 'flex-1')}
                />
                <Button
                  type="button"
                  onClick={handleSetDepositAmount}
                  disabled={setAmountPending}
                  className={amountSet ? SECONDARY : PRIMARY}
                >
                  <Spinner on={setAmountPending} />
                  Save deposit amount
                </Button>
                {amountSet && (
                  <Button type="button" onClick={() => setShowAmountForm(false)} className={SECONDARY}>
                    Cancel
                  </Button>
                )}
              </div>
              {hintCents != null && (
                <Hint>{DEPOSIT_PERCENT}% = {formatDepositAmount(hintCents, acceptedOption.currency)}</Hint>
              )}
              <ErrorLine message={setAmountError} />
            </div>
          )}

          {linkMatches && depositUrl != null && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="payment-link" className="text-[13px] font-semibold text-foreground f-body">Payment link</label>
              <div className="flex gap-2">
                <input
                  id="payment-link"
                  readOnly
                  value={depositUrl}
                  className={cn(INPUT, 'flex-1 min-w-0 text-[13px] bg-muted/60')}
                />
                <Button type="button" onClick={handleCopyLink} className={SECONDARY}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}

          <ErrorLine message={depositError} />

          {amountSet && (
            <div className="flex items-center justify-between gap-3 pt-1">
              {!showAmountForm ? (
                <button
                  type="button"
                  onClick={() => setShowAmountForm(true)}
                  className="h-11 px-2 text-sm font-semibold f-body text-foreground underline underline-offset-4 cursor-pointer"
                >
                  Change amount
                </button>
              ) : <span />}
              {linkMatches ? (
                <Button nativeButton={false} render={<Link href="?tab=conversation" scroll={false} />} className={PRIMARY}>
                  {hasDepositDraft ? 'Open draft in Conversation' : 'Open Conversation'}
                </Button>
              ) : (
                <Button type="button" onClick={handleCreateDepositLink} disabled={depositPending} className={PRIMARY}>
                  <Spinner on={depositPending} />
                  Create deposit link — {depositDisplay}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Paid — notify the guide ──────────────────────────────────────── */}
      {stage === 'notify_guide' && (
        <>
          {notifyFlash && <FlashBanner message="Guide notified" />}
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 shrink-0 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check size={18} strokeWidth={2.5} className="text-emerald-700" aria-hidden="true" />
            </div>
            <Heading
              title={`Deposit paid — tell ${guideFirstName ?? 'the guide'} the trip is booked`}
              text={`${depositDisplay != null ? `${depositDisplay} received` : 'Deposit received'} through Stripe${depositPaidAt != null ? ` on ${new Date(depositPaidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}. The guide has not been notified yet.`}
            />
          </div>
          <ErrorLine message={notifyError} />
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleGuideNotifiedPaid}
              disabled={notifyPending || latestOutboundGuideId == null}
              className={PRIMARY}
            >
              <Spinner on={notifyPending} />
              Notify guide
            </Button>
          </div>
          {latestOutboundGuideId == null && (
            <Hint>Send the guide a message from Conversation first — “Notify guide” marks that message as the notification.</Hint>
          )}
        </>
      )}

      {/* ── Guide notified — exchange contacts ───────────────────────────── */}
      {stage === 'contacts' && (
        <>
          {contactsFlash && <FlashBanner message="Contacts exchanged" />}
          <Heading
            title="Guide notified — exchange contacts"
            text={`When ${anglerFirstName} and ${guideFirstName ?? 'the guide'} have each other's contact details, mark it here. The status moves to Handed over.`}
          />
          <ErrorLine message={contactsError} />
          <div className="flex justify-end">
            <Button type="button" onClick={handleContactsExchanged} disabled={contactsPending} className={PRIMARY}>
              <Spinner on={contactsPending} />
              Contacts exchanged
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
