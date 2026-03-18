'use client'

/**
 * GuideOfferForm — lets a guide send a custom trip offer for an inquiry.
 * Calls `sendOfferByGuide` Server Action.
 */

import { useState, useTransition } from 'react'
import { sendOfferByGuide } from '@/actions/inquiries'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  inquiryId: string
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function GuideOfferForm({ inquiryId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [assignedRiver, setAssignedRiver] = useState('')
  const [offerPriceMin, setOfferPriceMin] = useState('')
  const [offerPrice, setOfferPrice] = useState('')
  const [offerDetails, setOfferDetails] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!assignedRiver.trim()) {
      setError('Enter the river or location.')
      return
    }
    const priceNum = parseFloat(offerPrice)
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Enter a valid offer price.')
      return
    }
    const priceMinNum = offerPriceMin.trim() ? parseFloat(offerPriceMin) : undefined
    if (priceMinNum != null && (isNaN(priceMinNum) || priceMinNum <= 0)) {
      setError('Enter a valid minimum price.')
      return
    }
    if (!offerDetails.trim()) {
      setError('Enter offer details.')
      return
    }

    startTransition(async () => {
      const result = await sendOfferByGuide(inquiryId, {
        assignedRiver: assignedRiver.trim(),
        offerPriceMinEur: priceMinNum,
        offerPriceEur: priceNum,
        offerDetails: offerDetails.trim(),
      })
      if (result.error != null) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    })
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
        Offer sent to the angler.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm f-body font-semibold" style={{ color: '#0A2E4D' }}>
        Send an Offer
      </p>

      {/* River / location */}
      <div>
        <label style={labelStyle}>River / location *</label>
        <input
          type="text"
          placeholder="e.g. Alta River, Norway"
          value={assignedRiver}
          onChange={(e) => setAssignedRiver(e.target.value)}
          className="f-body"
          style={inputStyle}
        />
      </div>

      {/* Price range */}
      <div>
        <label style={labelStyle}>Price range (EUR) *</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm f-body"
              style={{ color: 'rgba(10,46,77,0.4)' }}
            >
              €
            </span>
            <input
              type="number"
              step="1"
              min="1"
              placeholder="800"
              value={offerPriceMin}
              onChange={(e) => setOfferPriceMin(e.target.value)}
              className="f-body"
              style={{ ...inputStyle, paddingLeft: '26px' }}
            />
          </div>
          <span className="text-sm f-body flex-shrink-0" style={{ color: 'rgba(10,46,77,0.35)' }}>—</span>
          <div className="relative flex-1">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm f-body"
              style={{ color: 'rgba(10,46,77,0.4)' }}
            >
              €
            </span>
            <input
              type="number"
              step="1"
              min="1"
              placeholder="1200"
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              className="f-body"
              style={{ ...inputStyle, paddingLeft: '26px' }}
            />
          </div>
        </div>
        <p className="mt-1.5 text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Leave the first field empty to set a fixed price. The right value is the final charged amount.
        </p>
      </div>

      {/* Offer details */}
      <div>
        <label style={labelStyle}>Offer details *</label>
        <textarea
          rows={5}
          placeholder="What's included, meeting point, schedule, equipment, cancellation policy…"
          value={offerDetails}
          onChange={(e) => setOfferDetails(e.target.value)}
          className="f-body resize-none"
          style={{ ...inputStyle, height: 'auto' }}
        />
      </div>

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

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm f-body transition-all hover:brightness-110 disabled:opacity-60"
        style={{ background: '#E67E50' }}
      >
        {isPending ? 'Sending…' : 'Send Offer →'}
      </button>
    </form>
  )
}
