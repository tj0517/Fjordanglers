'use client'

import { useState } from 'react'
import Link from 'next/link'
import { submitGuideApplication } from '@/actions/guide-apply'
import { FISH_ALL } from '@/lib/fish'
import { COUNTRIES as SCANDI_COUNTRIES } from '@/lib/countries'

const COUNTRIES = [
  ...SCANDI_COUNTRIES,
  'Estonia', 'Latvia', 'Lithuania', 'Germany', 'Poland',
  'Netherlands', 'Belgium', 'France', 'United Kingdom',
  'Austria', 'Switzerland', 'Czech Republic', 'Slovakia',
]

const FISH = FISH_ALL

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(10,46,77,0.12)',
  background: '#fff',
  fontSize: '14px',
  color: '#0A2E4D',
  outline: 'none',
  fontFamily: 'inherit',
}

export function ApplyForm() {
  const [fish, setFish]               = useState<string[]>([])
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [success, setSuccess]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const toggleFish = (f: string) =>
    setFish(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const fd = new FormData(e.currentTarget)

    const res = await submitGuideApplication({
      plan:             'listing',
      full_name:        fd.get('full_name') as string,
      email:            fd.get('email') as string,
      phone:            '',
      country:          fd.get('country') as string,
      city:             '',
      years_experience: '',
      fish_types:       fish,
      languages:        [],
      bio:              fd.get('message') as string ?? '',
      certifications:   '',
      instagram:        fd.get('instagram') as string ?? '',
      youtube:          '',
      website:          '',
    })

    setLoading(false)
    if (res.success) setSuccess(true)
    else setError(res.error ?? 'Something went wrong.')
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '400px', padding: '48px 0' }}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'rgba(230,126,80,0.1)', border: '1px solid rgba(230,126,80,0.2)' }}
        >
          <span style={{ fontSize: '28px' }}>🎣</span>
        </div>
        <h3 className="f-display font-bold mb-3" style={{ fontSize: '24px', color: '#0A2E4D' }}>
          Application received!
        </h3>
        <p className="f-body text-sm leading-relaxed" style={{ color: 'rgba(10,46,77,0.5)', maxWidth: '280px' }}>
          We&apos;ll review your profile and get back to you within 48 hours.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Name + Email */}
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-widest f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Full name *
          </label>
          <input name="full_name" required placeholder="Erik Larsen" style={inputStyle} />
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-widest f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
            Email *
          </label>
          <input name="email" type="email" required placeholder="erik@example.com" style={inputStyle} />
        </div>
      </div>

      {/* Country */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-widest f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Country *
        </label>
        <select name="country" required style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
          <option value="">Select your country…</option>
          {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Instagram */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-widest f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Instagram handle
        </label>
        <input name="instagram" placeholder="@yourhandle" style={inputStyle} />
      </div>

      {/* Fish types */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-widest f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
          What do you guide for?
        </label>
        <div className="flex flex-wrap gap-2">
          {FISH.map(f => {
            const active = fish.includes(f)
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFish(f)}
                className="text-xs font-medium px-3.5 py-1.5 rounded-full f-body transition-all"
                style={active
                  ? { background: '#0A2E4D', color: '#fff', border: '1px solid #0A2E4D' }
                  : { background: 'transparent', color: 'rgba(10,46,77,0.5)', border: '1px solid rgba(10,46,77,0.12)' }
                }
              >
                {f}
              </button>
            )
          })}
        </div>
      </div>

      {/* Message */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-widest f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Anything to add?
        </label>
        <textarea
          name="message"
          rows={3}
          placeholder="Tell us a bit about your guiding experience…"
          style={{ ...inputStyle, resize: 'none', lineHeight: '1.5' }}
        />
      </div>

      {error && (
        <p className="text-xs f-body" style={{ color: '#c0392b' }}>{error}</p>
      )}

      {/* Terms acceptance */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <span className="relative flex-shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={e => setTermsAccepted(e.target.checked)}
            className="sr-only"
          />
          <span
            className="flex items-center justify-center w-[18px] h-[18px] rounded-[5px] border-[1.5px] transition-all"
            style={{
              background: termsAccepted ? '#E67E50' : '#fff',
              borderColor: termsAccepted ? '#E67E50' : 'rgba(10,46,77,0.2)',
            }}
          >
            {termsAccepted && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path
                  d="M1 4l2.5 2.5L9 1"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
        </span>
        <span className="text-[12px] f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.55)' }}>
          I have read and agree to the{' '}
          <Link
            href="/legal/terms-of-service"
            target="_blank"
            className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: '#0A2E4D' }}
          >
            Terms of Service
          </Link>
          {' '}and{' '}
          <Link
            href="/legal/privacy-policy"
            target="_blank"
            className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: '#0A2E4D' }}
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      <button
        type="submit"
        disabled={loading || !termsAccepted}
        className="w-full font-semibold text-sm text-white rounded-xl f-body transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: '#E67E50', padding: '14px', marginTop: '4px' }}
      >
        {loading ? 'Submitting…' : 'Apply to join →'}
      </button>

      <p className="text-center text-[11px] f-body" style={{ color: 'rgba(10,46,77,0.3)' }}>
        No commitment. We&apos;ll reach out within 48h.
      </p>
    </form>
  )
}
