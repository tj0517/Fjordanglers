'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ImageUpload from '@/components/admin/image-upload'
import { createTestimonial, updateTestimonial, type TestimonialPayload } from '@/actions/testimonials'
import { COUNTRIES } from '@/lib/countries'
import { ANGLER_COUNTRIES } from '@/lib/angler-countries'

// ─── Design-system micro-components (as in knowledge-form) ───────────────────

function FieldLabel({ children, htmlFor, required }: { children: React.ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold uppercase tracking-[0.16em] mb-2 f-body"
      style={{ color: 'rgba(10,46,77,0.55)' }}
    >
      {children}
      {required === true && <span className="ml-1" style={{ color: '#E67E50' }}>*</span>}
    </label>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs f-body" style={{ color: 'rgba(10,46,77,0.4)' }}>{children}</p>
}

const fieldStyle = {
  background: '#F3EDE4',
  border: '1.5px solid rgba(10,46,77,0.1)',
  color: '#0A2E4D',
}
const focus = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = '#E67E50' }
const blur  = (e: React.FocusEvent<HTMLElement>) => { e.currentTarget.style.borderColor = 'rgba(10,46,77,0.1)' }

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all"
      style={fieldStyle}
      onFocus={focus}
      onBlur={blur}
    />
  )
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all appearance-none"
      style={fieldStyle}
      onFocus={focus}
      onBlur={blur}
    />
  )
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full px-4 py-3 rounded-2xl text-sm f-body outline-none transition-all resize-y"
      style={fieldStyle}
      onFocus={focus}
      onBlur={blur}
    />
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

type TestimonialFormValues = TestimonialPayload & {
  /** When consent was recorded, for the line under the checkbox. */
  consent_confirmed_at: string | null
}

interface TestimonialFormProps {
  mode: 'create' | 'edit'
  testimonialId?: string
  initialValues: TestimonialFormValues
}

const QUOTE_MAX = 1000

/**
 * The two ways the banner can show a client photo (FA-1.71). A landscape shot belongs in the
 * strip across the top; a portrait one belongs down the side, where it is not cropped to a
 * chest and a pair of hands. FA uploads the photo, so FA picks — the choice survives a swap.
 */
const PHOTO_LAYOUTS = [
  { value: 'horizontal' as const, label: 'Across the top' },
  { value: 'vertical'   as const, label: 'Down the side' },
]

const PHOTO_LAYOUT_HINTS = {
  horizontal: 'A strip above the quote — for a landscape photo.',
  vertical:   'Beside the quote, full height of the card — for a portrait photo.',
}
const CLIENT_COUNTRIES = ANGLER_COUNTRIES.filter(c => c.code !== 'ZZ')

// ─── Component ────────────────────────────────────────────────────────────────

export function TestimonialForm({ mode, testimonialId, initialValues }: TestimonialFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [quote, setQuote]                 = useState(initialValues.quote)
  const [authorName, setAuthorName]       = useState(initialValues.author_name)
  const [authorCountry, setAuthorCountry] = useState(initialValues.author_country ?? '')
  const [tripCountry, setTripCountry]     = useState(initialValues.trip_country ?? '')
  const [rating, setRating]               = useState(initialValues.rating != null ? String(initialValues.rating) : '')
  const [photoUrl, setPhotoUrl]           = useState<string | null>(initialValues.photo_url)
  const [photoKey, setPhotoKey]           = useState(0)
  const [photoLayout, setPhotoLayout]     = useState<'horizontal' | 'vertical'>(initialValues.photo_layout)
  const [source, setSource]               = useState<'trustpilot' | 'direct'>(initialValues.source)
  const [sourceUrl, setSourceUrl]         = useState(initialValues.source_url ?? '')
  const [consent, setConsent]             = useState(initialValues.consent_confirmed)
  const [consentNote, setConsentNote]     = useState(initialValues.consent_note ?? '')
  const [active, setActive]               = useState(initialValues.is_active)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isPending) return
    setError(null)

    const payload: TestimonialPayload = {
      quote,
      author_name:       authorName,
      author_country:    authorCountry === '' ? null : authorCountry,
      trip_country:      tripCountry === '' ? null : tripCountry,
      rating:            rating === '' ? null : Number(rating),
      photo_url:         photoUrl,
      photo_layout:      photoLayout,
      source,
      source_url:        source === 'trustpilot' && sourceUrl.trim() !== '' ? sourceUrl.trim() : null,
      consent_confirmed: consent,
      consent_note:      consentNote,
      is_active:         active,
    }

    startTransition(async () => {
      const result = mode === 'edit' && testimonialId != null
        ? await updateTestimonial(testimonialId, payload)
        : await createTestimonial(payload)

      if (!result.success) {
        setError(result.error)
        return
      }
      router.push('/admin/testimonials')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">

      {/* Source */}
      <div>
        <FieldLabel htmlFor="source" required>Source</FieldLabel>
        <SelectInput id="source" value={source} onChange={e => setSource(e.target.value === 'trustpilot' ? 'trustpilot' : 'direct')}>
          <option value="direct">Sent to us directly</option>
          <option value="trustpilot">Trustpilot</option>
        </SelectInput>
      </div>

      {source === 'trustpilot' && (
        <div>
          <FieldLabel htmlFor="source_url" required>Trustpilot review link</FieldLabel>
          <TextInput
            id="source_url"
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://www.trustpilot.com/reviews/…"
          />
          <Hint>The banner links here (&ldquo;Read on Trustpilot&rdquo;). Must be on trustpilot.com.</Hint>
        </div>
      )}

      {/* Quote */}
      <div>
        <FieldLabel htmlFor="quote" required>Quote</FieldLabel>
        <TextArea
          id="quote"
          value={quote}
          onChange={e => setQuote(e.target.value)}
          rows={5}
          maxLength={QUOTE_MAX}
          placeholder="What the client wrote, word for word."
        />
        <Hint>{quote.length}/{QUOTE_MAX}</Hint>
      </div>

      {/* Author */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel htmlFor="author_name" required>Name to show</FieldLabel>
          <TextInput
            id="author_name"
            value={authorName}
            onChange={e => setAuthorName(e.target.value)}
            maxLength={80}
            placeholder="First name"
          />
        </div>
        <div>
          <FieldLabel htmlFor="author_country">Client&rsquo;s country</FieldLabel>
          <SelectInput id="author_country" value={authorCountry} onChange={e => setAuthorCountry(e.target.value)}>
            <option value="">— not shown —</option>
            {CLIENT_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </SelectInput>
        </div>
      </div>

      {/* Trip + rating */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel htmlFor="trip_country">Trip country</FieldLabel>
          <SelectInput id="trip_country" value={tripCountry} onChange={e => setTripCountry(e.target.value)}>
            <option value="">General — any page</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </SelectInput>
          <Hint>Pages of this country show it first.</Hint>
        </div>
        <div>
          <FieldLabel htmlFor="rating">Rating</FieldLabel>
          <SelectInput id="rating" value={rating} onChange={e => setRating(e.target.value)}>
            <option value="">— none —</option>
            {[5, 4, 3, 2, 1].map(n => <option key={n} value={String(n)}>{n} / 5</option>)}
          </SelectInput>
        </div>
      </div>

      {/* Photo */}
      <div>
        <ImageUpload
          key={photoKey}
          label="Client photo"
          currentUrl={photoUrl}
          variant="thumbnail"
          folder="testimonials"
          onUpload={setPhotoUrl}
          hint="Optional. JPEG, PNG or WebP; resized to 2000 px."
        />
        {photoUrl != null && (
          <button
            type="button"
            onClick={() => { setPhotoUrl(null); setPhotoKey(k => k + 1) }}
            className="mt-2 text-xs font-medium f-body underline"
            style={{ color: 'rgba(10,46,77,0.55)' }}
          >
            Remove photo
          </button>
        )}

        {/* Only with a photo on the row: without one the choice shows nothing (FA-1.71). */}
        {photoUrl != null && (
          <div className="mt-4">
            <FieldLabel>How to show it</FieldLabel>
            <div role="radiogroup" aria-label="How to show the photo" className="flex gap-3">
              {PHOTO_LAYOUTS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={photoLayout === option.value}
                  onClick={() => setPhotoLayout(option.value)}
                  className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all"
                  style={{
                    background: '#F3EDE4',
                    border: `1.5px solid ${photoLayout === option.value ? '#E67E50' : 'rgba(10,46,77,0.1)'}`,
                  }}
                >
                  <span
                    aria-hidden
                    className="flex-shrink-0 rounded"
                    style={{
                      width:  option.value === 'vertical' ? 18 : 34,
                      height: option.value === 'vertical' ? 34 : 18,
                      background: photoLayout === option.value ? '#0A2E4D' : 'rgba(10,46,77,0.25)',
                    }}
                  />
                  <span className="text-sm f-body font-medium" style={{ color: '#0A2E4D' }}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
            <Hint>{PHOTO_LAYOUT_HINTS[photoLayout]}</Hint>
          </div>
        )}
      </div>

      {/* Consent */}
      <div className="p-4 rounded-2xl space-y-4" style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            id="consent"
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#0A2E4D]"
          />
          <span className="text-sm f-body" style={{ color: '#0A2E4D' }}>
            I have the client&rsquo;s consent to publish their name and photo
            {consent && initialValues.consent_confirmed_at != null && (
              <span className="block text-xs mt-0.5" style={{ color: 'rgba(10,46,77,0.45)' }}>
                Recorded {new Date(initialValues.consent_confirmed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </span>
        </label>
        <div>
          <FieldLabel htmlFor="consent_note">Consent note — internal</FieldLabel>
          <TextArea
            id="consent_note"
            value={consentNote}
            onChange={e => setConsentNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="How and when — e.g. e-mail from the client, 12 Oct 2026."
          />
          <Hint>Never shown on the site.</Hint>
        </div>
      </div>

      {/* Active */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label="Active"
          onClick={() => setActive(a => !a)}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0"
          style={{ background: active ? '#E67E50' : 'rgba(10,46,77,0.15)' }}
        >
          <span
            className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
            style={{ transform: active ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }}
          />
        </button>
        <span className="text-sm f-body" style={{ color: '#0A2E4D' }}>
          {active ? 'Active — can be shown on the site' : 'Inactive — never shown'}
        </span>
      </div>

      {/* Error */}
      {error != null && (
        <div
          role="alert"
          className="px-4 py-3 rounded-2xl text-sm f-body"
          style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 rounded-2xl text-sm font-semibold f-body transition-all disabled:opacity-60"
          style={{ background: '#0A2E4D', color: '#F8FAFB' }}
        >
          {isPending ? 'Saving…' : mode === 'create' ? 'Create testimonial' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/testimonials')}
          className="px-6 py-2.5 rounded-2xl text-sm font-semibold f-body transition-all"
          style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
