'use client'

/**
 * GuideOnboarding — shown in dashboard/layout when no guides row exists.
 *
 * 2-step wizard:
 *   Step 1 — Profile info (name, country, city, bio, fish expertise, languages)
 *   Step 2 — Choose subscription plan (flat_fee or commission)
 *
 * On completion → createGuideProfile() → router.refresh() → layout re-fetches
 * the guides row and renders the normal dashboard.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createGuideProfile } from '@/actions/dashboard'

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNTRIES = ['Norway', 'Sweden', 'Finland', 'Iceland', 'Denmark']

const FISH_OPTIONS = [
  'Salmon', 'Sea Trout', 'Brown Trout', 'Arctic Char', 'Rainbow Trout',
  'Grayling', 'Pike', 'Perch', 'Zander', 'Whitefish',
  'Cod', 'Halibut', 'Catfish', 'Burbot',
]

const LANGUAGE_OPTIONS = [
  'English', 'Norwegian', 'Swedish', 'Finnish', 'Danish', 'Icelandic',
  'German', 'Polish', 'French', 'Dutch', 'Russian', 'Spanish',
]

const PLANS = [
  {
    id: 'flat_fee' as const,
    name: 'Listing Plan',
    price: '€20 / month',
    desc: 'Fixed monthly fee. Your profile + contact form visible to anglers. You handle bookings yourself.',
    pill: 'Simple',
    pillColor: '#1B4F72',
    pillBg: 'rgba(27,79,114,0.1)',
  },
  {
    id: 'commission' as const,
    name: 'Bookable Plan',
    price: '10% commission',
    desc: 'We handle online bookings and payments via Stripe. You receive payouts automatically after each trip.',
    pill: 'Full bookings',
    pillColor: '#E67E50',
    pillBg: 'rgba(230,126,80,0.1)',
  },
]

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: '100%',
  background: 'rgba(10,46,77,0.04)',
  border: '1.5px solid rgba(10,46,77,0.1)',
  borderRadius: '14px',
  padding: '13px 16px',
  color: '#0A2E4D',
  fontSize: '14px',
  fontFamily: 'var(--font-dm-sans, DM Sans, sans-serif)',
  outline: 'none',
  transition: 'border-color 0.15s',
}

function Pill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium px-3.5 py-1.5 rounded-full transition-all f-body"
      style={
        active
          ? { background: '#0A2E4D', color: '#fff' }
          : { background: 'rgba(10,46,77,0.06)', color: 'rgba(10,46,77,0.55)', border: '1px solid rgba(10,46,77,0.1)' }
      }
    >
      {label}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GuideOnboarding({ defaultFullName }: { defaultFullName: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<1 | 2>(1)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // ── Step 1 fields ──────────────────────────────────────────────────────────
  const [fullName, setFullName]   = useState(defaultFullName)
  const [country,  setCountry]    = useState('')
  const [city,     setCity]       = useState('')
  const [bio,      setBio]        = useState('')
  const [fishList, setFishList]   = useState<string[]>([])
  const [langList, setLangList]   = useState<string[]>([])
  const [years,    setYears]      = useState('')

  // ── Step 2 fields ──────────────────────────────────────────────────────────
  const [plan, setPlan] = useState<'flat_fee' | 'commission' | ''>('')

  const toggleFish = (f: string) =>
    setFishList(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  const toggleLang = (l: string) =>
    setLangList(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l])

  // ── Step 1 → Step 2 ───────────────────────────────────────────────────────
  const goToStep2 = () => {
    if (!fullName.trim())        { setError('Full name is required.'); return }
    if (!country)                { setError('Country is required.'); return }
    if (fishList.length === 0)   { setError('Select at least one target species.'); return }
    setError(null)
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!plan) { setError('Please choose a plan to continue.'); return }
    setError(null)

    startTransition(async () => {
      const result = await createGuideProfile({
        full_name:        fullName.trim(),
        country,
        city:             city.trim() || undefined,
        bio:              bio.trim() || undefined,
        fish_expertise:   fishList,
        languages:        langList,
        years_experience: years ? parseInt(years, 10) : null,
        pricing_model:    plan,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      setDone(true)
    })
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#F3EDE4' }}>
        <div
          className="w-full text-center px-10 py-14 rounded-3xl"
          style={{
            maxWidth: '540px',
            background: '#FDFAF7',
            border: '1px solid rgba(10,46,77,0.07)',
            boxShadow: '0 8px 40px rgba(10,46,77,0.08)',
          }}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(74,222,128,0.1)', border: '1.5px solid rgba(74,222,128,0.25)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
              <polyline points="20,6 9,17 4,12" />
            </svg>
          </div>
          <p className="text-[11px] uppercase tracking-[0.22em] f-body mb-2" style={{ color: 'rgba(10,46,77,0.38)' }}>
            You&apos;re all set
          </p>
          <h2 className="text-[#0A2E4D] text-2xl font-bold f-display mb-3">
            Welcome to FjordAnglers,{' '}
            <span style={{ fontStyle: 'italic' }}>{fullName.split(' ')[0]}.</span>
          </h2>
          <p className="text-[#0A2E4D]/45 text-sm f-body leading-relaxed mb-8">
            Your guide profile is set up and pending review. While you wait,
            add your first fishing experience — it only takes a few minutes.
          </p>
          <button
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-2 text-white font-semibold text-sm px-7 py-3.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body"
            style={{ background: '#E67E50' }}
          >
            Go to my dashboard →
          </button>
        </div>
      </div>
    )
  }

  // ── Layout shell ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F3EDE4' }}>

      {/* ─── Top bar ────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-8 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(10,46,77,0.07)', background: '#FDFAF7' }}
      >
        <Link href="/">
          <Image src="/brand/dark-logo.png" alt="FjordAnglers" width={140} height={36} className="h-7 w-auto" priority />
        </Link>

        {/* Step indicator */}
        <div className="flex items-center gap-3">
          {([1, 2] as const).map(s => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold f-body transition-all"
                style={
                  step === s
                    ? { background: '#E67E50', color: '#fff' }
                    : step > s
                    ? { background: 'rgba(74,222,128,0.15)', color: '#16A34A' }
                    : { background: 'rgba(10,46,77,0.08)', color: 'rgba(10,46,77,0.35)' }
                }
              >
                {step > s ? '✓' : s}
              </div>
              <span
                className="text-xs f-body hidden sm:block"
                style={{ color: step === s ? '#0A2E4D' : 'rgba(10,46,77,0.38)', fontWeight: step === s ? 600 : 400 }}
              >
                {s === 1 ? 'Your profile' : 'Choose plan'}
              </span>
              {s < 2 && (
                <div className="w-8 h-px hidden sm:block" style={{ background: 'rgba(10,46,77,0.15)' }} />
              )}
            </div>
          ))}
        </div>

        <div className="w-[140px]" /> {/* spacer to center the step indicator */}
      </header>

      {/* ─── Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full" style={{ maxWidth: '640px' }}>

          {/* ─── Step 1: Profile ────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] f-body mb-2" style={{ color: '#E67E50' }}>
                Step 1 of 2
              </p>
              <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-2">
                Tell us about <span style={{ fontStyle: 'italic' }}>yourself</span>
              </h1>
              <p className="text-[#0A2E4D]/45 text-sm f-body leading-relaxed mb-8" style={{ maxWidth: '500px' }}>
                This information will appear on your public guide profile.
                You can always edit it later from your dashboard.
              </p>

              <div
                className="p-8 rounded-3xl flex flex-col gap-6"
                style={{
                  background: '#FDFAF7',
                  border: '1px solid rgba(10,46,77,0.07)',
                  boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
                }}
              >
                {/* Error */}
                {error != null && (
                  <div
                    className="px-4 py-3 rounded-2xl text-sm f-body"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#DC2626' }}
                  >
                    {error}
                  </div>
                )}

                {/* Full name */}
                <div>
                  <label htmlFor="ob-name" className="block text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    Full name <span style={{ color: '#E67E50' }}>*</span>
                  </label>
                  <input
                    id="ob-name"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Erik Bjørnsson"
                    style={inputBase}
                    onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
                  />
                </div>

                {/* Country + City */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ob-country" className="block text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      Country <span style={{ color: '#E67E50' }}>*</span>
                    </label>
                    <select
                      id="ob-country"
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                      style={{ ...inputBase, appearance: 'none', cursor: 'pointer' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ob-city" className="block text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                      City / Region
                    </label>
                    <input
                      id="ob-city"
                      type="text"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      placeholder="Bergen"
                      style={inputBase}
                      onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
                    />
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label htmlFor="ob-bio" className="block text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    Bio
                    <span className="ml-2 normal-case tracking-normal font-normal" style={{ color: 'rgba(10,46,77,0.35)' }}>
                      — what makes you unique as a guide?
                    </span>
                  </label>
                  <textarea
                    id="ob-bio"
                    rows={4}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Born and raised in the fjords of Western Norway, I have been guiding fishing expeditions for over 15 years…"
                    style={{ ...inputBase, resize: 'none' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
                  />
                </div>

                {/* Fish expertise */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3 f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    Target species <span style={{ color: '#E67E50' }}>*</span>
                    {fishList.length > 0 && (
                      <span className="ml-2 normal-case tracking-normal font-normal" style={{ color: '#E67E50' }}>
                        · {fishList.length} selected
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {FISH_OPTIONS.map(f => (
                      <Pill key={f} label={f} active={fishList.includes(f)} onClick={() => toggleFish(f)} />
                    ))}
                  </div>
                </div>

                {/* Languages */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3 f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    Languages spoken
                    {langList.length > 0 && (
                      <span className="ml-2 normal-case tracking-normal font-normal" style={{ color: 'rgba(10,46,77,0.45)' }}>
                        · {langList.length} selected
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGE_OPTIONS.map(l => (
                      <Pill key={l} label={l} active={langList.includes(l)} onClick={() => toggleLang(l)} />
                    ))}
                  </div>
                </div>

                {/* Years experience */}
                <div style={{ maxWidth: '200px' }}>
                  <label htmlFor="ob-years" className="block text-[10px] font-bold uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.45)' }}>
                    Years of experience
                  </label>
                  <input
                    id="ob-years"
                    type="number"
                    min="1"
                    max="60"
                    value={years}
                    onChange={e => setYears(e.target.value)}
                    placeholder="10"
                    style={inputBase}
                    onFocus={e => { e.currentTarget.style.borderColor = '#E67E50' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }}
                  />
                </div>
              </div>

              {/* CTA */}
              <div className="mt-6 flex items-center justify-between">
                <p className="text-xs f-body" style={{ color: 'rgba(10,46,77,0.35)' }}>
                  Step 1 of 2 — profile details
                </p>
                <button
                  type="button"
                  onClick={goToStep2}
                  className="flex items-center gap-2 text-white font-semibold text-sm px-7 py-3.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body"
                  style={{ background: '#E67E50' }}
                >
                  Continue to plan →
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Choose plan ─────────────────────────────────── */}
          {step === 2 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] f-body mb-2" style={{ color: '#E67E50' }}>
                Step 2 of 2
              </p>
              <h1 className="text-[#0A2E4D] text-3xl font-bold f-display mb-2">
                Choose your <span style={{ fontStyle: 'italic' }}>plan</span>
              </h1>
              <p className="text-[#0A2E4D]/45 text-sm f-body leading-relaxed mb-8" style={{ maxWidth: '500px' }}>
                You can change your plan later. Both options give you a full public profile
                and the ability to add fishing experiences.
              </p>

              {/* Error */}
              {error != null && (
                <div
                  className="px-4 py-3 rounded-2xl text-sm f-body mb-5"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#DC2626' }}
                >
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-4 mb-6">
                {PLANS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    className="text-left p-6 rounded-3xl transition-all"
                    style={{
                      background: plan === p.id ? 'rgba(230,126,80,0.06)' : '#FDFAF7',
                      border: plan === p.id
                        ? '2px solid rgba(230,126,80,0.4)'
                        : '2px solid rgba(10,46,77,0.07)',
                      boxShadow: plan === p.id
                        ? '0 4px 24px rgba(230,126,80,0.12)'
                        : '0 2px 16px rgba(10,46,77,0.05)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        {/* Radio */}
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                          style={{
                            border: plan === p.id ? '5px solid #E67E50' : '2px solid rgba(10,46,77,0.2)',
                            background: 'transparent',
                          }}
                        />
                        <div>
                          <p className="text-[#0A2E4D] text-base font-bold f-display leading-tight">{p.name}</p>
                          <p className="text-sm font-semibold f-body mt-0.5" style={{ color: '#E67E50' }}>{p.price}</p>
                        </div>
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full flex-shrink-0 f-body"
                        style={{ background: p.pillBg, color: p.pillColor }}
                      >
                        {p.pill}
                      </span>
                    </div>
                    <p className="text-sm f-body leading-relaxed ml-8" style={{ color: 'rgba(10,46,77,0.55)' }}>
                      {p.desc}
                    </p>
                  </button>
                ))}
              </div>

              {/* Founding guide note */}
              <div
                className="px-5 py-4 rounded-2xl mb-6 flex items-start gap-3"
                style={{ background: 'rgba(27,79,114,0.06)', border: '1px solid rgba(27,79,114,0.12)' }}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#1B4F72" strokeWidth="1.4" className="flex-shrink-0 mt-0.5">
                  <circle cx="7.5" cy="7.5" r="6" />
                  <line x1="7.5" y1="4.5" x2="7.5" y2="8" />
                  <circle cx="7.5" cy="10.5" r="0.5" fill="#1B4F72" />
                </svg>
                <p className="text-xs f-body leading-relaxed" style={{ color: 'rgba(27,79,114,0.8)' }}>
                  <strong>Founding Guide offer:</strong> First 50 guides get 3 months free + 8% commission for life.
                  We&apos;ll reach out to confirm your spot after reviewing your profile.
                </p>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(null) }}
                  className="text-sm font-medium f-body transition-colors hover:text-[#0A2E4D]"
                  style={{ color: 'rgba(10,46,77,0.45)' }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="flex items-center gap-2 text-white font-semibold text-sm px-7 py-3.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:scale-100 disabled:cursor-not-allowed f-body"
                  style={{ background: '#E67E50' }}
                >
                  {isPending ? (
                    <>
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="7" cy="7" r="5" strokeOpacity="0.25" />
                        <path d="M7 2a5 5 0 015 5" strokeLinecap="round" />
                      </svg>
                      Setting up…
                    </>
                  ) : (
                    'Complete setup →'
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

    </div>
  )
}
