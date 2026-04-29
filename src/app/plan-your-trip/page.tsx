'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { submitTripPlan } from '@/actions/trip-plan'
import type { TripPlanPayload } from '@/actions/trip-plan'

// ─── Data ────────────────────────────────────────────────────────────────────

const SPECIES = [
  { id: 'Atlantic Salmon',   label: 'Atlantic Salmon',      icon: '🐟' },
  { id: 'Sea Trout',         label: 'Sea Trout',            icon: '🎣' },
  { id: 'Brown Trout',       label: 'Brown / Rainbow Trout', icon: '🐠' },
  { id: 'Cod',               label: 'Cod',                  icon: '🐡' },
  { id: 'Halibut',           label: 'Halibut',              icon: '🦈' },
  { id: 'Pike & Perch',      label: 'Pike & Perch',         icon: '🎯' },
  { id: 'Arctic Char',       label: 'Arctic Char',          icon: '❄️' },
  { id: 'Anything — surprise me', label: 'Anything — surprise me', icon: '✨' },
]

const COUNTRIES = [
  { id: 'Norway',  label: 'Norway',              flag: '🇳🇴', desc: 'Fjords, salmon rivers, arctic sea' },
  { id: 'Sweden',  label: 'Sweden',              flag: '🇸🇪', desc: 'Pike paradise, coastal trout, clear lakes' },
  { id: 'Iceland', label: 'Iceland',             flag: '🇮🇸', desc: 'Pristine salmon rivers, volcanic landscapes' },
  { id: 'Open',    label: 'Anywhere — you choose', flag: '🗺️', desc: 'We\'ll suggest the best fit for your goals' },
]

const TRIP_TYPES = [
  { id: 'Day trip',        label: 'Day trip',              desc: 'One or two full days on the water' },
  { id: 'Multi-day',       label: 'Multi-day expedition',  desc: '3+ days, deeper immersion in nature' },
  { id: 'Flexible',        label: 'Flexible',              desc: 'Open to both — let\'s figure it out together' },
]

const DURATIONS = ['1 day', '2 days', '3–4 days', '5–7 days', '1–2 weeks', 'Flexible']

// ─── Step labels ─────────────────────────────────────────────────────────────

const STEPS = [
  'What to catch',
  'Where to go',
  'Trip details',
  'Your details',
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlanYourTripPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // ── Form state ──────────────────────────────────────────────────────────────
  const [species,     setSpecies]     = useState<string[]>([])
  const [country,     setCountry]     = useState('')
  const [datesApprox, setDatesApprox] = useState('')
  const [partySize,   setPartySize]   = useState(2)
  const [tripType,    setTripType]    = useState('')
  const [duration,    setDuration]    = useState('')
  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [message,     setMessage]     = useState('')
  const [newsletter,  setNewsletter]  = useState(false)

  // ── Step validation ─────────────────────────────────────────────────────────
  const canNext = [
    species.length > 0,
    !!country,
    !!tripType && !!duration,
    !!name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
  ]

  function toggleSpecies(id: string) {
    setSpecies(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id],
    )
  }

  function handleNext() {
    setError(null)
    setStep(s => s + 1)
  }

  function handleBack() {
    setError(null)
    setStep(s => s - 1)
  }

  function handleSubmit() {
    setError(null)
    const payload: TripPlanPayload = {
      species,
      country,
      datesApprox: datesApprox.trim() || null,
      partySize,
      tripType,
      duration,
      name:       name.trim(),
      email:      email.trim(),
      phone:      phone.trim() || null,
      message:    message.trim() || null,
      newsletter,
    }
    startTransition(async () => {
      const result = await submitTripPlan(payload)
      if (result.success) {
        router.push('/thank-you')
      } else {
        setError(result.error)
      }
    })
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#F3EDE4' }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-6 md:px-10 h-16 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.08)' }}
      >
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/dark-logo.png" alt="FjordAnglers" className="h-7 w-auto" />
        </Link>
        <span className="text-[13px] f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
          Step {step + 1} of {STEPS.length}
        </span>
      </header>

      {/* ── Progress bar ────────────────────────────────────────────────────── */}
      <div className="h-[3px] w-full" style={{ background: 'rgba(10,46,77,0.08)' }}>
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, background: '#E67E50' }}
        />
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">

          {/* ── Step 1: Species ─────────────────────────────────────────────── */}
          {step === 0 && (
            <div>
              <p className="f-body text-[13px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: '#E67E50' }}>
                Step 1 — What to catch
              </p>
              <h1 className="f-display text-[32px] md:text-[42px] font-bold mb-2 leading-tight" style={{ color: '#0A2E4D' }}>
                What are you after?
              </h1>
              <p className="f-body text-[15px] mb-8" style={{ color: 'rgba(10,46,77,0.55)' }}>
                Pick one or more. We'll match you with guides who specialise in your target species.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {SPECIES.map(s => {
                  const selected = species.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSpecies(s.id)}
                      className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 text-center transition-all duration-150"
                      style={{
                        borderColor: selected ? '#E67E50' : 'rgba(10,46,77,0.12)',
                        background:  selected ? 'rgba(230,126,80,0.08)' : '#fff',
                      }}
                    >
                      <span className="text-2xl">{s.icon}</span>
                      <span className="f-body text-[13px] font-medium leading-tight" style={{ color: selected ? '#E67E50' : '#0A2E4D' }}>
                        {s.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <StepNavigation
                canNext={canNext[0]}
                onNext={handleNext}
                isFirst
              />
            </div>
          )}

          {/* ── Step 2: Country ─────────────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <p className="f-body text-[13px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: '#E67E50' }}>
                Step 2 — Where to go
              </p>
              <h1 className="f-display text-[32px] md:text-[42px] font-bold mb-2 leading-tight" style={{ color: '#0A2E4D' }}>
                Which country?
              </h1>
              <p className="f-body text-[15px] mb-8" style={{ color: 'rgba(10,46,77,0.55)' }}>
                We operate across Norway, Sweden, and Iceland. Each has its own character.
              </p>

              <div className="flex flex-col gap-3 mb-8">
                {COUNTRIES.map(c => {
                  const selected = country === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCountry(c.id)}
                      className="flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-150"
                      style={{
                        borderColor: selected ? '#E67E50' : 'rgba(10,46,77,0.12)',
                        background:  selected ? 'rgba(230,126,80,0.08)' : '#fff',
                      }}
                    >
                      <span className="text-2xl flex-shrink-0">{c.flag}</span>
                      <div>
                        <div className="f-body text-[15px] font-semibold" style={{ color: selected ? '#E67E50' : '#0A2E4D' }}>
                          {c.label}
                        </div>
                        <div className="f-body text-[13px]" style={{ color: 'rgba(10,46,77,0.45)' }}>
                          {c.desc}
                        </div>
                      </div>
                      {selected && (
                        <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#E67E50' }}>
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              <StepNavigation canNext={canNext[1]} onNext={handleNext} onBack={handleBack} />
            </div>
          )}

          {/* ── Step 3: Trip details ────────────────────────────────────────── */}
          {step === 2 && (
            <div>
              <p className="f-body text-[13px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: '#E67E50' }}>
                Step 3 — Trip details
              </p>
              <h1 className="f-display text-[32px] md:text-[42px] font-bold mb-2 leading-tight" style={{ color: '#0A2E4D' }}>
                Tell us about the trip
              </h1>
              <p className="f-body text-[15px] mb-8" style={{ color: 'rgba(10,46,77,0.55)' }}>
                Rough estimates are fine — we'll refine everything together.
              </p>

              {/* Party size */}
              <div className="mb-6">
                <label className="f-body text-[13px] font-semibold uppercase tracking-[0.08em] block mb-3" style={{ color: '#0A2E4D' }}>
                  Party size
                </label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setPartySize(n => Math.max(1, n - 1))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px] font-light transition-all"
                    style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
                  >
                    −
                  </button>
                  <span className="f-display text-[28px] font-bold w-12 text-center" style={{ color: '#0A2E4D' }}>
                    {partySize}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPartySize(n => Math.min(20, n + 1))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px] font-light transition-all"
                    style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
                  >
                    +
                  </button>
                  <span className="f-body text-[14px]" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    {partySize === 1 ? 'angler' : 'anglers'}
                  </span>
                </div>
              </div>

              {/* Trip type */}
              <div className="mb-6">
                <label className="f-body text-[13px] font-semibold uppercase tracking-[0.08em] block mb-3" style={{ color: '#0A2E4D' }}>
                  Trip type
                </label>
                <div className="flex flex-col gap-2">
                  {TRIP_TYPES.map(t => {
                    const selected = tripType === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTripType(t.id)}
                        className="flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all duration-150"
                        style={{
                          borderColor: selected ? '#E67E50' : 'rgba(10,46,77,0.12)',
                          background:  selected ? 'rgba(230,126,80,0.08)' : '#fff',
                        }}
                      >
                        <div
                          className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                          style={{ borderColor: selected ? '#E67E50' : 'rgba(10,46,77,0.3)', background: selected ? '#E67E50' : 'transparent' }}
                        />
                        <div>
                          <div className="f-body text-[14px] font-semibold" style={{ color: selected ? '#E67E50' : '#0A2E4D' }}>{t.label}</div>
                          <div className="f-body text-[12px]" style={{ color: 'rgba(10,46,77,0.45)' }}>{t.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Duration */}
              <div className="mb-6">
                <label className="f-body text-[13px] font-semibold uppercase tracking-[0.08em] block mb-3" style={{ color: '#0A2E4D' }}>
                  Duration
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map(d => {
                    const selected = duration === d
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDuration(d)}
                        className="px-4 py-2 rounded-xl border-2 f-body text-[14px] font-medium transition-all duration-150"
                        style={{
                          borderColor: selected ? '#E67E50' : 'rgba(10,46,77,0.12)',
                          background:  selected ? '#E67E50' : '#fff',
                          color:       selected ? '#fff' : '#0A2E4D',
                        }}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Approximate dates */}
              <div className="mb-8">
                <label className="f-body text-[13px] font-semibold uppercase tracking-[0.08em] block mb-2" style={{ color: '#0A2E4D' }}>
                  Approximate dates{' '}
                  <span className="font-normal normal-case tracking-normal" style={{ color: 'rgba(10,46,77,0.4)' }}>
                    — optional
                  </span>
                </label>
                <input
                  type="text"
                  value={datesApprox}
                  onChange={e => setDatesApprox(e.target.value)}
                  placeholder="e.g. July 2026, last week of August…"
                  className="w-full px-4 py-3 rounded-xl border-2 f-body text-[15px] outline-none transition-all"
                  style={{
                    borderColor: 'rgba(10,46,77,0.12)',
                    background:  '#fff',
                    color:       '#0A2E4D',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)' }}
                />
              </div>

              <StepNavigation canNext={canNext[2]} onNext={handleNext} onBack={handleBack} />
            </div>
          )}

          {/* ── Step 4: Personal details ─────────────────────────────────────── */}
          {step === 3 && (
            <div>
              <p className="f-body text-[13px] font-semibold uppercase tracking-[0.12em] mb-3" style={{ color: '#E67E50' }}>
                Step 4 — Almost there
              </p>
              <h1 className="f-display text-[32px] md:text-[42px] font-bold mb-2 leading-tight" style={{ color: '#0A2E4D' }}>
                Where do we reach you?
              </h1>
              <p className="f-body text-[15px] mb-8" style={{ color: 'rgba(10,46,77,0.55)' }}>
                We reply within 24 hours. No automated responses — a real person reads every inquiry.
              </p>

              {/* Fields */}
              <div className="flex flex-col gap-4 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Full name"
                    value={name}
                    onChange={setName}
                    placeholder="Jan Kowalski"
                    required
                  />
                  <FormField
                    label="Email address"
                    value={email}
                    onChange={setEmail}
                    placeholder="jan@example.com"
                    type="email"
                    required
                  />
                </div>
                <FormField
                  label="Phone number"
                  value={phone}
                  onChange={setPhone}
                  placeholder="+48 600 000 000"
                  type="tel"
                  optional
                />
                <div>
                  <label className="f-body text-[13px] font-semibold uppercase tracking-[0.08em] block mb-2" style={{ color: '#0A2E4D' }}>
                    Anything else?{' '}
                    <span className="font-normal normal-case tracking-normal" style={{ color: 'rgba(10,46,77,0.4)' }}>— optional</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Specific expectations, must-have experiences, gear you have, budget range…"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 f-body text-[15px] outline-none transition-all resize-none"
                    style={{ borderColor: 'rgba(10,46,77,0.12)', background: '#fff', color: '#0A2E4D' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                    onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)' }}
                  />
                </div>

                {/* Newsletter */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newsletter}
                    onChange={e => setNewsletter(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded accent-[#E67E50] cursor-pointer flex-shrink-0"
                  />
                  <span className="f-body text-[14px]" style={{ color: 'rgba(10,46,77,0.65)' }}>
                    Send me seasonal trip ideas and guide spotlights (max once a month, unsubscribe any time).
                  </span>
                </label>
              </div>

              {/* Error */}
              {error != null && (
                <div
                  className="mb-4 px-4 py-3 rounded-xl f-body text-[14px]"
                  style={{ background: 'rgba(220,50,50,0.08)', color: '#c0392b', border: '1px solid rgba(220,50,50,0.2)' }}
                >
                  {error}
                </div>
              )}

              {/* Summary chips */}
              <div className="mb-6 flex flex-wrap gap-2">
                {species.map(s => (
                  <span key={s} className="px-3 py-1 rounded-full f-body text-[12px] font-medium" style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}>
                    {s}
                  </span>
                ))}
                <span className="px-3 py-1 rounded-full f-body text-[12px] font-medium" style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}>
                  {country}
                </span>
                <span className="px-3 py-1 rounded-full f-body text-[12px] font-medium" style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}>
                  {partySize} {partySize === 1 ? 'angler' : 'anglers'}
                </span>
                <span className="px-3 py-1 rounded-full f-body text-[12px] font-medium" style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}>
                  {duration}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="h-12 px-5 rounded-xl f-body text-[15px] font-medium transition-all"
                  style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canNext[3] || isPending}
                  className="flex-1 h-12 rounded-xl f-body text-[15px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#E67E50' }}
                >
                  {isPending ? 'Sending…' : 'Send my trip plan →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Step indicator dots ──────────────────────────────────────────────── */}
      <div className="flex justify-center items-center gap-2 pb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                background: i === step
                  ? '#E67E50'
                  : i < step
                  ? '#0A2E4D'
                  : 'rgba(10,46,77,0.2)',
                width: i === step ? '8px' : '6px',
                height: i === step ? '8px' : '6px',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepNavigation({
  canNext,
  onNext,
  onBack,
  isFirst = false,
}: {
  canNext:  boolean
  onNext:   () => void
  onBack?:  () => void
  isFirst?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      {!isFirst && onBack != null && (
        <button
          type="button"
          onClick={onBack}
          className="h-12 px-5 rounded-xl f-body text-[15px] font-medium transition-all"
          style={{ background: 'rgba(10,46,77,0.08)', color: '#0A2E4D' }}
        >
          ← Back
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className="flex-1 h-12 rounded-xl f-body text-[15px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: '#E67E50' }}
      >
        Continue →
      </button>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  optional = false,
}: {
  label:       string
  value:       string
  onChange:    (v: string) => void
  placeholder: string
  type?:       string
  required?:   boolean
  optional?:   boolean
}) {
  return (
    <div>
      <label className="f-body text-[13px] font-semibold uppercase tracking-[0.08em] block mb-2" style={{ color: '#0A2E4D' }}>
        {label}{' '}
        {optional && (
          <span className="font-normal normal-case tracking-normal" style={{ color: 'rgba(10,46,77,0.4)' }}>— optional</span>
        )}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3 rounded-xl border-2 f-body text-[15px] outline-none transition-all"
        style={{ borderColor: 'rgba(10,46,77,0.12)', background: '#fff', color: '#0A2E4D' }}
        onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
        onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.12)' }}
      />
    </div>
  )
}
