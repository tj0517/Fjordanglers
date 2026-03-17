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
    if (!offerDetails.trim()) {
      setError('Enter offer details.')
      return
    }

    startTransition(async () => {
      const result = await sendOfferByGuide(inquiryId, {
        assignedRiver: assignedRiver.trim(),
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
            onChange={(e) => setOfferPrice(e.target.value)}
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
