'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setupPayoutAccount } from '@/actions/stripe-connect'
import type { SetupPayoutInput } from '@/actions/stripe-connect'

// ─── Country list (Stripe-supported EEA + UK countries relevant for fishing guides) ─

const COUNTRIES = [
  { code: 'NO', name: 'Norway' },
  { code: 'SE', name: 'Sweden' },
  { code: 'FI', name: 'Finland' },
  { code: 'IS', name: 'Iceland' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'PL', name: 'Poland' },
  { code: 'DE', name: 'Germany' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'PT', name: 'Portugal' },
  { code: 'IT', name: 'Italy' },
  { code: 'HR', name: 'Croatia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'HU', name: 'Hungary' },
  { code: 'RO', name: 'Romania' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'GR', name: 'Greece' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
] as const

const DOB_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ─── Types ──────────────────────────────────────────────────────────────────────

type Fields = {
  firstName:         string
  lastName:          string
  dobDay:            string
  dobMonth:          string
  dobYear:           string
  addressLine1:      string
  addressCity:       string
  addressPostalCode: string
  country:           string
  iban:              string
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function BankAccountForm({ initialCountry }: { initialCountry: string }) {
  const router                      = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError]           = useState<string | null>(null)
  const [done, setDone]             = useState(false)

  const defaultCountry = COUNTRIES.some(c => c.code === initialCountry) ? initialCountry : 'NO'

  const [f, setF] = useState<Fields>({
    firstName:         '',
    lastName:          '',
    dobDay:            '',
    dobMonth:          '',
    dobYear:           '',
    addressLine1:      '',
    addressCity:       '',
    addressPostalCode: '',
    country:           defaultCountry,
    iban:              '',
  })

  // ── Field updater ──────────────────────────────────────────────────────────
  function set(field: keyof Fields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF(prev => ({ ...prev, [field]: e.target.value }))
  }

  // ── IBAN auto-formatting (groups of 4 chars separated by spaces) ───────────
  function handleIbanChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw       = e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 34)
    const formatted = raw.match(/.{1,4}/g)?.join(' ') ?? raw
    setF(prev => ({ ...prev, iban: formatted }))
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const data: SetupPayoutInput = {
      firstName:         f.firstName,
      lastName:          f.lastName,
      dobDay:            Number(f.dobDay),
      dobMonth:          Number(f.dobMonth),
      dobYear:           Number(f.dobYear),
      addressLine1:      f.addressLine1,
      addressCity:       f.addressCity,
      addressPostalCode: f.addressPostalCode,
      country:           f.country,
      iban:              f.iban,  // Zod strips spaces in the action
    }

    startTransition(async () => {
      const result = await setupPayoutAccount(data)
      if (result.success) {
        setDone(true)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="px-6 py-8 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(74,222,128,0.12)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round">
            <polyline points="2,7 6,11 12,3" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold f-body" style={{ color: '#16A34A' }}>
            Bank account connected!
          </p>
          <p className="text-xs f-body mt-0.5" style={{ color: 'rgba(22,163,74,0.75)' }}>
            Stripe will verify your details within 1–2 business days.
          </p>
        </div>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear()

  return (
    <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-6">

      {/* ── Personal information ──────────────────────────────────────────── */}
      <section>
        <SectionLabel>Personal information</SectionLabel>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Field label="First name">
            <FInput
              value={f.firstName}
              onChange={set('firstName')}
              placeholder="Ola"
              autoComplete="given-name"
              required
            />
          </Field>
          <Field label="Last name">
            <FInput
              value={f.lastName}
              onChange={set('lastName')}
              placeholder="Nordmann"
              autoComplete="family-name"
              required
            />
          </Field>
        </div>
        <Field label="Date of birth">
          <div className="grid grid-cols-3 gap-2">
            <FSelect value={f.dobDay} onChange={set('dobDay')} required aria-label="Birth day">
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </FSelect>
            <FSelect value={f.dobMonth} onChange={set('dobMonth')} required aria-label="Birth month">
              <option value="">Month</option>
              {DOB_MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </FSelect>
            <FSelect value={f.dobYear} onChange={set('dobYear')} required aria-label="Birth year">
              <option value="">Year</option>
              {Array.from(
                { length: currentYear - 18 - 1900 + 1 },
                (_, i) => currentYear - 18 - i,
              ).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </FSelect>
          </div>
        </Field>
      </section>

      {/* ── Address ───────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Home address</SectionLabel>
        <div className="flex flex-col gap-3">
          <Field label="Street address">
            <FInput
              value={f.addressLine1}
              onChange={set('addressLine1')}
              placeholder="Fjordveien 1"
              autoComplete="street-address"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <FInput
                value={f.addressCity}
                onChange={set('addressCity')}
                placeholder="Bergen"
                autoComplete="address-level2"
                required
              />
            </Field>
            <Field label="Postal code">
              <FInput
                value={f.addressPostalCode}
                onChange={set('addressPostalCode')}
                placeholder="5003"
                autoComplete="postal-code"
                required
              />
            </Field>
          </div>
          <Field label="Country">
            <FSelect value={f.country} onChange={set('country')} required>
              <option value="">Select country</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </FSelect>
          </Field>
        </div>
      </section>

      {/* ── Bank account (IBAN) ───────────────────────────────────────────── */}
      <section>
        <SectionLabel>Bank account</SectionLabel>
        <Field label="IBAN">
          <FInput
            value={f.iban}
            onChange={handleIbanChange}
            placeholder="NO94 8601 1117 947"
            autoComplete="off"
            spellCheck={false}
            required
          />
          <p className="text-[11px] f-body mt-1.5 leading-relaxed" style={{ color: 'rgba(10,46,77,0.4)' }}>
            Weekly earnings are transferred to this account every Monday.
          </p>
        </Field>
      </section>

      {/* ── Error message ─────────────────────────────────────────────────── */}
      {error != null && (
        <p
          className="text-sm f-body px-4 py-3 rounded-xl leading-relaxed"
          role="alert"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color:      '#DC2626',
            border:     '1px solid rgba(239,68,68,0.15)',
          }}
        >
          {error}
        </p>
      )}

      {/* ── ToS disclosure (legally required for Custom accounts) ─────────── */}
      <p className="text-[11px] f-body leading-relaxed" style={{ color: 'rgba(10,46,77,0.45)' }}>
        By connecting your bank account, you authorise FjordAnglers to create and manage a Stripe
        payment account on your behalf to receive booking payouts. You accept{' '}
        <a
          href="https://stripe.com/legal/connect-account"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={{ color: 'rgba(10,46,77,0.7)' }}
        >
          Stripe&apos;s Connected Account Agreement
        </a>.
      </p>

      {/* ── Submit ────────────────────────────────────────────────────────── */}
      <div>
        <button
          type="submit"
          disabled={isPending}
          className="text-sm font-bold f-body px-5 py-2.5 rounded-xl transition-all"
          style={{
            background: isPending ? 'rgba(10,46,77,0.1)' : '#0A2E4D',
            color:      isPending ? 'rgba(10,46,77,0.4)' : '#fff',
            cursor:     isPending ? 'not-allowed'         : 'pointer',
            opacity:    isPending ? 0.75 : 1,
          }}
        >
          {isPending ? 'Connecting…' : 'Connect bank account'}
        </button>
      </div>

    </form>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-bold uppercase tracking-[0.16em] f-body mb-3"
      style={{ color: 'rgba(10,46,77,0.38)' }}
    >
      {children}
    </p>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-xs font-medium f-body mb-1.5"
        style={{ color: 'rgba(10,46,77,0.55)' }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function FInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full text-sm f-body rounded-xl px-3.5 py-2.5 outline-none border border-[rgba(10,46,77,0.12)] focus:border-[rgba(10,46,77,0.35)] transition-colors"
      style={{
        background: 'rgba(10,46,77,0.04)',
        color:      '#0A2E4D',
        ...props.style,
      }}
    />
  )
}

function FSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full text-sm f-body rounded-xl px-3.5 py-2.5 outline-none border border-[rgba(10,46,77,0.12)] focus:border-[rgba(10,46,77,0.35)] transition-colors appearance-none"
      style={{
        background: 'rgba(10,46,77,0.04)',
        color:      '#0A2E4D',
        ...props.style,
      }}
    />
  )
}
