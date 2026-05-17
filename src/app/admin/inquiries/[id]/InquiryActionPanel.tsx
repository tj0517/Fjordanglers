'use client'

/**
 * InquiryActionPanel — all FA actions for a single inquiry, in one sticky sidebar.
 *
 * Three sections (stacked vertically):
 *   1. Offer Builder   — FA sets total price (€) + deposit (€) + optional note.
 *                        Sends an offer email to the angler when saved.
 *   2. Send Message    — FA sends a free-form email to the angler at any time.
 *                        Stored in inquiry_messages for audit.
 *   3. Send Deposit    — Active only after an offer is set. Uses offer_deposit_eur.
 *                        Creates Stripe Checkout and sends link to angler.
 *
 * Uses router.refresh() after each action so the server-rendered correspondence
 * thread in the left column picks up new messages automatically.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, Copy, ExternalLink, Pencil } from 'lucide-react'
import { saveOffer, sendMessageToAngler, sendDepositLink } from '@/actions/inquiries'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InquiryForPanel {
  id: string
  status: string
  offer_total_eur: number | null
  offer_deposit_eur: number | null
  offer_notes: string | null
  offer_sent_at: string | null
  deposit_amount: number | null
  deposit_paid_at: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InquiryActionPanel({ inquiry }: { inquiry: InquiryForPanel }) {
  const router    = useRouter()
  const hasOffer  = inquiry.offer_total_eur != null && inquiry.offer_deposit_eur != null
  const isLocked  = ['deposit_paid', 'completed', 'cancelled'].includes(inquiry.status)

  // ── Offer state ──────────────────────────────────────────────────────────
  const [offerEditing, setOfferEditing] = useState(!hasOffer)
  const [offerTotal,   setOfferTotal]   = useState(inquiry.offer_total_eur?.toFixed(2)   ?? '')
  const [offerDeposit, setOfferDeposit] = useState(inquiry.offer_deposit_eur?.toFixed(2) ?? '')
  const [offerNotes,   setOfferNotes]   = useState(inquiry.offer_notes ?? '')
  const [offerPending, startOffer]      = useTransition()
  const [offerError,   setOfferError]   = useState<string | null>(null)
  const [offerFlash,   setOfferFlash]   = useState(false)

  // ── Message state ────────────────────────────────────────────────────────
  const [msgSubject, setMsgSubject] = useState('')
  const [msgBody,    setMsgBody]    = useState('')
  const [msgPending, startMsg]      = useTransition()
  const [msgError,   setMsgError]   = useState<string | null>(null)
  const [msgFlash,   setMsgFlash]   = useState(false)

  // ── Deposit state ────────────────────────────────────────────────────────
  const [depositPending, startDeposit] = useTransition()
  const [depositUrl,     setDepositUrl] = useState<string | null>(null)
  const [depositError,   setDepositError] = useState<string | null>(null)
  const [copied,         setCopied]    = useState(false)

  // ── Computed ─────────────────────────────────────────────────────────────
  const parsedTotal   = parseFloat(offerTotal)
  const parsedDeposit = parseFloat(offerDeposit)
  const offerBalance  =
    Number.isFinite(parsedTotal) && Number.isFinite(parsedDeposit)
      ? parsedTotal - parsedDeposit
      : null

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleSaveOffer() {
    setOfferError(null)
    if (!Number.isFinite(parsedTotal) || !Number.isFinite(parsedDeposit)) return

    startOffer(async () => {
      const res = await saveOffer(inquiry.id, {
        totalPriceEur: parsedTotal,
        depositEur:    parsedDeposit,
        notes:         offerNotes.trim() || null,
      })
      if (res.success) {
        setOfferEditing(false)
        setOfferFlash(true)
        setTimeout(() => setOfferFlash(false), 4000)
        router.refresh()
      } else {
        setOfferError(res.error)
      }
    })
  }

  function handleSendMessage() {
    setMsgError(null)
    startMsg(async () => {
      const res = await sendMessageToAngler(inquiry.id, msgSubject, msgBody)
      if (res.success) {
        setMsgSubject('')
        setMsgBody('')
        setMsgFlash(true)
        setTimeout(() => setMsgFlash(false), 4000)
        router.refresh()
      } else {
        setMsgError(res.error)
      }
    })
  }

  function handleSendDepositLink() {
    setDepositError(null)
    startDeposit(async () => {
      const res = await sendDepositLink(inquiry.id)
      if (res.success) {
        setDepositUrl(res.checkoutUrl)
        router.refresh()
      } else {
        setDepositError(res.error)
      }
    })
  }

  function handleCopy() {
    if (depositUrl == null) return
    void navigator.clipboard.writeText(depositUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* ═══════════════════════════════════════════
          SECTION 1: Offer Builder
      ═══════════════════════════════════════════ */}
      <div
        className="rounded-[22px] overflow-hidden"
        style={{ background: '#0A2E4D', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 8px 32px rgba(10,46,77,0.25)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
              style={{ color: 'rgba(255,255,255,0.28)' }}>Step 1</p>
            <p className="text-sm font-bold f-body" style={{ color: '#FFFFFF' }}>
              {hasOffer ? 'Offer' : 'Build offer'}
            </p>
          </div>
          {hasOffer && !offerEditing && !isLocked && (
            <button
              type="button"
              onClick={() => { setOfferEditing(true); setOfferError(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold f-body transition-all hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Pencil size={11} />
              Edit
            </button>
          )}
        </div>

        <div className="px-5 py-4">

          {/* ── Offer summary (not editing) ── */}
          {!offerEditing && hasOffer && (
            <div className="space-y-3">

              {/* Flash: offer was just saved */}
              {offerFlash && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <Check size={13} style={{ color: '#6EE7B7' }} />
                  <p className="text-xs font-semibold f-body" style={{ color: '#6EE7B7' }}>
                    Offer sent to angler via email
                  </p>
                </div>
              )}

              {/* Amounts */}
              <div className="space-y-2">
                {([
                  ['Total trip price',  `€${(inquiry.offer_total_eur ?? 0).toFixed(2)}`],
                  ['Deposit now',       `€${(inquiry.offer_deposit_eur ?? 0).toFixed(2)}`],
                  ['Balance to guide',  `€${((inquiry.offer_total_eur ?? 0) - (inquiry.offer_deposit_eur ?? 0)).toFixed(2)}`],
                ] as [string, string][]).map(([lbl, val], i) => (
                  <div key={lbl} className="flex items-center justify-between">
                    <span className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.4)' }}>{lbl}</span>
                    <span
                      className="text-sm font-bold f-body"
                      style={{ color: i === 0 ? '#FFFFFF' : '#E67E50' }}
                    >
                      {val}
                    </span>
                  </div>
                ))}
              </div>

              {/* FA notes */}
              {inquiry.offer_notes != null && inquiry.offer_notes.trim() !== '' && (
                <p className="text-[11px] f-body leading-relaxed italic"
                  style={{ color: 'rgba(255,255,255,0.38)', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '10px', marginTop: '2px' }}>
                  &ldquo;{inquiry.offer_notes}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* ── Offer form (editing / creating) ── */}
          {offerEditing && (
            <div className="space-y-3">

              {/* Total price */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block"
                  style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Total trip price
                </label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <span className="text-sm font-bold f-body" style={{ color: 'rgba(255,255,255,0.35)' }}>€</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={offerTotal}
                    onChange={e => setOfferTotal(e.target.value)}
                    placeholder="1200.00"
                    className="flex-1 bg-transparent outline-none text-sm font-semibold f-body placeholder:opacity-30"
                    style={{ color: '#FFFFFF' }}
                  />
                </div>
              </div>

              {/* Deposit */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block"
                  style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Deposit amount
                </label>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <span className="text-sm font-bold f-body" style={{ color: 'rgba(255,255,255,0.35)' }}>€</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={offerDeposit}
                    onChange={e => setOfferDeposit(e.target.value)}
                    placeholder="360.00"
                    className="flex-1 bg-transparent outline-none text-sm font-semibold f-body placeholder:opacity-30"
                    style={{ color: '#FFFFFF' }}
                  />
                </div>
              </div>

              {/* Live balance preview */}
              {offerBalance != null && offerBalance >= 0 && (
                <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(230,126,80,0.09)', border: '1px solid rgba(230,126,80,0.2)' }}>
                  <span className="text-[11px] f-body" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Balance to guide
                  </span>
                  <span className="text-sm font-bold f-body" style={{ color: '#E67E50' }}>
                    €{offerBalance.toFixed(2)}
                  </span>
                </div>
              )}
              {offerBalance != null && offerBalance < 0 && (
                <p className="text-[11px] f-body" style={{ color: '#FCA5A5' }}>
                  Deposit cannot exceed total price
                </p>
              )}

              {/* Notes for angler */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block"
                  style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Note for angler&nbsp;
                  <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span>
                </label>
                <textarea
                  value={offerNotes}
                  onChange={e => setOfferNotes(e.target.value)}
                  placeholder="Any specific details about this offer, what's included, etc."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none resize-none placeholder:opacity-30"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#FFFFFF',
                  }}
                />
              </div>

              {/* Error */}
              {offerError != null && (
                <p className="text-xs f-body" style={{ color: '#FCA5A5' }}>{offerError}</p>
              )}

              {/* Buttons */}
              <div className="flex gap-2">
                {hasOffer && (
                  <button
                    type="button"
                    onClick={() => { setOfferEditing(false); setOfferError(null) }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold f-body transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      color: 'rgba(255,255,255,0.45)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveOffer}
                  disabled={
                    offerPending ||
                    !Number.isFinite(parsedTotal) ||
                    !Number.isFinite(parsedDeposit) ||
                    parsedTotal <= 0 ||
                    parsedDeposit <= 0 ||
                    parsedDeposit > parsedTotal
                  }
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body transition-all"
                  style={{
                    background:  offerPending ? 'rgba(230,126,80,0.5)' : '#E67E50',
                    color:       '#fff',
                    cursor:      offerPending ? 'not-allowed' : 'pointer',
                    boxShadow:   offerPending ? 'none' : '0 4px 14px rgba(230,126,80,0.35)',
                    opacity:     (!Number.isFinite(parsedTotal) || !Number.isFinite(parsedDeposit) || parsedTotal <= 0) ? 0.5 : 1,
                  }}
                >
                  {offerPending && <Loader2 size={12} className="animate-spin" />}
                  {offerPending ? 'Sending…' : hasOffer ? 'Update & Resend →' : 'Send Offer to Angler →'}
                </button>
              </div>

              <p className="text-[10px] f-body text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Angler receives an offer email — no payment yet
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 2: Send Message
      ═══════════════════════════════════════════ */}
      <div
        className="rounded-[22px] overflow-hidden"
        style={{
          background: 'rgba(10,46,77,0.75)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 20px rgba(10,46,77,0.18)',
        }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
            style={{ color: 'rgba(255,255,255,0.28)' }}>Anytime</p>
          <p className="text-sm font-bold f-body" style={{ color: '#FFFFFF' }}>Send message</p>
        </div>

        <div className="px-5 py-4">
          {msgFlash ? (
            <div className="flex items-center gap-2 px-3 py-3 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <Check size={14} style={{ color: '#6EE7B7' }} />
              <p className="text-sm font-semibold f-body" style={{ color: '#6EE7B7' }}>
                Message sent to angler
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Subject */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block"
                  style={{ color: 'rgba(255,255,255,0.38)' }}>Subject</label>
                <input
                  type="text"
                  value={msgSubject}
                  onChange={e => setMsgSubject(e.target.value)}
                  placeholder="Re: your inquiry…"
                  className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none placeholder:opacity-30"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#FFFFFF',
                  }}
                />
              </div>

              {/* Body */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] f-body mb-1.5 block"
                  style={{ color: 'rgba(255,255,255,0.38)' }}>Message</label>
                <textarea
                  value={msgBody}
                  onChange={e => setMsgBody(e.target.value)}
                  placeholder={'Hi Jan,\n\nThanks for your inquiry…'}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-xl text-sm f-body outline-none resize-none placeholder:opacity-30"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#FFFFFF',
                  }}
                />
              </div>

              {msgError != null && (
                <p className="text-xs f-body" style={{ color: '#FCA5A5' }}>{msgError}</p>
              )}

              <button
                type="button"
                onClick={handleSendMessage}
                disabled={msgPending || msgSubject.trim() === '' || msgBody.trim() === ''}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold f-body transition-all"
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.12)',
                  cursor: msgPending || msgSubject.trim() === '' || msgBody.trim() === '' ? 'not-allowed' : 'pointer',
                  opacity: msgSubject.trim() === '' || msgBody.trim() === '' ? 0.4 : 1,
                }}
              >
                {msgPending && <Loader2 size={12} className="animate-spin" />}
                {msgPending ? 'Sending…' : 'Send Message →'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SECTION 3: Send Deposit Link
      ═══════════════════════════════════════════ */}
      {!isLocked && (
        <div
          className="rounded-[22px] overflow-hidden"
          style={{
            background: 'rgba(10,46,77,0.55)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] f-body"
              style={{ color: 'rgba(255,255,255,0.28)' }}>Step 2</p>
            <p className="text-sm font-bold f-body" style={{ color: '#FFFFFF' }}>Send deposit link</p>
          </div>

          <div className="px-5 py-4">
            {/* No offer yet */}
            {!hasOffer && (
              <p className="text-xs f-body leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
                Build and send an offer (Step 1) first. The deposit link uses the exact amount from the offer.
              </p>
            )}

            {/* Has offer — deposit URL already created */}
            {hasOffer && depositUrl != null && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <Check size={13} style={{ color: '#6EE7B7' }} />
                  <p className="text-xs font-semibold f-body" style={{ color: '#6EE7B7' }}>
                    Deposit link sent to angler
                  </p>
                </div>

                <div className="px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] f-body mb-1"
                    style={{ color: 'rgba(255,255,255,0.28)' }}>Checkout URL</p>
                  <p className="text-[10px] f-body break-all" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {depositUrl}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold f-body"
                    style={{
                      background: 'rgba(255,255,255,0.07)',
                      color: 'rgba(255,255,255,0.6)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <a
                    href={depositUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold f-body"
                    style={{ background: '#E67E50', color: '#fff' }}
                  >
                    <ExternalLink size={11} />
                    Open
                  </a>
                </div>
              </div>
            )}

            {/* Has offer — ready to send */}
            {hasOffer && depositUrl == null && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs f-body" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Deposit amount
                  </span>
                  <span className="text-base font-bold f-body" style={{ color: '#E67E50' }}>
                    €{(inquiry.offer_deposit_eur ?? 0).toFixed(2)}
                  </span>
                </div>

                {depositError != null && (
                  <p className="text-xs f-body" style={{ color: '#FCA5A5' }}>{depositError}</p>
                )}

                <button
                  type="button"
                  onClick={handleSendDepositLink}
                  disabled={depositPending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold f-body transition-all"
                  style={{
                    background: depositPending ? 'rgba(230,126,80,0.5)' : '#E67E50',
                    color: '#fff',
                    cursor: depositPending ? 'not-allowed' : 'pointer',
                    boxShadow: depositPending ? 'none' : '0 4px 14px rgba(230,126,80,0.35)',
                  }}
                >
                  {depositPending && <Loader2 size={14} className="animate-spin" />}
                  {depositPending ? 'Creating link…' : `Send Deposit Link — €${(inquiry.offer_deposit_eur ?? 0).toFixed(2)} →`}
                </button>

                <p className="text-[10px] f-body text-center" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  Angler pays via Stripe · FA receives deposit directly
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirmed / locked state ── */}
      {isLocked && (
        <div className="px-4 py-3 rounded-xl"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <p className="text-sm f-body font-semibold" style={{ color: '#6EE7B7' }}>
            {inquiry.status === 'deposit_paid' && '✅ Deposit received — booking confirmed'}
            {inquiry.status === 'completed'    && '✅ Trip completed'}
            {inquiry.status === 'cancelled'    && '❌ Inquiry cancelled'}
          </p>
        </div>
      )}
    </div>
  )
}
