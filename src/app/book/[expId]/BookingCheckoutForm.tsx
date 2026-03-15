'use client'

/**
 * BookingCheckoutForm — client component for the /book/[expId] checkout page.
 *
 * Renders angler contact fields, submits to createBookingCheckout Server Action,
 * then redirects to Stripe Checkout.
 */

import { useState, useTransition } from 'react'
import { createBookingCheckout } from '@/actions/bookings'
import { COUNTRIES } from '@/lib/countries'

type Props = {
  expId: string
  dates: string[]
  guests: number
  durationOptionLabel?: string
  defaultName?: string
  defaultEmail?: string
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export default function BookingCheckoutForm({
  expId,
  dates,
  guests,
  durationOptionLabel,
  defaultName = '',
  defaultEmail = '',
}: Props) {
  const [anglerName, setAnglerName] = useState(defaultName)
  const [anglerEmail, setAnglerEmail] = useState(defaultEmail)
  const [anglerPhone, setAnglerPhone] = useState('')
  const [anglerCountry, setAnglerCountry] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await createBookingCheckout({
        experienceId: expId,
        dates,
        guests,
        durationOptionLabel,
        anglerName,
        anglerEmail,
        anglerPhone: anglerPhone || undefined,
        anglerCountry: anglerCountry || undefined,
        specialRequests: specialRequests || undefined,
      })

      if ('error' in result) {
        setError(result.error)
        return
      }

      // Redirect to Stripe Checkout
      window.location.href = result.checkoutUrl
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#F3EDE4',
    border: '1.5px solid rgba(10,46,77,0.12)',
    borderRadius: '12px',
    padding: '12px 14px',
    fontSize: '14px',
    color: '#0A2E4D',
    outline: 'none',
    transition: 'border-color 0.15s',
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Dates summary chips */}
      {dates.length > 0 && (
        <div>
          <p style={labelStyle}>Selected dates</p>
          <div className="flex flex-wrap gap-2">
            {dates.map(iso => (
              <span
                key={iso}
                className="text-xs font-medium px-3 py-1.5 rounded-full f-body"
                style={{
                  background: 'rgba(230,126,80,0.1)',
                  color: '#C05A2A',
                  border: '1px solid rgba(230,126,80,0.2)',
                }}
              >
                {formatDate(iso)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Name */}
      <div>
        <label style={labelStyle}>
          Full name <span style={{ color: '#E67E50' }}>*</span>
        </label>
        <input
          type="text"
          required
          placeholder="Your full name"
          value={anglerName}
          onChange={e => setAnglerName(e.target.value)}
          className="f-body"
          style={inputStyle}
        />
      </div>

      {/* Email */}
      <div>
        <label style={labelStyle}>
          Email <span style={{ color: '#E67E50' }}>*</span>
        </label>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={anglerEmail}
          onChange={e => setAnglerEmail(e.target.value)}
          className="f-body"
          style={inputStyle}
        />
      </div>

      {/* Phone + Country row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label style={labelStyle}>Phone (optional)</label>
          <input
            type="tel"
            placeholder="+48 600 000 000"
            value={anglerPhone}
            onChange={e => setAnglerPhone(e.target.value)}
            className="f-body"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Country</label>
          <select
            value={anglerCountry}
            onChange={e => setAnglerCountry(e.target.value)}
            className="f-body"
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">Select country</option>
            {COUNTRIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Special requests */}
      <div>
        <label style={labelStyle}>Special requests (optional)</label>
        <textarea
          rows={3}
          placeholder="Dietary requirements, gear preferences, accessibility needs…"
          value={specialRequests}
          onChange={e => setSpecialRequests(e.target.value)}
          className="f-body resize-none"
          style={{ ...inputStyle, height: 'auto' }}
        />
      </div>

      {/* Error message */}
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

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-4 rounded-2xl text-white font-semibold text-sm tracking-wide f-body transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: '#E67E50' }}
      >
        {isPending ? (
          <>
            <svg
              className="animate-spin"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="8" cy="8" r="6" strokeOpacity="0.25" />
              <path d="M8 2a6 6 0 016 6" strokeLinecap="round" />
            </svg>
            Redirecting to payment…
          </>
        ) : (
          'Pay 30% Deposit →'
        )}
      </button>

      <p
        className="text-center text-xs f-body"
        style={{ color: 'rgba(10,46,77,0.38)' }}
      >
        You&apos;ll be redirected to secure Stripe checkout. No card stored.
      </p>
    </form>
  )
}
