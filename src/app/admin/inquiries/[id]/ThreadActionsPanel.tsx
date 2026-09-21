'use client'

import { useState, useTransition } from 'react'
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OfferForPanel {
  id:               string
  status:           string
  source_message_id: string | null
  options:          Array<{ id: string; label: string; price_cents: number; currency: string }>
}

export interface ThreadActionsPanelProps {
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
  /** Deposit amount in euros — converted to cents for createPaymentLink */
  depositAmountEur:       number | null
  guideNotifiedPaid:      boolean
}

function FlashBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-2 bg-emerald-50 border border-emerald-200">
      <Check size={12} className="text-emerald-700" />
      <p className="text-xs font-semibold f-body text-emerald-700">{message}</p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ThreadActionsPanel({
  inquiryId,
  inquiryStatus,
  offer,
  latestInboundMsgId,
  latestOutboundAnglerId,
  latestOutboundGuideId,
  guideId,
  depositAmountEur,
  guideNotifiedPaid: initialGuideNotifiedPaid,
}: ThreadActionsPanelProps) {
  const router  = useRouter()

  // ── Guide offer form state ────────────────────────────────────────────────
  const [showOfferForm,  setShowOfferForm]  = useState(false)
  const [optionLabel,    setOptionLabel]    = useState('')
  const [optionPrice,    setOptionPrice]    = useState('')
  const [optionCurrency, setOptionCurrency] = useState('eur')
  const [offerPending,   startOffer]        = useTransition()
  const [offerError,     setOfferError]     = useState<string | null>(null)
  const [offerFlash,     setOfferFlash]     = useState(false)

  // ── Present offer state ───────────────────────────────────────────────────
  const [presentPending, startPresent]  = useTransition()
  const [presentFlash,   setPresentFlash] = useState(false)
  const [presentError,   setPresentError] = useState<string | null>(null)

  // ── Accept / decline state ────────────────────────────────────────────────
  const [acceptPending,  startAccept]   = useTransition()
  const [acceptFlash,    setAcceptFlash] = useState(false)
  const [acceptError,    setAcceptError] = useState<string | null>(null)

  // ── Deposit link state ────────────────────────────────────────────────────
  const [depositPending, startDeposit]  = useTransition()
  const [depositFlash,   setDepositFlash] = useState(false)
  const [depositUrl,     setDepositUrl]  = useState<string | null>(null)
  const [depositError,   setDepositError] = useState<string | null>(null)

  // ── Guide notified state ──────────────────────────────────────────────────
  const [guideNotifiedPaid, setGuideNotifiedPaid] = useState(initialGuideNotifiedPaid)
  const [notifyPending,  startNotify]   = useTransition()
  const [notifyFlash,    setNotifyFlash] = useState(false)
  const [notifyError,    setNotifyError] = useState<string | null>(null)

  // ── Contacts exchanged state ──────────────────────────────────────────────
  const [contactsPending, startContacts] = useTransition()
  const [contactsFlash,   setContactsFlash] = useState(false)
  const [contactsError,   setContactsError] = useState<string | null>(null)

  // ── Helpers ───────────────────────────────────────────────────────────────

  function flash(setF: (v: boolean) => void) {
    setF(true)
    setTimeout(() => setF(false), 4000)
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

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

  function handlePresentOffer() {
    if (offer == null) return
    const msgId = latestOutboundAnglerId ?? offer.source_message_id ?? latestInboundMsgId
    if (msgId == null) return
    setPresentError(null)
    startPresent(async () => {
      const res = await markOfferPresented(offer.id, msgId)
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

  function handleCreateDepositLink() {
    if (depositAmountEur == null || depositAmountEur <= 0) return
    setDepositError(null)
    startDeposit(async () => {
      const amountCents = Math.round(depositAmountEur * 100)
      const res = await createPaymentLink(inquiryId, amountCents, 'eur')
      if (res.success) {
        setDepositUrl(res.url)
        flash(setDepositFlash)
        router.refresh()
      } else {
        setDepositError(res.error)
      }
    })
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

  const noOffer        = offer == null
  const offerPending2  = offer?.status === 'draft'
  const offerPresented = offer?.status === 'presented'
  const isPaid         = ['paid', 'handed_over', 'completed'].includes(inquiryStatus)
  const isHandedOver   = ['handed_over', 'completed'].includes(inquiryStatus)

  // ─── Render ───────────────────────────────────────────────────────────────

  // Nothing to show after completion
  if (isHandedOver) return null

  return (
    <div className="rounded-[20px] overflow-hidden bg-card border border-border">

      <div className="px-5 py-4 border-b border-border">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body text-muted-foreground">
          Thread actions
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* ── 1. Mark as Guide Offer ──────────────────────────────────────── */}
        {noOffer && latestInboundMsgId != null && !isPaid && (
          <div>
            {offerFlash && <FlashBanner message="Guide offer created" />}
            {!showOfferForm ? (
              <button
                type="button"
                onClick={() => setShowOfferForm(true)}
                className="w-full py-2.5 rounded-xl text-xs font-bold f-body bg-muted text-foreground border border-border"
              >
                Mark as Guide Offer
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] f-body text-muted-foreground">
                  Guide offer — option 1
                </p>

                <input
                  type="text"
                  value={optionLabel}
                  onChange={e => setOptionLabel(e.target.value)}
                  placeholder="e.g. Trout fly fishing — 3 days"
                  className="w-full px-3 py-2 rounded-xl text-xs f-body outline-none placeholder:text-muted-foreground/50 bg-muted/40 border border-input text-foreground"
                />

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={optionPrice}
                    onChange={e => setOptionPrice(e.target.value)}
                    placeholder="Price (EUR)"
                    className="flex-1 px-3 py-2 rounded-xl text-xs f-body outline-none placeholder:text-muted-foreground/50 bg-muted/40 border border-input text-foreground"
                  />
                  <select
                    value={optionCurrency}
                    onChange={e => setOptionCurrency(e.target.value)}
                    className="px-3 py-2 rounded-xl text-xs f-body outline-none bg-muted/40 border border-input text-foreground"
                  >
                    <option value="eur">EUR</option>
                    <option value="usd">USD</option>
                    <option value="isk">ISK</option>
                  </select>
                </div>

                {offerError != null && (
                  <p className="text-[11px] f-body text-destructive">{offerError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowOfferForm(false); setOfferError(null) }}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold f-body bg-muted text-muted-foreground border border-border"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateGuideOffer}
                    disabled={offerPending || !optionLabel.trim() || !optionPrice}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold f-body text-white',
                      offerPending ? 'bg-accent/50 cursor-not-allowed' : 'bg-accent cursor-pointer',
                    )}
                  >
                    {offerPending && <Loader2 size={11} className="animate-spin" />}
                    Create Guide Offer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 2. Present Offer ───────────────────────────────────────────── */}
        {offerPending2 && !isPaid && (
          <div>
            {presentFlash && <FlashBanner message="Offer presented" />}
            {presentError != null && (
              <p className="text-[11px] f-body mb-1 text-destructive">{presentError}</p>
            )}
            <button
              type="button"
              onClick={handlePresentOffer}
              disabled={presentPending}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body text-white',
                presentPending
                  ? 'bg-accent/50 cursor-not-allowed shadow-none'
                  : 'bg-accent cursor-pointer shadow-[0_4px_12px_rgba(230,126,80,0.3)]',
              )}
            >
              {presentPending && <Loader2 size={11} className="animate-spin" />}
              Present Offer to Angler
            </button>
          </div>
        )}

        {/* ── 3. Accept / Decline ────────────────────────────────────────── */}
        {offerPresented && !isPaid && (
          <div className="space-y-2">
            {acceptFlash && <FlashBanner message="Done" />}
            {acceptError != null && (
              <p className="text-[11px] f-body text-destructive">{acceptError}</p>
            )}
            {offer!.options.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleClientAccepted(opt.id)}
                disabled={acceptPending}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body text-white',
                  acceptPending
                    ? 'bg-emerald-500/40 cursor-not-allowed'
                    : 'bg-emerald-500/80 cursor-pointer',
                )}
              >
                {acceptPending && <Loader2 size={11} className="animate-spin" />}
                Client Accepted — {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClientDeclined}
              disabled={acceptPending}
              className="w-full py-2 rounded-xl text-xs font-semibold f-body bg-red-50 text-red-700 border border-red-200 disabled:cursor-not-allowed"
            >
              Client Declined
            </button>
          </div>
        )}

        {/* ── 4. Create Deposit Link ─────────────────────────────────────── */}
        {offer?.status === 'accepted' && !isPaid && depositAmountEur != null && (
          <div>
            {depositFlash && depositUrl != null && (
              <div className="space-y-2 mb-2">
                <FlashBanner message="Deposit link created" />
                <p className="text-[10px] f-body break-all text-muted-foreground">{depositUrl}</p>
              </div>
            )}
            {depositError != null && (
              <p className="text-[11px] f-body mb-1 text-destructive">{depositError}</p>
            )}
            {depositUrl == null && (
              <button
                type="button"
                onClick={handleCreateDepositLink}
                disabled={depositPending}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body text-white',
                  depositPending
                    ? 'bg-accent/50 cursor-not-allowed shadow-none'
                    : 'bg-accent cursor-pointer shadow-[0_4px_12px_rgba(230,126,80,0.3)]',
                )}
              >
                {depositPending && <Loader2 size={11} className="animate-spin" />}
                Create Deposit Link — €{depositAmountEur.toFixed(2)}
              </button>
            )}
          </div>
        )}

        {/* ── 5. Guide Notified Paid ─────────────────────────────────────── */}
        {isPaid && !guideNotifiedPaid && latestOutboundGuideId != null && !isHandedOver && (
          <div>
            {notifyFlash && <FlashBanner message="Guide notified" />}
            {notifyError != null && (
              <p className="text-[11px] f-body mb-1 text-destructive">{notifyError}</p>
            )}
            <button
              type="button"
              onClick={handleGuideNotifiedPaid}
              disabled={notifyPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body bg-muted text-foreground border border-border disabled:cursor-not-allowed"
            >
              {notifyPending && <Loader2 size={11} className="animate-spin" />}
              Guide Notified Paid
            </button>
          </div>
        )}

        {/* ── 6. Contacts Exchanged ──────────────────────────────────────── */}
        {isPaid && guideNotifiedPaid && latestOutboundGuideId != null && !isHandedOver && (
          <div>
            {contactsFlash && <FlashBanner message="Contacts exchanged" />}
            {contactsError != null && (
              <p className="text-[11px] f-body mb-1 text-destructive">{contactsError}</p>
            )}
            <button
              type="button"
              onClick={handleContactsExchanged}
              disabled={contactsPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body bg-muted text-foreground border border-border disabled:cursor-not-allowed"
            >
              {contactsPending && <Loader2 size={11} className="animate-spin" />}
              Contacts Exchanged
            </button>
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {noOffer && latestInboundMsgId == null && !isPaid && (
          <p className="text-xs f-body text-muted-foreground">
            Send a message to the guide, then mark their reply as the guide offer.
          </p>
        )}

      </div>
    </div>
  )
}
