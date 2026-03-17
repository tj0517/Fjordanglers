'use client'

import { useState, useTransition } from 'react'
import { createBookingCheckout } from '@/actions/bookings'
import { createClient } from '@/lib/supabase/client'
import { GoogleAuthButton } from '@/components/auth/google-auth-button'
import { COUNTRIES } from '@/lib/countries'

type Props = {
  expId: string
  dates: string[]
  guests: number
  durationOptionLabel?: string
  defaultName?: string
  defaultEmail?: string
  isLoggedIn?: boolean
}

type Mode = 'guest' | 'login' | 'register'


export default function BookingCheckoutForm({
  expId,
  dates,
  guests,
  durationOptionLabel,
  defaultName = '',
  defaultEmail = '',
  isLoggedIn = false,
}: Props) {
  const [mode, setMode] = useState<Mode>('guest')

  // Contact fields
  const [anglerName, setAnglerName] = useState(defaultName)
  const [anglerEmail, setAnglerEmail] = useState(defaultEmail)
  const [anglerPhone, setAnglerPhone] = useState('')
  const [anglerCountry, setAnglerCountry] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')

  // Auth fields (login + register)
  const [password, setPassword] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const supabase = createClient()

      // ── Login ──────────────────────────────────────────────────────────────
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: anglerEmail,
          password,
        })
        if (signInError) {
          setError('Invalid email or password.')
          return
        }
      }

      // ── Create account ─────────────────────────────────────────────────────
      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: anglerEmail,
          password,
          options: { data: { full_name: anglerName } },
        })
        if (signUpError) {
          setError(signUpError.message)
          return
        }
        if (!data.session) {
          setError('Account created — check your email to confirm, then try booking again.')
          return
        }
      }

      // ── Submit booking ──────────────────────────────────────────────────────
      const result = await createBookingCheckout({
        experienceId: expId,
        dates,
        guests,
        durationOptionLabel,
        anglerName: mode === 'guest' ? anglerName : undefined,
        anglerEmail,
        anglerPhone: mode === 'guest' ? (anglerPhone || undefined) : undefined,
        anglerCountry: mode === 'guest' ? (anglerCountry || undefined) : undefined,
        specialRequests: mode === 'guest' ? (specialRequests || undefined) : undefined,
      })

      if ('error' in result) {
        setError(result.error)
        return
      }

      window.location.href = `/book/${expId}/confirmation?bookingId=${result.bookingId}`
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

      {/* ── Mode toggle — hidden when already logged in ──────────────────────── */}
      {!isLoggedIn && (
        <div
          className="flex rounded-2xl p-1 gap-1"
          style={{ background: '#F3EDE4', border: '1.5px solid rgba(10,46,77,0.08)' }}
        >
          {([
            { key: 'guest',    label: 'Guest' },
            { key: 'login',    label: 'Log In' },
            { key: 'register', label: 'Sign Up' },
          ] as { key: Mode; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setMode(key); setError(null) }}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold f-body transition-all"
              style={{
                background: mode === key ? '#FDFAF7' : 'transparent',
                color: mode === key ? '#0A2E4D' : 'rgba(10,46,77,0.4)',
                boxShadow: mode === key ? '0 1px 6px rgba(10,46,77,0.08)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Guest fields ─────────────────────────────────────────────────────── */}
      {mode === 'guest' && (
        <>
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
        </>
      )}

      {/* ── Auth fields (login + register) ───────────────────────────────────── */}
      {!isLoggedIn && (mode === 'login' || mode === 'register') && (
        <>
          {mode === 'register' && (
            <>
              <GoogleAuthButton
                next={`/book/${expId}/confirmation`}
                label="Sign up with Google"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(10,46,77,0.08)' }} />
                <span className="text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(10,46,77,0.08)' }} />
              </div>
            </>
          )}
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

          <div>
            <label style={labelStyle}>
              Password <span style={{ color: '#E67E50' }}>*</span>
            </label>
            <input
              type="password"
              required
              minLength={mode === 'register' ? 8 : 1}
              placeholder={mode === 'register' ? 'Min 8 characters' : 'Your password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="f-body"
              style={inputStyle}
            />
            {mode === 'register' && (
              <p className="text-[11px] mt-1.5 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                Creates your angler account to track bookings.
              </p>
            )}
          </div>
        </>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
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

      {/* ── Submit ──────────────────────────────────────────────────────────── */}
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
            Sending request…
          </>
        ) : (
          'Request to Book →'
        )}
      </button>

      <p
        className="text-center text-xs f-body"
        style={{ color: 'rgba(10,46,77,0.38)' }}
      >
        No payment required now. Guide will confirm within 24 hours.
      </p>
    </form>
  )
}
