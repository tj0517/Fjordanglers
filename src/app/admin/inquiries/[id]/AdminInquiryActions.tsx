'use client'

/**
 * AdminInquiryActions — client component for status-dependent admin actions.
 * Calls Server Actions with loading state.
 */

import { useState, useTransition } from 'react'
import { updateInquiryStatus, sendOffer } from '@/actions/inquiries'

// ─── Types ────────────────────────────────────────────────────────────────────

type GuideOption = { id: string; full_name: string; country: string }

type Props = {
  inquiryId: string
  status: string
  guides: GuideOption[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminInquiryActions({ inquiryId, status, guides }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Offer form state
  const [assignedGuideId, setAssignedGuideId]   = useState('')
  const [assignedRiver, setAssignedRiver]         = useState('')
  const [offerPrice, setOfferPrice]               = useState('')
  const [offerDetails, setOfferDetails]           = useState('')

  function handleMarkReviewing() {
    setError(null)
    startTransition(async () => {
      const result = await updateInquiryStatus(inquiryId, 'reviewing')
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess('Marked as reviewing.')
      }
    })
  }

  function handleSendOffer(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!assignedGuideId) { setError('Select a guide.'); return }
    if (!assignedRiver.trim()) { setError('Enter the river/location.'); return }
    const priceNum = parseFloat(offerPrice)
    if (isNaN(priceNum) || priceNum <= 0) { setError('Enter a valid offer price.'); return }
    if (!offerDetails.trim()) { setError('Enter offer details.'); return }

    startTransition(async () => {
      const result = await sendOffer(inquiryId, {
        assignedGuideId,
        assignedRiver: assignedRiver.trim(),
        offerPriceEur: priceNum,
        offerDetails: offerDetails.trim(),
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess('Offer sent to angler.')
      }
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#F3EDE4',
    border: '1.5px solid rgba(10,46,77,0.12)',
    borderRadius: '12px',
    padding: '10px 13px',
    fontSize: '14px',
    color: '#0A2E4D',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.18em',
    color: 'rgba(10,46,77,0.45)',
    marginBottom: '6px',
  }

  if (success) {
    return (
      <div
        className="px-4 py-3 rounded-xl text-sm f-body"
        style={{
          background: 'rgba(74,222,128,0.1)',
          border: '1px solid rgba(74,222,128,0.2)',
          color: '#16A34A',
        }}
      >
        ✓ {success}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── inquiry: mark reviewing ───────────────────────────────────────── */}
      {status === 'inquiry' && (
        <>
          <p className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>
            Review the inquiry details and assign it to a guide when ready.
          </p>
          <button
            type="button"
            onClick={handleMarkReviewing}
            disabled={isPending}
            className="w-full py-3 rounded-2xl text-white font-semibold text-sm f-body transition-all hover:brightness-110 disabled:opacity-60"
            style={{ background: '#3B82F6' }}
          >
            {isPending ? 'Updating…' : 'Mark as Reviewing →'}
          </button>
        </>
      )}

      {/* ── reviewing: send offer form ────────────────────────────────────── */}
      {status === 'reviewing' && (
        <form onSubmit={handleSendOffer} className="flex flex-col gap-4">
          <p className="text-sm f-body font-semibold" style={{ color: '#0A2E4D' }}>
            Send an Offer
          </p>

          {/* Guide select */}
          <div>
            <label style={labelStyle}>Assign guide *</label>
            <select
              value={assignedGuideId}
              onChange={e => setAssignedGuideId(e.target.value)}
              className="f-body"
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Select guide…</option>
              {guides.map(g => (
                <option key={g.id} value={g.id}>
                  {g.full_name} ({g.country})
                </option>
              ))}
            </select>
          </div>

          {/* River/location */}
          <div>
            <label style={labelStyle}>River / location *</label>
            <input
              type="text"
              placeholder="e.g. Alta River, Norway"
              value={assignedRiver}
              onChange={e => setAssignedRiver(e.target.value)}
              className="f-body"
              style={inputStyle}
            />
          </div>

          {/* Price */}
          <div>
            <label style={labelStyle}>Offer price (EUR) *</label>
            <div className="relative">
              <span
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm f-body"
                style={{ color: 'rgba(10,46,77,0.4)' }}
              >
                €
              </span>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="1200.00"
                value={offerPrice}
                onChange={e => setOfferPrice(e.target.value)}
                className="f-body"
                style={{ ...inputStyle, paddingLeft: '26px' }}
              />
            </div>
          </div>

          {/* Offer details */}
          <div>
            <label style={labelStyle}>Offer details *</label>
            <textarea
              rows={5}
              placeholder="What's included, meeting point, schedule, equipment, cancellation policy…"
              value={offerDetails}
              onChange={e => setOfferDetails(e.target.value)}
              className="f-body resize-none"
              style={{ ...inputStyle, height: 'auto' }}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm f-body transition-all hover:brightness-110 disabled:opacity-60"
            style={{ background: '#E67E50' }}
          >
            {isPending ? 'Sending…' : 'Send Offer →'}
          </button>
        </form>
      )}

      {/* ── offer_sent: awaiting ───────────────────────────────────────────── */}
      {status === 'offer_sent' && (
        <div
          className="px-4 py-4 rounded-xl text-sm f-body"
          style={{
            background: 'rgba(139,92,246,0.06)',
            border: '1px solid rgba(139,92,246,0.15)',
            color: '#7C3AED',
          }}
        >
          <p className="font-semibold mb-1">Offer sent</p>
          <p className="text-xs" style={{ color: 'rgba(10,46,77,0.5)' }}>
            Waiting for the angler to review and accept the offer.
          </p>
        </div>
      )}

      {/* ── offer_accepted / confirmed / completed ────────────────────────── */}
      {(status === 'offer_accepted' || status === 'confirmed' || status === 'completed') && (
        <div
          className="px-4 py-4 rounded-xl text-sm f-body"
          style={{
            background: 'rgba(74,222,128,0.08)',
            border: '1px solid rgba(74,222,128,0.2)',
            color: '#16A34A',
          }}
        >
          <p className="font-semibold mb-1">
            {status === 'completed' ? 'Trip completed ✓' : 'Angler confirmed ✓'}
          </p>
          <p className="text-xs" style={{ color: 'rgba(10,46,77,0.5)' }}>
            {status === 'offer_accepted'
              ? 'Payment link sent. Waiting for Stripe confirmation.'
              : status === 'confirmed'
              ? 'Payment received. Trip is booked.'
              : 'This trip has been marked as completed.'}
          </p>
        </div>
      )}

      {/* ── cancelled ────────────────────────────────────────────────────────── */}
      {status === 'cancelled' && (
        <div
          className="px-4 py-4 rounded-xl text-sm f-body"
          style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.15)',
            color: '#DC2626',
          }}
        >
          This inquiry was cancelled or refunded.
        </div>
      )}

      {/* Error */}
      {error != null && (
        <div
          className="px-4 py-3 rounded-xl text-sm f-body"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#DC2626',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
