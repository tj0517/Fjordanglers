'use client'

/**
 * OnboardingWizard — multi-step guide application form.
 *
 * Flow:
 *   Plan selection → About You → Expertise → Your Story → Review → Success
 *
 * Uses react-hook-form + zod for validation.
 * Submits via the submitGuideApplication Server Action.
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { submitGuideApplication } from '@/actions/guide-apply'

// ─── DATA CONSTANTS ────────────────────────────────────────────────────────────

const COUNTRIES = [
  'Norway',
  'Sweden',
  'Finland',
  'Denmark',
  'Iceland',
  'Estonia',
  'Latvia',
  'Lithuania',
  'Germany',
  'Poland',
  'Netherlands',
  'Belgium',
  'France',
  'United Kingdom',
  'Austria',
  'Switzerland',
  'Czech Republic',
  'Slovakia',
]

const FISH_TYPES = [
  'Salmon',
  'Sea Trout',
  'Brown Trout',
  'Arctic Char',
  'Grayling',
  'Rainbow Trout',
  'Pike',
  'Perch',
  'Zander',
  'Cod',
  'Halibut',
  'Catfish',
]

const LANGUAGES = [
  'English',
  'Norwegian',
  'Swedish',
  'Finnish',
  'Danish',
  'German',
  'Polish',
  'Dutch',
  'French',
  'Russian',
  'Italian',
  'Spanish',
]

const EXPERIENCE_OPTIONS = [
  { value: '1-2', label: '1–2 years' },
  { value: '3-5', label: '3–5 years' },
  { value: '5-10', label: '5–10 years' },
  { value: '10-15', label: '10–15 years' },
  { value: '15+', label: '15+ years' },
]

type PlanId = 'listing' | 'bookable' | 'founding'

const PLANS: {
  id: PlanId
  name: string
  price: string
  sub: string
  desc: string
  features: string[]
  badge: string | null
  highlight: boolean
}[] = [
  {
    id: 'listing',
    name: 'Listing',
    price: '€20',
    sub: '/month',
    desc: 'Your verified profile with a contact form. Anglers reach out directly — no booking flow, no commissions.',
    features: [
      'Guide profile page',
      'Contact form',
      'Verification badge',
      'Species & location tags',
    ],
    badge: null,
    highlight: false,
  },
  {
    id: 'bookable',
    name: 'Bookable',
    price: '10%',
    sub: 'per booking',
    desc: 'Everything in Listing, plus a full booking engine with calendar, online payments, and Stripe payouts.',
    features: [
      'Everything in Listing',
      'Online booking & calendar',
      'Stripe payouts',
      'Reviews system',
    ],
    badge: 'Most popular',
    highlight: true,
  },
  {
    id: 'founding',
    name: 'Founding Guide',
    price: '8%',
    sub: 'forever',
    desc: 'Join our first 50 guides. 3 months free, then our lowest commission rate — locked in for life.',
    features: [
      'Everything in Bookable',
      '3 months FREE',
      '8% commission forever',
      'Founding badge',
    ],
    badge: '23 spots left',
    highlight: false,
  },
]

// ─── ZOD SCHEMA ───────────────────────────────────────────────────────────────

const schema = z.object({
  full_name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string(),
  country: z.string().min(1, 'Select your country'),
  city: z.string(),
  years_experience: z.string().min(1, 'Select your experience level'),
  fish_types: z.array(z.string()).min(1, 'Select at least one species'),
  languages: z.array(z.string()).min(1, 'Select at least one language'),
  bio: z
    .string()
    .min(50, 'Bio must be at least 50 characters')
    .max(1000, 'Bio must be under 1000 characters'),
  certifications: z.string(),
  instagram: z.string(),
  youtube: z.string(),
  website: z.string(),
})

type FormData = z.infer<typeof schema>

// ─── WIZARD STEP CONFIG ────────────────────────────────────────────────────────

const STEPS = ['About You', 'Expertise', 'Story', 'Review'] as const
type StepLabel = (typeof STEPS)[number]

// Fields to validate before advancing each step
const STEP_FIELDS: Partial<Record<StepLabel, (keyof FormData)[]>> = {
  'About You': ['full_name', 'email', 'country'],
  Expertise: ['years_experience', 'fish_types', 'languages'],
  Story: ['bio'],
}

// ─── SCREEN STATE ─────────────────────────────────────────────────────────────

type Screen =
  | { type: 'plan' }
  | { type: 'form'; plan: PlanId; step: number }
  | { type: 'success' }

// ─── INPUT STYLES (light mode) ────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: 'rgba(10,46,77,0.04)',
  border: '1px solid rgba(10,46,77,0.12)',
  color: '#0A2E4D',
  outline: 'none',
}

const inputError: React.CSSProperties = {
  ...inputBase,
  border: '1px solid rgba(239,68,68,0.5)',
}

const inputFocusOn = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
  el.style.borderColor = 'rgba(230,126,80,0.55)'
}
const inputFocusOff = (
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  hasError: boolean,
) => {
  el.style.borderColor = hasError ? 'rgba(239,68,68,0.5)' : 'rgba(10,46,77,0.12)'
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const [screen, setScreen] = useState<Screen>({ type: 'plan' })
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      country: '',
      city: '',
      years_experience: '',
      fish_types: [],
      languages: [],
      bio: '',
      certifications: '',
      instagram: '',
      youtube: '',
      website: '',
    },
  })

  // Reactive watches (drive pill UI)
  const fishTypes = watch('fish_types')
  const languages = watch('languages')
  const bio = watch('bio')
  const yearsExp = watch('years_experience')

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const togglePill = (field: 'fish_types' | 'languages', value: string) => {
    const current = getValues(field)
    setValue(
      field,
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      { shouldValidate: true },
    )
  }

  const selectPlan = (plan: PlanId) => {
    setScreen({ type: 'form', plan, step: 0 })
  }

  const goNext = async () => {
    if (screen.type !== 'form') return
    const stepLabel = STEPS[screen.step] as StepLabel | undefined
    const fields = stepLabel !== undefined ? STEP_FIELDS[stepLabel] : undefined
    if (fields !== undefined) {
      const valid = await trigger(fields as Parameters<typeof trigger>[0])
      if (!valid) return
    }
    if (screen.step < STEPS.length - 1) {
      setScreen({ type: 'form', plan: screen.plan, step: screen.step + 1 })
    }
  }

  const goBack = () => {
    if (screen.type !== 'form') return
    if (screen.step === 0) {
      setScreen({ type: 'plan' })
    } else {
      setScreen({ type: 'form', plan: screen.plan, step: screen.step - 1 })
    }
  }

  const onSubmit = async (data: FormData) => {
    if (screen.type !== 'form') return
    setSubmitting(true)
    setServerError(null)

    const result = await submitGuideApplication({
      plan: screen.plan,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      country: data.country,
      city: data.city,
      years_experience: data.years_experience,
      fish_types: data.fish_types,
      languages: data.languages,
      bio: data.bio,
      certifications: data.certifications,
      instagram: data.instagram,
      youtube: data.youtube,
      website: data.website,
    })

    setSubmitting(false)

    if (result.success) {
      setScreen({ type: 'success' })
    } else {
      setServerError(result.error)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (screen.type === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-8"
          style={{
            background: 'rgba(230,126,80,0.12)',
            border: '1px solid rgba(230,126,80,0.25)',
          }}
        >
          <span className="text-4xl">🎣</span>
        </div>

        <span
          className="text-[11px] font-bold uppercase tracking-[0.22em] px-4 py-1.5 rounded-full mb-6 f-body"
          style={{
            background: 'rgba(230,126,80,0.12)',
            color: '#E67E50',
            border: '1px solid rgba(230,126,80,0.2)',
          }}
        >
          Application received
        </span>

        <h2 className="text-[#0A2E4D] text-4xl font-bold mb-4 f-display">
          Welcome to FjordAnglers.
        </h2>

        <p
          className="text-base leading-relaxed f-body"
          style={{ color: 'rgba(10,46,77,0.55)', maxWidth: '380px' }}
        >
          We&apos;ll review your profile and get back to you within 48 hours. Keep an eye on your
          inbox.
        </p>

        <a
          href="/"
          className="mt-10 inline-flex items-center gap-2 text-white text-sm font-semibold px-7 py-3.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] f-body"
          style={{ background: '#E67E50' }}
        >
          Back to home
        </a>
      </div>
    )
  }

  // ── Plan selection ────────────────────────────────────────────────────────

  if (screen.type === 'plan') {
    return (
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Section header */}
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-6 h-px" style={{ background: '#E67E50' }} />
            <p
              className="text-xs font-semibold uppercase tracking-[0.25em] f-body"
              style={{ color: '#E67E50' }}
            >
              Join FjordAnglers
            </p>
            <div className="w-6 h-px" style={{ background: '#E67E50' }} />
          </div>
          <h2
            className="text-[#0A2E4D] font-bold mb-4 f-display"
            style={{ fontSize: '48px', lineHeight: 1.08, fontStyle: 'italic' }}
          >
            Choose your plan
          </h2>
          <p className="text-base f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
            Start free, scale when you&apos;re ready. No lock-in.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => selectPlan(plan.id)}
              className="text-left relative rounded-3xl p-8 flex flex-col gap-5 transition-all duration-200 hover:-translate-y-1.5 focus-visible:outline-none group"
              style={
                plan.highlight
                  ? {
                      background: '#0A2E4D',
                      border: '1px solid rgba(10,46,77,0.15)',
                      boxShadow: '0 16px 48px rgba(10,46,77,0.18)',
                    }
                  : {
                      background: '#FDFAF7',
                      border: '1px solid rgba(10,46,77,0.07)',
                      boxShadow: '0 2px 16px rgba(10,46,77,0.05)',
                    }
              }
            >
              {/* Badge */}
              {plan.badge !== null && (
                <span
                  className="absolute top-6 right-6 text-[10px] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full f-body"
                  style={
                    plan.highlight
                      ? { background: '#E67E50', color: 'white' }
                      : {
                          background: 'rgba(230,126,80,0.12)',
                          color: '#E67E50',
                          border: '1px solid rgba(230,126,80,0.28)',
                        }
                  }
                >
                  {plan.badge}
                </span>
              )}

              {/* Price */}
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-3 f-body"
                  style={{
                    color: plan.highlight ? 'rgba(255,255,255,0.55)' : 'rgba(10,46,77,0.45)',
                  }}
                >
                  {plan.name}
                </p>
                <div className="flex items-end gap-1.5">
                  <span
                    className="text-[42px] font-bold leading-none f-display"
                    style={{ color: plan.highlight ? 'white' : '#0A2E4D' }}
                  >
                    {plan.price}
                  </span>
                  <span
                    className="text-sm mb-1.5 f-body"
                    style={{
                      color: plan.highlight ? 'rgba(255,255,255,0.5)' : 'rgba(10,46,77,0.45)',
                    }}
                  >
                    {plan.sub}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p
                className="text-sm leading-relaxed f-body"
                style={{
                  color: plan.highlight ? 'rgba(255,255,255,0.65)' : 'rgba(10,46,77,0.6)',
                }}
              >
                {plan.desc}
              </p>

              {/* Features */}
              <ul className="flex flex-col gap-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      className="text-xs mt-0.5 flex-shrink-0"
                      style={{ color: plan.highlight ? 'rgba(255,255,255,0.7)' : '#E67E50' }}
                    >
                      ✓
                    </span>
                    <span
                      className="text-sm f-body"
                      style={{
                        color: plan.highlight ? 'rgba(255,255,255,0.7)' : 'rgba(10,46,77,0.65)',
                      }}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA row */}
              <div
                className="mt-auto pt-5 flex items-center justify-between"
                style={{
                  borderTop: `1px solid ${plan.highlight ? 'rgba(255,255,255,0.14)' : 'rgba(10,46,77,0.07)'}`,
                }}
              >
                <span
                  className="text-sm font-semibold f-body group-hover:gap-3 transition-all"
                  style={{ color: plan.highlight ? 'white' : '#0A2E4D' }}
                >
                  Get started →
                </span>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-xs mt-8 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
          Not sure which plan fits you? Start with Listing and upgrade anytime.
        </p>
      </div>
    )
  }

  // ── Form wizard ───────────────────────────────────────────────────────────
  // TypeScript narrows: screen.type === 'form' at this point

  const { step, plan } = screen
  const isReview = step === STEPS.length - 1
  const selectedPlan = PLANS.find((p) => p.id === plan)

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">

      {/* ── Progress header ──────────────────────────────────────── */}
      <div className="mb-10">
        {/* Top row: back link + plan badge */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-sm font-medium transition-colors f-body"
            style={{ color: 'rgba(10,46,77,0.4)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(10,46,77,0.75)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(10,46,77,0.4)' }}
          >
            ← Back
          </button>

          {selectedPlan !== undefined && (
            <span
              className="text-[10px] font-bold uppercase tracking-[0.18em] px-3.5 py-1.5 rounded-full f-body"
              style={{
                background: 'rgba(230,126,80,0.1)',
                color: '#E67E50',
                border: '1px solid rgba(230,126,80,0.2)',
              }}
            >
              {selectedPlan.name} — {selectedPlan.price}
              {selectedPlan.sub}
            </span>
          )}
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              {/* Circle */}
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all duration-300 flex-shrink-0 f-body"
                style={
                  i < step
                    ? { background: '#E67E50', color: 'white' }
                    : i === step
                    ? {
                        background: 'rgba(230,126,80,0.18)',
                        color: '#E67E50',
                        border: '1px solid rgba(230,126,80,0.45)',
                      }
                    : {
                        background: 'rgba(10,46,77,0.06)',
                        color: 'rgba(10,46,77,0.3)',
                        border: '1px solid rgba(10,46,77,0.1)',
                      }
                }
              >
                {i < step ? '✓' : i + 1}
              </div>

              {/* Label — hidden on small screens */}
              <span
                className="text-xs ml-2 mr-1 f-body hidden sm:block"
                style={{
                  color:
                    i === step ? '#0A2E4D' : 'rgba(10,46,77,0.35)',
                }}
              >
                {s}
              </span>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className="mx-2 flex-shrink-0 transition-all duration-300"
                  style={{
                    width: '28px',
                    height: '1px',
                    background: i < step ? '#E67E50' : 'rgba(10,46,77,0.1)',
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Current step title */}
        <h2 className="text-[#0A2E4D] text-3xl font-bold f-display">{STEPS[step]}</h2>
      </div>

      {/* ── Form card ─────────────────────────────────────────────── */}
      <div
        className="p-8 rounded-3xl"
        style={{
          background: '#FDFAF7',
          border: '1px solid rgba(10,46,77,0.08)',
          boxShadow: '0 8px 40px rgba(10,46,77,0.08)',
        }}
      >

        {/* ── STEP 0: About You ──────────────────────────────────── */}
        {step === 0 && (
          <div className="flex flex-col gap-5">

            {/* Full name */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Full Name <span style={{ color: '#E67E50' }}>*</span>
              </label>
              <input
                {...register('full_name')}
                type="text"
                placeholder="Erik Bjørnsson"
                className="w-full px-4 py-3 rounded-xl text-sm f-body"
                style={errors.full_name !== undefined ? inputError : inputBase}
                onFocus={(e) => inputFocusOn(e.currentTarget)}
                onBlur={(e) => inputFocusOff(e.currentTarget, errors.full_name !== undefined)}
              />
              {errors.full_name !== undefined && (
                <p className="mt-1.5 text-xs f-body" style={{ color: '#E67E50' }}>
                  {errors.full_name.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Email <span style={{ color: '#E67E50' }}>*</span>
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder="erik@fjordfishing.no"
                className="w-full px-4 py-3 rounded-xl text-sm f-body"
                style={errors.email !== undefined ? inputError : inputBase}
                onFocus={(e) => inputFocusOn(e.currentTarget)}
                onBlur={(e) => inputFocusOff(e.currentTarget, errors.email !== undefined)}
              />
              {errors.email !== undefined && (
                <p className="mt-1.5 text-xs f-body" style={{ color: '#E67E50' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Phone{' '}
                <span className="normal-case tracking-normal" style={{ color: 'rgba(10,46,77,0.3)' }}>
                  (optional)
                </span>
              </label>
              <input
                {...register('phone')}
                type="tel"
                placeholder="+47 900 00 000"
                className="w-full px-4 py-3 rounded-xl text-sm f-body"
                style={inputBase}
                onFocus={(e) => inputFocusOn(e.currentTarget)}
                onBlur={(e) => inputFocusOff(e.currentTarget, false)}
              />
            </div>

            {/* Country + City */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  Country <span style={{ color: '#E67E50' }}>*</span>
                </label>
                <select
                  {...register('country')}
                  className="w-full px-4 py-3 rounded-xl text-sm f-body appearance-none cursor-pointer"
                  style={errors.country !== undefined ? inputError : inputBase}
                  onFocus={(e) => inputFocusOn(e.currentTarget)}
                  onBlur={(e) => inputFocusOff(e.currentTarget, errors.country !== undefined)}
                >
                  <option value="" className="bg-[#FDFAF7]">
                    Select country
                  </option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c} className="bg-[#FDFAF7]">
                      {c}
                    </option>
                  ))}
                </select>
                {errors.country !== undefined && (
                  <p className="mt-1.5 text-xs f-body" style={{ color: '#E67E50' }}>
                    {errors.country.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  City{' '}
                  <span className="normal-case tracking-normal" style={{ color: 'rgba(10,46,77,0.3)' }}>
                    (optional)
                  </span>
                </label>
                <input
                  {...register('city')}
                  type="text"
                  placeholder="Bergen"
                  className="w-full px-4 py-3 rounded-xl text-sm f-body"
                  style={inputBase}
                  onFocus={(e) => inputFocusOn(e.currentTarget)}
                  onBlur={(e) => inputFocusOff(e.currentTarget, false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 1: Expertise ──────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-7">

            {/* Years of experience */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.18em] mb-3 f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Years of guiding experience <span style={{ color: '#E67E50' }}>*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_OPTIONS.map((opt) => {
                  const selected = yearsExp === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setValue('years_experience', opt.value, { shouldValidate: true })
                      }
                      className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-150 f-body"
                      style={
                        selected
                          ? { background: '#E67E50', color: 'white' }
                          : {
                              background: 'rgba(10,46,77,0.05)',
                              color: 'rgba(10,46,77,0.55)',
                              border: '1px solid rgba(10,46,77,0.1)',
                            }
                      }
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {errors.years_experience !== undefined && (
                <p className="mt-2 text-xs f-body" style={{ color: '#E67E50' }}>
                  {errors.years_experience.message}
                </p>
              )}
            </div>

            {/* Target species */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.18em] mb-3 f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Target species <span style={{ color: '#E67E50' }}>*</span>
                {fishTypes.length > 0 && (
                  <span
                    className="ml-2 normal-case tracking-normal font-normal"
                    style={{ color: '#E67E50' }}
                  >
                    · {fishTypes.length} selected
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {FISH_TYPES.map((fish) => {
                  const selected = fishTypes.includes(fish)
                  return (
                    <button
                      key={fish}
                      type="button"
                      onClick={() => togglePill('fish_types', fish)}
                      className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 f-body"
                      style={
                        selected
                          ? {
                              background: 'rgba(230,126,80,0.18)',
                              color: '#E67E50',
                              border: '1px solid rgba(230,126,80,0.4)',
                            }
                          : {
                              background: 'rgba(10,46,77,0.05)',
                              color: 'rgba(10,46,77,0.5)',
                              border: '1px solid rgba(10,46,77,0.1)',
                            }
                      }
                    >
                      {fish}
                    </button>
                  )
                })}
              </div>
              {errors.fish_types !== undefined && (
                <p className="mt-2 text-xs f-body" style={{ color: '#E67E50' }}>
                  {errors.fish_types.message}
                </p>
              )}
            </div>

            {/* Languages */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.18em] mb-3 f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Languages spoken <span style={{ color: '#E67E50' }}>*</span>
                {languages.length > 0 && (
                  <span
                    className="ml-2 normal-case tracking-normal font-normal"
                    style={{ color: '#E67E50' }}
                  >
                    · {languages.length} selected
                  </span>
                )}
              </label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => {
                  const selected = languages.includes(lang)
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => togglePill('languages', lang)}
                      className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 f-body"
                      style={
                        selected
                          ? {
                              background: 'rgba(230,126,80,0.18)',
                              color: '#E67E50',
                              border: '1px solid rgba(230,126,80,0.4)',
                            }
                          : {
                              background: 'rgba(10,46,77,0.05)',
                              color: 'rgba(10,46,77,0.5)',
                              border: '1px solid rgba(10,46,77,0.1)',
                            }
                      }
                    >
                      {lang}
                    </button>
                  )
                })}
              </div>
              {errors.languages !== undefined && (
                <p className="mt-2 text-xs f-body" style={{ color: '#E67E50' }}>
                  {errors.languages.message}
                </p>
              )}
            </div>

            {/* Certifications */}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.18em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Certifications & licenses{' '}
                <span className="normal-case tracking-normal" style={{ color: 'rgba(10,46,77,0.3)' }}>
                  (optional)
                </span>
              </label>
              <input
                {...register('certifications')}
                type="text"
                placeholder="Norwegian Fishing Guide License, First Aid Cert…"
                className="w-full px-4 py-3 rounded-xl text-sm f-body"
                style={inputBase}
                onFocus={(e) => inputFocusOn(e.currentTarget)}
                onBlur={(e) => inputFocusOff(e.currentTarget, false)}
              />
            </div>
          </div>
        )}

        {/* ── STEP 2: Story ──────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col gap-6">

            {/* Bio */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] uppercase tracking-[0.18em] f-body" style={{ color: 'rgba(10,46,77,0.5)' }}>
                  About you <span style={{ color: '#E67E50' }}>*</span>
                </label>
                <span
                  className="text-xs f-body"
                  style={{ color: bio.length > 900 ? '#E67E50' : 'rgba(10,46,77,0.28)' }}
                >
                  {bio.length} / 1000
                </span>
              </div>
              <textarea
                {...register('bio')}
                rows={6}
                placeholder="Tell anglers about yourself — your home waters, guiding philosophy, what makes a day on the water special for you…"
                className="w-full px-4 py-3 rounded-xl text-sm f-body leading-relaxed resize-none"
                style={errors.bio !== undefined ? inputError : inputBase}
                onFocus={(e) => inputFocusOn(e.currentTarget)}
                onBlur={(e) => inputFocusOff(e.currentTarget, errors.bio !== undefined)}
              />
              {errors.bio !== undefined ? (
                <p className="mt-1.5 text-xs f-body" style={{ color: '#E67E50' }}>
                  {errors.bio.message}
                </p>
              ) : bio.length > 0 && bio.length < 50 ? (
                <p className="mt-1.5 text-xs f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                  {50 - bio.length} more characters needed
                </p>
              ) : null}
            </div>

            {/* Online presence */}
            <div
              className="pt-5"
              style={{ borderTop: '1px solid rgba(10,46,77,0.08)' }}
            >
              <p className="text-[11px] uppercase tracking-[0.18em] mb-4 f-body" style={{ color: 'rgba(10,46,77,0.38)' }}>
                Online presence{' '}
                <span className="normal-case tracking-normal" style={{ color: 'rgba(10,46,77,0.25)' }}>
                  (optional — helps anglers find you)
                </span>
              </p>

              <div className="flex flex-col gap-3">
                {/* Instagram */}
                <div className="relative">
                  <span
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-sm select-none f-body"
                    style={{ color: 'rgba(10,46,77,0.28)' }}
                  >
                    @
                  </span>
                  <input
                    {...register('instagram')}
                    type="text"
                    placeholder="your.fishing.handle"
                    className="w-full pl-8 pr-24 py-3 rounded-xl text-sm f-body"
                    style={inputBase}
                    onFocus={(e) => inputFocusOn(e.currentTarget)}
                    onBlur={(e) => inputFocusOff(e.currentTarget, false)}
                  />
                  <span
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs f-body"
                    style={{ color: 'rgba(10,46,77,0.28)' }}
                  >
                    Instagram
                  </span>
                </div>

                {/* YouTube */}
                <div className="relative">
                  <input
                    {...register('youtube')}
                    type="url"
                    placeholder="https://youtube.com/@yourchannel"
                    className="w-full px-4 pr-24 py-3 rounded-xl text-sm f-body"
                    style={inputBase}
                    onFocus={(e) => inputFocusOn(e.currentTarget)}
                    onBlur={(e) => inputFocusOff(e.currentTarget, false)}
                  />
                  <span
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs f-body"
                    style={{ color: 'rgba(10,46,77,0.28)' }}
                  >
                    YouTube
                  </span>
                </div>

                {/* Website */}
                <div className="relative">
                  <input
                    {...register('website')}
                    type="url"
                    placeholder="https://yourwebsite.com"
                    className="w-full px-4 pr-24 py-3 rounded-xl text-sm f-body"
                    style={inputBase}
                    onFocus={(e) => inputFocusOn(e.currentTarget)}
                    onBlur={(e) => inputFocusOff(e.currentTarget, false)}
                  />
                  <span
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs f-body"
                    style={{ color: 'rgba(10,46,77,0.28)' }}
                  >
                    Website
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Review ─────────────────────────────────────── */}
        {step === 3 && (() => {
          const values = getValues()
          const rows: { label: string; value: string }[] = [
            {
              label: 'Plan',
              value: selectedPlan
                ? `${selectedPlan.name} — ${selectedPlan.price}${selectedPlan.sub}`
                : '',
            },
            { label: 'Name', value: values.full_name },
            { label: 'Email', value: values.email },
            { label: 'Phone', value: values.phone },
            {
              label: 'Location',
              value: [values.city, values.country].filter(Boolean).join(', '),
            },
            { label: 'Experience', value: values.years_experience },
            { label: 'Species', value: values.fish_types.join(', ') },
            { label: 'Languages', value: values.languages.join(', ') },
            { label: 'Certifications', value: values.certifications },
          ]

          return (
            <div className="flex flex-col gap-1">
              <p className="text-sm f-body mb-4" style={{ color: 'rgba(10,46,77,0.5)' }}>
                Review your details before submitting.
              </p>

              {/* Summary table */}
              <div className="flex flex-col">
                {rows
                  .filter((r) => r.value !== '')
                  .map((r) => (
                    <div
                      key={r.label}
                      className="flex items-start justify-between gap-6 py-3"
                      style={{ borderBottom: '1px solid rgba(10,46,77,0.06)' }}
                    >
                      <span
                        className="text-[10px] uppercase tracking-[0.15em] flex-shrink-0 f-body"
                        style={{ color: 'rgba(10,46,77,0.35)', minWidth: '90px' }}
                      >
                        {r.label}
                      </span>
                      <span
                        className="text-sm text-right leading-snug f-body"
                        style={{ color: '#0A2E4D' }}
                      >
                        {r.value}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Bio preview */}
              {values.bio !== '' && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(10,46,77,0.07)' }}>
                  <p
                    className="text-[10px] uppercase tracking-[0.15em] mb-2 f-body"
                    style={{ color: 'rgba(10,46,77,0.35)' }}
                  >
                    Bio
                  </p>
                  <p
                    className="text-sm leading-relaxed f-body line-clamp-5"
                    style={{ color: 'rgba(10,46,77,0.7)' }}
                  >
                    {values.bio}
                  </p>
                </div>
              )}

              {/* Server error */}
              {serverError !== null && (
                <div
                  className="mt-4 px-4 py-3 rounded-xl text-sm f-body"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    color: '#DC2626',
                    border: '1px solid rgba(239,68,68,0.18)',
                  }}
                >
                  {serverError}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* ── Navigation footer ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mt-6 gap-4">
        <button
          type="button"
          onClick={goBack}
          className="text-sm font-medium px-5 py-3 rounded-full transition-colors f-body"
          style={{
            color: 'rgba(10,46,77,0.4)',
            border: '1px solid rgba(10,46,77,0.1)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(10,46,77,0.75)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(10,46,77,0.4)' }}
        >
          ← Back
        </button>

        {isReview ? (
          <button
            type="button"
            onClick={() => { void handleSubmit(onSubmit)() }}
            disabled={submitting}
            className="flex items-center gap-2.5 text-white text-sm font-semibold px-8 py-3.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:brightness-100"
            style={{ background: '#E67E50' }}
          >
            {submitting ? (
              <>
                <span
                  className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
                  style={{ borderTopColor: 'white' }}
                />
                Submitting…
              </>
            ) : (
              'Submit application →'
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { void goNext() }}
            className="text-white text-sm font-semibold px-8 py-3.5 rounded-full transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] f-body"
            style={{ background: '#E67E50' }}
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  )
}
