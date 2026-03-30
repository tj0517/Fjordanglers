'use client'

/**
 * /plan-your-trip — Icelandic Flow / Concierge inquiry form.
 *
 * Two-step multi-select form. Calls submitInquiry Server Action.
 * Can be submitted without auth (angler_id = null if not logged in).
 * Accepts ?guideId= query param to pre-assign a guide.
 */

import { useState, useTransition, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { submitInquiry } from '@/actions/inquiries'
import { CheckCircle, Minus, Plus, Loader2 } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const SPECIES_OPTIONS = [
  'Salmon', 'Trout', 'Pike', 'Perch', 'Zander',
  'Arctic Char', 'Sea Trout', 'Grayling', 'Halibut', 'Cod',
]

const LEVEL_OPTIONS: { value: 'beginner' | 'intermediate' | 'expert'; label: string; desc: string }[] = [
  { value: 'beginner',     label: 'Beginner',      desc: 'New to fishing'       },
  { value: 'intermediate', label: 'Intermediate',  desc: '2–5 years experience' },
  { value: 'expert',       label: 'Expert',        desc: '5+ years / guide'     },
]

const RIVER_TYPES = ['River', 'Lake', 'Sea', 'Any']

// ─── Styles ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#F3EDE4',
  border: '1.5px solid rgba(10,46,77,0.12)',
  borderRadius: '12px',
  padding: '12px 14px',
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
  marginBottom: '8px',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PlanYourTripForm() {
  const searchParams = useSearchParams()
  const guideId = searchParams.get('guideId') ?? undefined

  const [step, setStep] = useState<1 | 2>(1)
  const [submitted, setSubmitted] = useState(false)
  const [inquiryId, setInquiryId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Step 1 state
  const [datesFrom, setDatesFrom]           = useState('')
  const [datesTo, setDatesTo]               = useState('')
  const [targetSpecies, setTargetSpecies]   = useState<string[]>([])
  const [groupSize, setGroupSize]           = useState(2)
  const [level, setLevel]                   = useState<'beginner' | 'intermediate' | 'expert'>('intermediate')

  // Step 2 state
  const [budgetMin, setBudgetMin]           = useState('')
  const [budgetMax, setBudgetMax]           = useState('')
  const [accommodation, setAccommodation]  = useState<boolean | undefined>(undefined)
  const [riverType, setRiverType]           = useState('Any')
  const [notes, setNotes]                   = useState('')
  const [anglerName, setAnglerName]         = useState('')
  const [anglerEmail, setAnglerEmail]       = useState('')

  function toggleSpecies(species: string) {
    setTargetSpecies(prev =>
      prev.includes(species) ? prev.filter(s => s !== species) : [...prev, species],
    )
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (targetSpecies.length === 0) {
      setError('Please select at least one target species.')
      return
    }
    if (!datesFrom || !datesTo) {
      setError('Please select your trip dates.')
      return
    }
    if (datesFrom > datesTo) {
      setError('Start date must be before end date.')
      return
    }
    setError(null)
    setStep(2)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await submitInquiry({
        anglerName,
        anglerEmail,
        datesFrom,
        datesTo,
        targetSpecies,
        experienceLevel: level,
        groupSize,
        preferences: {
          budgetMin: budgetMin ? Number(budgetMin) : undefined,
          budgetMax: budgetMax ? Number(budgetMax) : undefined,
          accommodation,
          riverType,
          notes: notes || undefined,
        },
        guideId,
      })

      if ('error' in result) {
        setError(result.error)
        return
      }

      setInquiryId(result.inquiryId)
      setSubmitted(true)
    })
  }

  // ── Success state ────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
        style={{ background: '#F3EDE4' }}
      >
        <div
          className="w-full max-w-lg p-10 text-center"
          style={{
            background: '#FDFAF7',
            borderRadius: '32px',
            border: '1px solid rgba(10,46,77,0.08)',
            boxShadow: '0 8px 48px rgba(10,46,77,0.1)',
          }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(74,222,128,0.12)' }}
          >
            <CheckCircle size={36} strokeWidth={2.5} style={{ color: '#16A34A' }} />
          </div>
          <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-3">
            Request Received!
          </h1>
          <p className="f-body text-base mb-8" style={{ color: 'rgba(10,46,77,0.55)' }}>
            We&apos;ve received your trip request. Our team will match you with the perfect guide
            and river — expect a reply within{' '}
            <span className="font-semibold" style={{ color: '#0A2E4D' }}>
              48 hours
            </span>
            .
          </p>
          {inquiryId != null && (
            <p className="text-xs f-body mb-6" style={{ color: 'rgba(10,46,77,0.38)' }}>
              Reference: <span className="font-mono">{inquiryId.slice(0, 8).toUpperCase()}</span>
            </p>
          )}
          <div className="flex flex-col gap-3">
            <Link
              href="/trips"
              className="block w-full py-3.5 rounded-2xl text-white font-semibold text-sm f-body transition-all hover:brightness-110"
              style={{ background: '#E67E50' }}
            >
              Browse Experiences While You Wait →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#F3EDE4' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div
        className="py-16 px-4 text-center"
        style={{ background: 'linear-gradient(180deg, #0A2E4D 0%, #1B4F72 100%)' }}
      >
        <p
          className="text-[11px] uppercase tracking-[0.28em] mb-4 f-body"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          Concierge Service
        </p>
        <h1
          className="text-white f-display font-bold mb-4"
          style={{ fontSize: 'clamp(28px, 5vw, 48px)', lineHeight: 1.15 }}
        >
          Plan Your Custom <br />
          <span style={{ color: '#E67E50', fontStyle: 'italic' }}>Fishing Trip</span>
        </h1>
        <p className="f-body text-base mx-auto max-w-xl" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Tell us what you&apos;re looking for — we&apos;ll match you with the perfect guide and river.
          No booking fees for concierge enquiries.
        </p>
      </div>

      {/* ── Progress indicator ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 py-6">
        {[1, 2].map(n => (
          <div key={n} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold f-body transition-all"
              style={{
                background: step >= n ? '#E67E50' : 'rgba(10,46,77,0.1)',
                color: step >= n ? '#fff' : 'rgba(10,46,77,0.4)',
              }}
            >
              {n}
            </div>
            {n === 1 && (
              <div
                className="h-0.5 w-12 rounded"
                style={{ background: step > 1 ? '#E67E50' : 'rgba(10,46,77,0.1)' }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-16">

        {/* ── STEP 1 ─────────────────────────────────────────────────────────── */}
        {step === 1 && (
          <form
            onSubmit={handleStep1}
            className="p-8"
            style={{
              background: '#FDFAF7',
              borderRadius: '28px',
              border: '1px solid rgba(10,46,77,0.08)',
              boxShadow: '0 4px 24px rgba(10,46,77,0.07)',
            }}
          >
            <h2 className="text-[#0A2E4D] text-2xl font-bold f-display mb-1">
              Your Trip
            </h2>
            <p className="text-sm f-body mb-7" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Step 1 of 2 — Dates & basics
            </p>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label style={labelStyle}>
                  From <span style={{ color: '#E67E50' }}>*</span>
                </label>
                <input
                  type="date"
                  required
                  value={datesFrom}
                  onChange={e => setDatesFrom(e.target.value)}
                  className="f-body"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  To <span style={{ color: '#E67E50' }}>*</span>
                </label>
                <input
                  type="date"
                  required
                  value={datesTo}
                  onChange={e => setDatesTo(e.target.value)}
                  className="f-body"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Species */}
            <div className="mb-6">
              <label style={labelStyle}>
                Target species <span style={{ color: '#E67E50' }}>*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SPECIES_OPTIONS.map(species => {
                  const selected = targetSpecies.includes(species)
                  return (
                    <button
                      key={species}
                      type="button"
                      onClick={() => toggleSpecies(species)}
                      className="text-xs font-semibold px-3.5 py-2 rounded-full f-body transition-all"
                      style={
                        selected
                          ? { background: '#E67E50', color: '#fff' }
                          : {
                              background: 'rgba(10,46,77,0.06)',
                              color: 'rgba(10,46,77,0.6)',
                              border: '1px solid rgba(10,46,77,0.1)',
                            }
                      }
                    >
                      {species}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Group size */}
            <div className="mb-6">
              <label style={labelStyle}>
                Group size <span style={{ color: '#E67E50' }}>*</span>
              </label>
              <div
                className="flex items-center justify-between px-4 py-3 rounded-2xl"
                style={{
                  background: '#F3EDE4',
                  border: '1.5px solid rgba(10,46,77,0.12)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setGroupSize(n => Math.max(1, n - 1))}
                  disabled={groupSize <= 1}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                  style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
                >
                  <Minus size={12} strokeWidth={2} />
                </button>
                <div className="flex items-center gap-2 select-none">
                  <span className="text-lg font-bold f-display" style={{ color: '#0A2E4D', lineHeight: '1' }}>
                    {groupSize}
                  </span>
                  <span className="text-sm f-body" style={{ color: 'rgba(10,46,77,0.5)', lineHeight: '1' }}>
                    {groupSize === 1 ? 'angler' : 'anglers'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setGroupSize(n => Math.min(12, n + 1))}
                  disabled={groupSize >= 12}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                  style={{ background: '#E67E50', color: '#fff' }}
                >
                  <Plus size={12} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Experience level */}
            <div className="mb-7">
              <label style={labelStyle}>
                Experience level <span style={{ color: '#E67E50' }}>*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {LEVEL_OPTIONS.map(opt => {
                  const sel = level === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLevel(opt.value)}
                      className="py-3 px-4 rounded-2xl text-left transition-all"
                      style={
                        sel
                          ? {
                              background: 'rgba(10,46,77,0.06)',
                              border: '1.5px solid #0A2E4D',
                            }
                          : {
                              background: 'transparent',
                              border: '1.5px solid rgba(10,46,77,0.1)',
                            }
                      }
                    >
                      <p
                        className="text-sm font-semibold f-body"
                        style={{ color: sel ? '#0A2E4D' : 'rgba(10,46,77,0.6)' }}
                      >
                        {opt.label}
                      </p>
                      <p
                        className="text-[11px] f-body mt-0.5"
                        style={{ color: 'rgba(10,46,77,0.4)' }}
                      >
                        {opt.desc}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Error */}
            {error != null && (
              <div
                className="mb-5 px-4 py-3 rounded-xl text-sm f-body"
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
              className="w-full py-4 rounded-2xl text-white font-semibold text-sm tracking-wide f-body transition-all hover:brightness-110"
              style={{ background: '#E67E50' }}
            >
              Next: Preferences →
            </button>
          </form>
        )}

        {/* ── STEP 2 ─────────────────────────────────────────────────────────── */}
        {step === 2 && (
          <form
            onSubmit={handleSubmit}
            className="p-8"
            style={{
              background: '#FDFAF7',
              borderRadius: '28px',
              border: '1px solid rgba(10,46,77,0.08)',
              boxShadow: '0 4px 24px rgba(10,46,77,0.07)',
            }}
          >
            <div className="flex items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() => { setError(null); setStep(1) }}
                className="text-[#0A2E4D]/50 hover:text-[#0A2E4D] transition-colors f-body text-sm"
              >
                ← Back
              </button>
            </div>
            <h2 className="text-[#0A2E4D] text-2xl font-bold f-display mb-1">
              Preferences
            </h2>
            <p className="text-sm f-body mb-7" style={{ color: 'rgba(10,46,77,0.5)' }}>
              Step 2 of 2 — Help us match you with the right guide
            </p>

            {/* Budget */}
            <div className="mb-6">
              <label style={labelStyle}>Budget range (optional)</label>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <span
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm f-body"
                    style={{ color: 'rgba(10,46,77,0.4)' }}
                  >
                    €
                  </span>
                  <input
                    type="number"
                    placeholder="Min"
                    min={0}
                    value={budgetMin}
                    onChange={e => setBudgetMin(e.target.value)}
                    className="f-body"
                    style={{ ...inputStyle, paddingLeft: '26px' }}
                  />
                </div>
                <div className="relative">
                  <span
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm f-body"
                    style={{ color: 'rgba(10,46,77,0.4)' }}
                  >
                    €
                  </span>
                  <input
                    type="number"
                    placeholder="Max"
                    min={0}
                    value={budgetMax}
                    onChange={e => setBudgetMax(e.target.value)}
                    className="f-body"
                    style={{ ...inputStyle, paddingLeft: '26px' }}
                  />
                </div>
              </div>
            </div>

            {/* Accommodation */}
            <div className="mb-6">
              <label style={labelStyle}>Accommodation needed?</label>
              <div className="flex gap-3">
                {([
                  { value: true,      label: 'Yes'      },
                  { value: false,     label: 'No'       },
                  { value: undefined, label: 'Flexible' },
                ] as const).map(opt => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setAccommodation(opt.value)}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold f-body transition-all"
                    style={
                      accommodation === opt.value
                        ? { background: '#0A2E4D', color: '#fff' }
                        : {
                            background: 'rgba(10,46,77,0.06)',
                            color: 'rgba(10,46,77,0.6)',
                            border: '1px solid rgba(10,46,77,0.1)',
                          }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* River type */}
            <div className="mb-6">
              <label style={labelStyle}>Water type preference</label>
              <div className="flex gap-3 flex-wrap">
                {RIVER_TYPES.map(rt => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => setRiverType(rt)}
                    className="px-4 py-2 rounded-full text-sm font-semibold f-body transition-all"
                    style={
                      riverType === rt
                        ? { background: '#E67E50', color: '#fff' }
                        : {
                            background: 'rgba(10,46,77,0.06)',
                            color: 'rgba(10,46,77,0.6)',
                            border: '1px solid rgba(10,46,77,0.1)',
                          }
                    }
                  >
                    {rt}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label style={labelStyle}>Special requests (optional)</label>
              <textarea
                rows={3}
                placeholder="Tell us anything else — experience preferences, accessibility needs, equipment, etc."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="f-body resize-none"
                style={{ ...inputStyle, height: 'auto' }}
              />
            </div>

            {/* Divider */}
            <div className="my-6" style={{ height: '1px', background: 'rgba(10,46,77,0.08)' }} />

            {/* Contact */}
            <p
              className="text-[11px] uppercase tracking-[0.18em] mb-4 f-body"
              style={{ color: 'rgba(10,46,77,0.38)' }}
            >
              Your contact details
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label style={labelStyle}>
                  Full name <span style={{ color: '#E67E50' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Your name"
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
            </div>

            {/* Error */}
            {error != null && (
              <div
                className="mb-5 px-4 py-3 rounded-xl text-sm f-body"
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
              className="w-full py-4 rounded-2xl text-white font-semibold text-sm tracking-wide f-body transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: '#E67E50' }}
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" size={16} strokeWidth={2} />
                  Sending…
                </>
              ) : (
                'Send My Request →'
              )}
            </button>

            <p
              className="text-center text-xs mt-4 f-body"
              style={{ color: 'rgba(10,46,77,0.35)' }}
            >
              No booking fee for concierge requests. We&apos;ll reply within 48 hours.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

export default function PlanYourTripPage() {
  return (
    <Suspense fallback={null}>
      <PlanYourTripForm />
    </Suspense>
  )
}
