'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  markAsGuideOffer,
  updateOfferOptions,
  markOfferPresented,
  markClientAccepted,
  markClientDeclined,
  markGuideNotifiedPaid,
  markContactsExchanged,
  createPaymentLink,
  backToDraft,
  changeAcceptedOption,
  reopenOffer,
  updatePaymentLinkDetails,
} from '@/actions/messages'
import { setDepositAmount, updateInquiryStatus, type SetDepositAmountResult } from '@/actions/inquiries'
import { nextStatuses, STATUS_LABELS, STATUS_MEANINGS, type InquiryStatus } from '@/lib/inquiries/state'
import { ALLOWED_DEPOSIT_CURRENCIES, DEPOSIT_PERCENT, depositHintCents, formatDepositAmount } from '@/lib/inquiries/deposit'
import { PRODUCT_NAME_MAX, PRODUCT_DESCRIPTION_MAX, type ProductDetails } from '@/lib/stripe/product-details'
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
  /** ID of the latest inbound message (any counterpart) — linked as the offer's source when present */
  latestInboundMsgId:     string | null
  /** ID of the latest outbound message to angler — attached to markOfferPresented when present (optional, FA-1.76) */
  latestOutboundAnglerId: string | null
  /** ID of the latest outbound message to guide — attached to markGuideNotifiedPaid / markContactsExchanged when present (optional, FA-1.76) */
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
  /** FA-1.77: name/description the active link's payment page shows (null = link created before they were recorded) */
  depositPaymentLinkProduct?:    ProductDetails | null
  /** FA-1.77: today's pattern for a new link — buildStripeProductName / buildStripeProductDescription */
  productDefaults?:              ProductDetails
  guideNotifiedPaid:      boolean
  /** Display only (FA-1.32) */
  anglerFirstName?:       string
  guideName?:             string | null
  depositPaidAt?:         string | null
  /** True when an agent draft carrying the active payment link is waiting in Conversation */
  hasDepositDraft?:       boolean
  /** FA-1.74: the accepted option's price changed after the deposit amount was saved */
  depositFromOldPrice?:   boolean
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
const LINK      = 'h-11 px-2 text-sm font-semibold f-body text-foreground underline underline-offset-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
const INPUT     = 'h-11 px-3.5 rounded-xl text-sm f-body outline-none bg-muted/40 border border-input text-foreground placeholder:text-muted-foreground/50 disabled:opacity-50'

function Spinner({ on }: { on: boolean }) {
  return on ? <Loader2 size={12} className="animate-spin" /> : null
}

// ─── Stripe product fields (FA-1.77) ──────────────────────────────────────────
//
// What the angler reads on the Stripe payment page. No maxLength: the counter turns red
// and the server refuses, so the limit is enforced in one place.

function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span className={cn('text-[11px] f-body tabular-nums', length > max ? 'text-destructive font-semibold' : 'text-muted-foreground/70')}>
      {length}/{max}
    </span>
  )
}

function ProductFields({ value, onChange, disabled }: {
  value:    ProductDetails
  onChange: (next: ProductDetails) => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="product-name" className="text-[13px] font-semibold text-foreground f-body">Product name</label>
          <Counter length={value.name.trim().length} max={PRODUCT_NAME_MAX} />
        </div>
        <input
          id="product-name"
          value={value.name}
          onChange={e => onChange({ ...value, name: e.target.value })}
          disabled={disabled}
          className={INPUT}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="product-description" className="text-[13px] font-semibold text-foreground f-body">Description</label>
          <Counter length={value.description.trim().length} max={PRODUCT_DESCRIPTION_MAX} />
        </div>
        <textarea
          id="product-description"
          rows={3}
          value={value.description}
          onChange={e => onChange({ ...value, description: e.target.value })}
          disabled={disabled}
          className={cn(INPUT, 'h-auto py-2.5 leading-relaxed resize-y')}
        />
      </div>
    </div>
  )
}

// ─── Offer options form (FA-1.74) ─────────────────────────────────────────────
//
// Behind "Create guide offer" and "Edit offer": any number of options (name, price,
// currency), minimum one. The server validates again.

interface OfferOptionValue {
  /** Existing option id; null for an option added in this form. */
  id:         string | null
  label:      string
  priceCents: number
  currency:   string
}

interface Row {
  key:      string
  id:       string | null
  label:    string
  price:    string
  currency: string
  locked:   boolean
}

function priceText(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
}

function priceCents(text: string): number | null {
  const n = Math.round(parseFloat(text) * 100)
  return Number.isFinite(n) && n > 0 ? n : null
}

let nextKey = 0
function newRow(currency: string): Row {
  nextKey += 1
  return { key: `new-${nextKey}`, id: null, label: '', price: '', currency, locked: false }
}

function OfferOptionsForm({
  initial,
  lockedIds = [],
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  /** Current options (edit) or empty (create — starts with one blank option). */
  initial:     ReadonlyArray<{ id: string; label: string; price_cents: number; currency: string }>
  /** Options that cannot be removed (the accepted one). */
  lockedIds?:  readonly string[]
  submitLabel: string
  pending:     boolean
  error:       string | null
  onSubmit:    (options: OfferOptionValue[]) => void
  onCancel:    () => void
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length > 0
      ? initial.map(o => ({
          key:      o.id,
          id:       o.id,
          label:    o.label,
          price:    priceText(o.price_cents),
          currency: o.currency.toLowerCase(),
          locked:   lockedIds.includes(o.id),
        }))
      : [newRow('eur')],
  )

  function update(key: string, patch: Partial<Pick<Row, 'label' | 'price' | 'currency'>>) {
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)))
  }

  const valid = rows.every(r => r.label.trim() !== '' && priceCents(r.price) != null)

  function submit() {
    if (!valid) return
    onSubmit(rows.map(r => ({
      id:         r.id,
      label:      r.label.trim(),
      priceCents: priceCents(r.price) ?? 0,
      currency:   r.currency,
    })))
  }

  return (
    <div className="flex flex-col gap-3" data-testid="offer-options-form">
      {rows.map((r, i) => (
        <div key={r.key} className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">
              Option {i + 1}{r.locked ? ' · accepted' : ''}
            </p>
            {rows.length > 1 && !r.locked && (
              <button
                type="button"
                onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}
                disabled={pending}
                aria-label={`Remove option ${i + 1}`}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <input
            type="text"
            value={r.label}
            onChange={e => update(r.key, { label: e.target.value })}
            disabled={pending}
            placeholder="e.g. Trout fly fishing — 3 days"
            aria-label={`Option ${i + 1} name`}
            className={cn(INPUT, 'w-full')}
          />
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={r.price}
              onChange={e => update(r.key, { price: e.target.value })}
              disabled={pending}
              placeholder="Price"
              aria-label={`Option ${i + 1} price`}
              className={cn(INPUT, 'flex-1')}
            />
            <select
              value={r.currency}
              onChange={e => update(r.key, { currency: e.target.value })}
              disabled={pending}
              aria-label={`Option ${i + 1} currency`}
              className={INPUT}
            >
              {ALLOWED_DEPOSIT_CURRENCIES.map(c => (
                <option key={c} value={c.toLowerCase()}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
      <div>
        <button
          type="button"
          onClick={() => setRows(rs => [...rs, newRow(rs[rs.length - 1]?.currency ?? 'eur')])}
          disabled={pending}
          className="h-9 px-1 text-sm font-semibold f-body text-foreground underline underline-offset-4 cursor-pointer disabled:opacity-50"
        >
          Add option
        </button>
      </div>
      <ErrorLine message={error} />
      <div className="flex justify-end gap-3">
        <Button type="button" onClick={onCancel} disabled={pending} className={SECONDARY}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={pending || !valid} className={PRIMARY}>
          <Spinner on={pending} />
          {submitLabel}
        </Button>
      </div>
    </div>
  )
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
  depositPaymentLinkProduct = null,
  productDefaults = { name: '', description: '' },
  guideNotifiedPaid: initialGuideNotifiedPaid,
  anglerFirstName = 'the angler',
  guideName = null,
  depositPaidAt = null,
  hasDepositDraft = false,
  depositFromOldPrice = false,
}: NextStepCardProps) {
  const router = useRouter()

  // ── Guide offer form state (create + edit) ────────────────────────────────
  const [showOfferForm,  setShowOfferForm]  = useState(false)
  const [offerPending,   startOffer]        = useTransition()
  const [offerError,     setOfferError]     = useState<string | null>(null)
  const [offerFlash,     setOfferFlash]     = useState(false)
  const [showEditForm,   setShowEditForm]   = useState(false)
  const [editFlash,      setEditFlash]      = useState(false)

  // ── Present offer state ───────────────────────────────────────────────────
  const [presentPending, startPresent]    = useTransition()
  const [presentFlash,   setPresentFlash] = useState(false)
  const [presentError,   setPresentError] = useState<string | null>(null)

  // ── Accept / decline state ────────────────────────────────────────────────
  const [acceptPending,  startAccept]    = useTransition()
  const [acceptFlash,    setAcceptFlash] = useState(false)
  const [acceptError,    setAcceptError] = useState<string | null>(null)

  // ── Step back / restore state (FA-1.76) ───────────────────────────────────
  const [revertPending,     startRevert]          = useTransition()
  const [revertError,       setRevertError]       = useState<string | null>(null)
  const [revertFlash,       setRevertFlash]       = useState<string | null>(null)
  const [showChangeConfirm, setShowChangeConfirm] = useState(false)
  const restoreTargets = nextStatuses('lost')
  const [restoreTo,         setRestoreTo]         = useState<InquiryStatus>(restoreTargets[0] ?? 'qualifying')
  const [showNewOfferForm,  setShowNewOfferForm]  = useState(false)

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

  // router.refresh() keeps this component's state. When the accepted option changes or
  // its deposit is cleared ("Change accepted option", FA-1.76), start the amount form
  // again from the new option's hint — adjusting state during render, not in an effect.
  const depositKey = `${acceptedOption?.id ?? ''}|${amountSet ? depositAmountCents : ''}`
  const [depositFor, setDepositFor] = useState(depositKey)
  if (depositFor !== depositKey) {
    setDepositFor(depositKey)
    setDepositInput(initialInput)
    setShowAmountForm(!amountSet)
  }

  // ── Deposit link state ────────────────────────────────────────────────────
  const [depositPending, startDeposit]    = useTransition()
  const [depositFlash,   setDepositFlash] = useState(false)
  const [depositUrl,     setDepositUrl]   = useState<string | null>(depositPaymentLinkUrl ?? null)
  const [depositError,   setDepositError] = useState<string | null>(null)
  const [copied,         setCopied]       = useState(false)

  // ── Stripe product name / description (FA-1.77) ───────────────────────────
  // New link: today's pattern, editable. Refreshed defaults (dates, party size) restart it.
  const [product,        setProduct]        = useState<ProductDetails>(productDefaults)
  const defaultsKey = `${productDefaults.name}|${productDefaults.description}`
  const [defaultsFor,    setDefaultsFor]    = useState(defaultsKey)
  if (defaultsFor !== defaultsKey) {
    setDefaultsFor(defaultsKey)
    setProduct(productDefaults)
  }
  // Active link: Edit renames the product in Stripe, the link URL stays.
  const [detailsForm,    setDetailsForm]    = useState<ProductDetails | null>(null)
  const [detailsPending, startDetails]      = useTransition()
  const [detailsError,   setDetailsError]   = useState<string | null>(null)
  const [detailsFlash,   setDetailsFlash]   = useState(false)

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

  function handleCreateGuideOffer(options: OfferOptionValue[], supersedesOfferId: string | null = null) {
    setOfferError(null)
    startOffer(async () => {
      const res = await markAsGuideOffer(inquiryId, {
        messageId: latestInboundMsgId,
        guideId:   guideId ?? undefined,
        options:   options.map(o => ({ label: o.label, priceCents: o.priceCents, currency: o.currency })),
        supersedesOfferId,
      })
      if (res.success) {
        setShowOfferForm(false)
        setShowNewOfferForm(false)
        flash(setOfferFlash)
        router.refresh()
      } else {
        setOfferError(res.error)
      }
    })
  }

  function handleEditOffer(options: OfferOptionValue[]) {
    if (offer == null) return
    setOfferError(null)
    startOffer(async () => {
      const res = await updateOfferOptions(offer.id, options)
      if (res.success) {
        setShowEditForm(false)
        flash(setEditFlash)
        router.refresh()
      } else {
        setOfferError(res.error)
      }
    })
  }

  function handlePresentOffer() {
    if (offer == null) return
    setPresentError(null)
    startPresent(async () => {
      const res = await markOfferPresented(offer.id, latestOutboundAnglerId)
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

  function runRevert(action: () => Promise<{ success: true } | { success: false; error: string }>, done: string) {
    setRevertError(null)
    startRevert(async () => {
      const res = await action()
      if (res.success) {
        setShowChangeConfirm(false)
        setRevertFlash(done)
        setTimeout(() => setRevertFlash(null), 4000)
        router.refresh()
      } else {
        setRevertError(res.error)
      }
    })
  }

  function handleBackToDraft() {
    if (offer == null) return
    runRevert(() => backToDraft(offer.id), 'Offer back to draft')
  }

  function handleChangeAcceptedOption() {
    if (offer == null) return
    // With a deposit link out, ask first: the link is deactivated in Stripe (tj D2.5).
    if (depositPaymentLinkId != null && !showChangeConfirm) {
      setShowChangeConfirm(true)
      return
    }
    runRevert(() => changeAcceptedOption(offer.id), 'Accepted option cleared — pick the option again')
  }

  function handleReopenOffer() {
    if (offer == null) return
    runRevert(() => reopenOffer(offer.id), 'Offer reopened')
  }

  function handleRestore() {
    runRevert(() => updateInquiryStatus(inquiryId, restoreTo), `Inquiry restored to ${STATUS_LABELS[restoreTo]}`)
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
      const res = await createPaymentLink(inquiryId, product)
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

  function handleSaveDetails() {
    if (detailsForm == null) return
    setDetailsError(null)
    startDetails(async () => {
      const res = await updatePaymentLinkDetails(inquiryId, detailsForm)
      if (res.success) {
        setDetailsForm(null)
        flash(setDetailsFlash)
        router.refresh()
      } else {
        setDetailsError(res.error)
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
    setNotifyError(null)
    startNotify(async () => {
      const res = await markGuideNotifiedPaid(inquiryId, latestOutboundGuideId)
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
    setContactsError(null)
    startContacts(async () => {
      const res = await markContactsExchanged(inquiryId, latestOutboundGuideId)
      if (res.success) { flash(setContactsFlash); router.refresh() }
      else setContactsError(res.error)
    })
  }

  // ─── Derived state ────────────────────────────────────────────────────────

  const isPaid       = ['paid', 'handed_over', 'completed'].includes(inquiryStatus)
  const isHandedOver = ['handed_over', 'completed'].includes(inquiryStatus)

  const guideFirstName = guideName != null && guideName.trim() !== '' ? guideName.trim().split(/\s+/)[0] : null

  // Which single stage view applies. `null` = no action for this stage → no frame.
  type Stage = 'restore' | 'no_offer' | 'present' | 'decision' | 'deposit' | 'declined' | 'notify_guide' | 'contacts'
  let stage: Stage | null = null
  if (isHandedOver || inquiryStatus === 'cancelled') stage = null
  else if (inquiryStatus === 'lost') stage = 'restore'
  else if (isPaid) stage = guideNotifiedPaid ? 'contacts' : 'notify_guide'
  else if (offer == null) stage = 'no_offer'
  else if (offer.status === 'draft') stage = 'present'
  else if (offer.status === 'presented') stage = 'decision'
  else if (offer.status === 'accepted' && acceptedOption != null) stage = 'deposit'
  else if (offer.status === 'declined') stage = 'declined'

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

  const changeOptionLink = (
    <button type="button" onClick={handleChangeAcceptedOption} disabled={revertPending || showChangeConfirm} className={LINK}>
      Change accepted option
    </button>
  )

  /** The offer's options, each with "Client accepted" — stage present and decision. */
  const acceptRows = offer != null && (
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
              disabled={acceptPending || presentPending || revertPending}
              className={PRIMARY}
            >
              <Spinner on={acceptPending} />
              Client accepted
            </Button>
          </div>
        </div>
      ))}
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <section
      data-testid="next-step"
      className="rounded-2xl border border-border bg-card px-7 py-6 flex flex-col gap-4"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">Next step</p>
      {revertFlash != null && <FlashBanner message={revertFlash} />}

      {/* ── Lost — restore when the angler comes back (FA-1.76, tj D5 a) ──── */}
      {stage === 'restore' && (
        <>
          <Heading
            title="Inquiry lost"
            text={`If ${anglerFirstName} came back, restore the inquiry to where the conversation is now. The loss reason is cleared; the loss stays in the history.`}
          />
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Restore to">
            {restoreTargets.map(s => (
              <label
                key={s}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer',
                  restoreTo === s ? 'border-foreground' : 'border-border',
                )}
              >
                <input
                  type="radio"
                  name="restore-to"
                  value={s}
                  checked={restoreTo === s}
                  onChange={() => setRestoreTo(s)}
                  disabled={revertPending}
                />
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold text-foreground f-body">{STATUS_LABELS[s]}</span>
                  <span className="text-[13px] text-muted-foreground f-body">{STATUS_MEANINGS[s]}</span>
                </span>
              </label>
            ))}
          </div>
          <ErrorLine message={revertError} />
          <div className="flex justify-end">
            <Button type="button" onClick={handleRestore} disabled={revertPending} className={PRIMARY}>
              <Spinner on={revertPending} />
              Restore inquiry
            </Button>
          </div>
        </>
      )}

      {/* ── No offer yet ─────────────────────────────────────────────────── */}
      {stage === 'no_offer' && (
        <>
          {offerFlash && <FlashBanner message="Guide offer created" />}
          <Heading
            title="No offer yet"
            text="Attach a guide in the Guide tab and get their prices — in this thread, by WhatsApp or by phone. Then turn them into an offer here, one option per variant."
          />
          {!showOfferForm ? (
            <div className="flex flex-wrap gap-3">
              <Button nativeButton={false} render={<Link href="?tab=guide" scroll={false} />} className={SECONDARY}>
                Go to Guide tab
              </Button>
              <Button type="button" onClick={() => setShowOfferForm(true)} className={SECONDARY}>
                Create guide offer
              </Button>
            </div>
          ) : (
            <OfferOptionsForm
              initial={[]}
              submitLabel="Create guide offer"
              pending={offerPending}
              error={offerError}
              onSubmit={handleCreateGuideOffer}
              onCancel={() => { setShowOfferForm(false); setOfferError(null) }}
            />
          )}
        </>
      )}

      {/* ── Offer drafted — present it ───────────────────────────────────── */}
      {stage === 'present' && offer != null && (
        <>
          {presentFlash && <FlashBanner message="Offer presented" />}
          {acceptFlash && <FlashBanner message="Done" />}
          <Heading
            title={`Present the offer to ${anglerFirstName}`}
            text={`Send ${anglerFirstName} the offer — from Conversation, WhatsApp or by phone — and mark it as presented. If ${anglerFirstName} already said yes, mark the option they accepted. The status moves to Offer presented.`}
          />
          {editFlash && <FlashBanner message="Offer updated" />}
          {showEditForm ? (
            <OfferOptionsForm
              initial={offer.options}
              lockedIds={offer.options.filter(o => o.is_accepted).map(o => o.id)}
              submitLabel="Save offer"
              pending={offerPending}
              error={offerError}
              onSubmit={handleEditOffer}
              onCancel={() => { setShowEditForm(false); setOfferError(null) }}
            />
          ) : (
            <>
              {acceptRows}
              <ErrorLine message={presentError ?? acceptError} />
              <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowEditForm(true)}
                className={LINK}
              >
                Edit offer
              </button>
                <Button type="button" onClick={handlePresentOffer} disabled={presentPending || acceptPending} className={SECONDARY}>
                  <Spinner on={presentPending} />
                  Mark offer as presented
                </Button>
              </div>
              <Hint>
                {latestOutboundAnglerId != null
                  ? `The latest message to ${anglerFirstName} is attached as the one that presents the offer.`
                  : `No message to ${anglerFirstName} in Conversation — fine if the offer went out by WhatsApp or phone.`}
              </Hint>
            </>
          )}
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
          {editFlash && <FlashBanner message="Offer updated" />}
          {showEditForm ? (
            <OfferOptionsForm
              initial={offer.options}
              lockedIds={offer.options.filter(o => o.is_accepted).map(o => o.id)}
              submitLabel="Save offer"
              pending={offerPending}
              error={offerError}
              onSubmit={handleEditOffer}
              onCancel={() => { setShowEditForm(false); setOfferError(null) }}
            />
          ) : (
            <>
              {acceptRows}
              <ErrorLine message={acceptError ?? revertError} />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditForm(true)}
                    className={LINK}
                  >
                    Edit offer
                  </button>
                  <button type="button" onClick={handleBackToDraft} disabled={revertPending || acceptPending} className={LINK}>
                    Back to draft
                  </button>
                </div>
                <Button type="button" onClick={handleClientDeclined} disabled={acceptPending || revertPending} className={SECONDARY}>
                  Client declined
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Offer accepted — deposit amount → link → send ────────────────── */}
      {stage === 'deposit' && acceptedOption != null && (
        <>
          {setAmountFlash && <FlashBanner message="Deposit amount saved" />}
          {depositFlash && <FlashBanner message="Deposit link created" />}
          {detailsFlash && <FlashBanner message="Payment page updated — same link" />}
          {editFlash && <FlashBanner message="Offer updated" />}

          {!amountSet ? (
            <Heading
              title={`Set the deposit amount for ${anglerFirstName}`}
              text={`${anglerFirstName} accepted “${acceptedOption.label}”. Set the deposit FA collects — the hint is ${DEPOSIT_PERCENT}% of the trip price.`}
            />
          ) : !linkMatches ? (
            <Heading
              title={`Create the deposit link for ${anglerFirstName}`}
              text="Stripe creates a payment link for this amount, with the name and description below. A draft message with the link lands in Conversation, ready to review and send."
            />
          ) : (
            <Heading
              title={`Send the deposit link to ${anglerFirstName}`}
              text={hasDepositDraft
                ? 'A draft with this link is ready in Conversation. The status moves to Paid on its own when Stripe confirms the payment.'
                : `Copy the link below and send it to ${anglerFirstName} from Conversation. The status moves to Paid on its own when Stripe confirms the payment.`}
            />
          )}

          {amountSet && depositFromOldPrice && !showEditForm && (
            <div role="alert" data-testid="deposit-old-price" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-1">
              <p className="text-sm font-semibold f-body text-amber-800">Deposit was set from the old price — check the amount</p>
              {hintCents != null && (
                <p className="text-xs f-body text-amber-800">
                  New price {formatDepositAmount(acceptedOption.price_cents, acceptedOption.currency)} · {DEPOSIT_PERCENT}% = {formatDepositAmount(hintCents, acceptedOption.currency)}
                </p>
              )}
            </div>
          )}

          {showEditForm ? (
            <OfferOptionsForm
              initial={offer?.options ?? []}
              lockedIds={[acceptedOption.id]}
              submitLabel="Save offer"
              pending={offerPending}
              error={offerError}
              onSubmit={handleEditOffer}
              onCancel={() => { setShowEditForm(false); setOfferError(null) }}
            />
          ) : (
            <>
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

              {amountSet && !linkMatches && (
                <section aria-labelledby="product-new-title" data-testid="product-details-new" className="flex flex-col gap-3">
                  <div className="flex flex-col gap-0.5">
                    <h3 id="product-new-title" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">Payment page</h3>
                    <Hint>{anglerFirstName} sees this name and description on the Stripe payment page.</Hint>
                  </div>
                  <ProductFields value={product} onChange={setProduct} disabled={depositPending} />
                </section>
              )}

              {linkMatches && (
                <section aria-labelledby="product-active-title" data-testid="product-details-active" className="rounded-xl border border-border px-4 py-3.5 flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 id="product-active-title" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground f-body">Payment page</h3>
                    {detailsForm == null && (
                      <button
                        type="button"
                        onClick={() => { setDetailsError(null); setDetailsForm(depositPaymentLinkProduct ?? productDefaults) }}
                        className="text-sm font-semibold f-body text-foreground underline underline-offset-4 cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {detailsForm != null ? (
                    <>
                      <ProductFields value={detailsForm} onChange={setDetailsForm} disabled={detailsPending} />
                      <Hint>Saving changes the product in Stripe. The link stays the same — nothing to resend.</Hint>
                      <ErrorLine message={detailsError} />
                      <div className="flex justify-end gap-3">
                        <Button type="button" onClick={() => { setDetailsForm(null); setDetailsError(null) }} disabled={detailsPending} className={SECONDARY}>
                          Cancel
                        </Button>
                        <Button type="button" onClick={handleSaveDetails} disabled={detailsPending} className={PRIMARY}>
                          <Spinner on={detailsPending} />
                          Save name and description
                        </Button>
                      </div>
                    </>
                  ) : depositPaymentLinkProduct != null ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-[15px] font-semibold text-foreground f-body break-words">{depositPaymentLinkProduct.name}</p>
                      <p className="text-sm text-muted-foreground f-body leading-relaxed break-words">{depositPaymentLinkProduct.description}</p>
                    </div>
                  ) : (
                    <Hint>This link was created before its name and description were recorded here — Stripe has them. Edit to set them again.</Hint>
                  )}
                </section>
              )}

              {showChangeConfirm && (
                <div role="alertdialog" aria-labelledby="change-option-title" data-testid="change-option-confirm" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <p id="change-option-title" className="text-sm font-semibold f-body text-amber-800">Change the accepted option?</p>
                    <p className="text-xs f-body text-amber-800">
                      The deposit link is deactivated in Stripe, so {anglerFirstName} can no longer pay it. The status goes back to Offer presented and you mark the option {anglerFirstName} wants.
                    </p>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" onClick={() => setShowChangeConfirm(false)} disabled={revertPending} className={SECONDARY}>
                      Keep it
                    </Button>
                    <Button type="button" onClick={handleChangeAcceptedOption} disabled={revertPending} className={PRIMARY}>
                      <Spinner on={revertPending} />
                      Deactivate link and change
                    </Button>
                  </div>
                </div>
              )}

              <ErrorLine message={depositError ?? revertError} />

              {amountSet && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    {!showAmountForm && (
                      <button
                        type="button"
                        onClick={() => setShowAmountForm(true)}
                        className={LINK}
                      >
                        Change amount
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowEditForm(true)}
                      className={LINK}
                    >
                      Edit offer
                    </button>
                    {changeOptionLink}
                  </div>
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

              {!amountSet && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditForm(true)}
                    className={LINK}
                  >
                    Edit offer
                  </button>
                  {changeOptionLink}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Offer declined — the angler came back (FA-1.76) ──────────────── */}
      {stage === 'declined' && offer != null && (
        <>
          {offerFlash && <FlashBanner message="New offer created" />}
          <Heading
            title={`${anglerFirstName} declined the offer`}
            text="If the conversation goes on, reopen this offer to present it again, or make a new one. The declined offer stays in the history."
          />
          {showNewOfferForm ? (
            <OfferOptionsForm
              initial={[]}
              submitLabel="Create new offer"
              pending={offerPending}
              error={offerError}
              onSubmit={options => handleCreateGuideOffer(options, offer.id)}
              onCancel={() => { setShowNewOfferForm(false); setOfferError(null) }}
            />
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {offer.options.map((opt, i) => (
                  <div key={opt.id} className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 opacity-70">
                    <div className="flex flex-col">
                      <span className="text-[15px] font-semibold text-foreground f-body">{opt.label}</span>
                      <span className="text-[13px] text-muted-foreground f-body">Option {i + 1} · declined</span>
                    </div>
                    <span className="text-base font-bold text-foreground f-body">{formatDepositAmount(opt.price_cents, opt.currency)}</span>
                  </div>
                ))}
              </div>
              <ErrorLine message={revertError} />
              <div className="flex justify-end gap-3">
                <Button type="button" onClick={handleReopenOffer} disabled={revertPending} className={SECONDARY}>
                  <Spinner on={revertPending} />
                  Reopen offer
                </Button>
                <Button type="button" onClick={() => setShowNewOfferForm(true)} disabled={revertPending} className={PRIMARY}>
                  New offer
                </Button>
              </div>
            </>
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
              disabled={notifyPending}
              className={PRIMARY}
            >
              <Spinner on={notifyPending} />
              Notify guide
            </Button>
          </div>
          <Hint>
            {latestOutboundGuideId != null
              ? 'The latest message to the guide is attached as the notification.'
              : 'No message to the guide in Conversation — fine if you told them by WhatsApp or phone.'}
          </Hint>
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
