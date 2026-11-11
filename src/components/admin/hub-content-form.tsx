'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { saveHubContent } from '@/actions/hubs'
import { Counter, FieldLabel, Hint, RED, TextArea, TextInput } from '@/components/admin/editor-fields'
import {
  CONTACT_EMAIL_MAX,
  CONTACT_NAME_MAX,
  FAQ_ANSWER_MAX,
  FAQ_MAX,
  FAQ_QUESTION_MAX,
  H1_MAX,
  HubContentPayloadSchema,
  INTRO_MAX,
  META_DESCRIPTION_MAX,
  META_TITLE_MAX,
  MONTH_NAMES,
  PROOF_NOTE_MAX,
  QUOTE_AUTHOR_MAX,
  QUOTE_COUNTRY_MAX,
  QUOTE_TEXT_MAX,
  SEASON_NOTE_MAX,
  SPECIES_MAX,
  type HubContentPayload,
} from '@/lib/hubs/editor'

// ─── Props ────────────────────────────────────────────────────────────────────

export type HubContentFormValues = {
  h1: string
  intro: string
  metaTitle: string
  metaDescription: string
  seasonMonths: number[]
  peakMonths: number[]
  seasonNote: string
  species: string[]
  faq: { question: string; answer: string }[]
  heroQuoteText: string
  heroQuoteAuthor: string
  heroQuoteCountry: string
  proofNote: string
  contactName: string
  contactEmail: string
  contactWhatsapp: string
}

export interface HubContentFormProps {
  slug: string
  initialValues: HubContentFormValues
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

// ─── Pieces ───────────────────────────────────────────────────────────────────

function MonthPicker({
  legend, selected, enabled, onToggle, testId,
}: {
  legend: string
  selected: number[]
  /** A month that cannot be picked (a best month outside the season). */
  enabled: (month: number) => boolean
  onToggle: (month: number) => void
  testId: string
}) {
  return (
    <fieldset data-testid={testId}>
      <legend className="block text-xs font-semibold uppercase tracking-[0.16em] mb-2 f-body" style={{ color: 'rgba(10,46,77,0.55)' }}>{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {MONTHS.map(m => {
          const on = selected.includes(m)
          const can = enabled(m)
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              aria-label={`${legend}: ${MONTH_NAMES[m - 1]}`}
              disabled={!can}
              onClick={() => onToggle(m)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold f-body transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={on
                ? { background: '#0A2E4D', color: '#F8FAFB', border: '1.5px solid #0A2E4D' }
                : { background: '#F3EDE4', color: '#0A2E4D', border: '1.5px solid rgba(10,46,77,0.1)' }}
            >
              {MONTH_NAMES[m - 1]}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

const smallButton = 'px-3 py-1.5 rounded-xl text-xs font-semibold f-body disabled:opacity-30 disabled:cursor-not-allowed'
const smallButtonStyle = { border: '1.5px solid rgba(10,46,77,0.2)', color: '#0A2E4D' }

// ─── Component ────────────────────────────────────────────────────────────────

export function HubContentForm({ slug, initialValues: v }: HubContentFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [h1, setH1] = useState(v.h1)
  const [intro, setIntro] = useState(v.intro)
  const [metaTitle, setMetaTitle] = useState(v.metaTitle)
  const [metaDescription, setMetaDescription] = useState(v.metaDescription)
  const [seasonMonths, setSeasonMonths] = useState(v.seasonMonths)
  const [peakMonths, setPeakMonths] = useState(v.peakMonths)
  const [seasonNote, setSeasonNote] = useState(v.seasonNote)
  const [speciesText, setSpeciesText] = useState(v.species.join('\n'))
  const [faq, setFaq] = useState(v.faq)
  const [quoteText, setQuoteText] = useState(v.heroQuoteText)
  const [quoteAuthor, setQuoteAuthor] = useState(v.heroQuoteAuthor)
  const [quoteCountry, setQuoteCountry] = useState(v.heroQuoteCountry)
  const [proofNote, setProofNote] = useState(v.proofNote)
  const [contactName, setContactName] = useState(v.contactName)
  const [contactEmail, setContactEmail] = useState(v.contactEmail)
  const [contactWhatsapp, setContactWhatsapp] = useState(v.contactWhatsapp)

  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const species = speciesText.split('\n').map(s => s.trim()).filter(s => s !== '')

  const payload = (): HubContentPayload => ({
    h1, intro, metaTitle, metaDescription, seasonMonths, peakMonths, seasonNote, species, faq,
    heroQuoteText: quoteText, heroQuoteAuthor: quoteAuthor, heroQuoteCountry: quoteCountry,
    proofNote, contactName, contactEmail, contactWhatsapp,
  })

  // The same schema the server runs. Anything it refuses blocks saving — the table refuses the same
  // limits. Cheap enough to run on every render: nothing here is a network call.
  const issues: Record<string, string> = {}
  const checked = HubContentPayloadSchema.safeParse(payload())
  if (!checked.success) {
    for (const issue of checked.error.issues) {
      const key = issue.path.join('.')
      if (issues[key] == null) issues[key] = issue.message
    }
  }
  const blocked = Object.keys(issues).length > 0
  const issueFor = (key: string) => issues[key]

  function toggleSeason(month: number) {
    if (seasonMonths.includes(month)) {
      setSeasonMonths(seasonMonths.filter(m => m !== month))
      // The best months stay inside the season: leaving a month out of it takes it out of those too.
      setPeakMonths(peakMonths.filter(m => m !== month))
    } else {
      setSeasonMonths([...seasonMonths, month].sort((a, b) => a - b))
    }
  }
  function togglePeak(month: number) {
    setPeakMonths(peakMonths.includes(month) ? peakMonths.filter(m => m !== month) : [...peakMonths, month].sort((a, b) => a - b))
  }

  const setFaqEntry = (i: number, patch: Partial<{ question: string; answer: string }>) =>
    setFaq(faq.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  function moveFaq(i: number, by: -1 | 1) {
    const j = i + by
    if (j < 0 || j >= faq.length) return
    const next = [...faq]
    ;[next[i], next[j]] = [next[j], next[i]]
    setFaq(next)
  }

  function save() {
    if (isPending || blocked) return
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await saveHubContent(slug, payload())
      if (!result.success) {
        setError(result.error)
        return
      }
      setMessage(result.changed ? 'Saved. The hub page shows the change within a moment.' : 'Nothing was changed.')
      router.refresh()
    })
  }

  const showIssue = (key: string, when: boolean) =>
    issueFor(key) != null && when && <p className="mt-1 text-xs f-body" style={{ color: RED }}>{issueFor(key)}</p>

  return (
    <form onSubmit={e => { e.preventDefault(); save() }} className="space-y-8">
      {message != null && (
        <div role="status" className="px-4 py-3 rounded-2xl text-sm f-body" style={{ background: 'rgba(10,46,77,0.06)', color: '#0A2E4D' }}>
          {message}{' '}
          <Link href={`/${slug}`} target="_blank" className="underline font-semibold">View the hub →</Link>
        </div>
      )}

      {/* Page and search */}
      <section className="max-w-2xl space-y-6">
        <div>
          <FieldLabel htmlFor="h1" required>Headline (H1)</FieldLabel>
          <TextInput id="h1" value={h1} onChange={e => setH1(e.target.value)} invalid={issueFor('h1') != null} />
          <Counter id="h1-count" value={h1} max={H1_MAX} />
          {showIssue('h1', h1 === '')}
          <Hint>Also the label of this hub in &ldquo;More destinations&rdquo; and in the breadcrumb of its offers.</Hint>
        </div>

        <div>
          <FieldLabel htmlFor="intro" required>Intro</FieldLabel>
          <TextArea id="intro" value={intro} onChange={e => setIntro(e.target.value)} rows={7} invalid={issueFor('intro') != null} />
          <Counter id="intro-count" value={intro} max={INTRO_MAX} />
          {showIssue('intro', intro === '')}
        </div>

        <div className="p-4 rounded-2xl space-y-5" style={{ background: 'rgba(10,46,77,0.03)', border: '1px solid rgba(10,46,77,0.08)' }}>
          <div>
            <FieldLabel htmlFor="meta_title" required>Meta title</FieldLabel>
            <TextInput id="meta_title" value={metaTitle} onChange={e => setMetaTitle(e.target.value)} invalid={issueFor('metaTitle') != null} placeholder="The title in the browser tab and in Google" />
            <Counter id="meta-title-count" value={metaTitle} max={META_TITLE_MAX} />
            {showIssue('metaTitle', metaTitle === '')}
          </div>
          <div>
            <FieldLabel htmlFor="meta_description" required>Meta description</FieldLabel>
            <TextArea id="meta_description" value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={3} invalid={issueFor('metaDescription') != null} placeholder="The two lines under the title in Google" />
            <Counter id="meta-description-count" value={metaDescription} max={META_DESCRIPTION_MAX} />
            {showIssue('metaDescription', metaDescription === '')}
          </div>
          <Hint>The limits are Google&rsquo;s — longer text is cut off in the results. The blog allows 155 for its description; the hubs, 160.</Hint>
        </div>
      </section>

      {/* Season */}
      <section className="max-w-2xl space-y-5">
        <h2 className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>Season</h2>
        <MonthPicker legend="Season" selected={seasonMonths} enabled={() => true} onToggle={toggleSeason} testId="season-months" />
        <MonthPicker legend="Best months" selected={peakMonths} enabled={m => seasonMonths.includes(m)} onToggle={togglePeak} testId="peak-months" />
        <Hint>No months selected = the hub shows no season bar. Best months are drawn darker and must be inside the season.</Hint>
        {showIssue('seasonMonths', true)}
        {showIssue('peakMonths', true)}
        <div>
          <FieldLabel htmlFor="season_note">Season note</FieldLabel>
          <TextArea id="season_note" value={seasonNote} onChange={e => setSeasonNote(e.target.value)} rows={3} invalid={issueFor('seasonNote') != null} />
          <Counter id="season-note-count" value={seasonNote} max={SEASON_NOTE_MAX} />
          <Hint>One or two sentences under the season bar.</Hint>
        </div>
      </section>

      {/* Species */}
      <section className="max-w-2xl">
        <FieldLabel htmlFor="species">Species</FieldLabel>
        <TextArea id="species" value={speciesText} onChange={e => setSpeciesText(e.target.value)} rows={5} invalid={issueFor('species') != null} placeholder={'One species per line'} />
        <Hint>{species.length}/{SPECIES_MAX} · Leave empty and the hub lists the species of its own offers. Fill it and this list replaces that one.</Hint>
        {showIssue('species', true)}
      </section>

      {/* FAQ */}
      <section className="max-w-2xl space-y-4">
        <h2 className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>Questions &amp; answers</h2>
        {faq.length === 0 && <Hint>No questions — the hub shows no FAQ block (and no FAQ markup for Google).</Hint>}
        {faq.map((entry, i) => (
          <div key={i} data-testid={`faq-entry-${i}`} className="p-4 rounded-2xl space-y-3" style={{ border: '1px solid rgba(10,46,77,0.1)' }}>
            <div>
              <FieldLabel htmlFor={`faq-q-${i}`}>Question {i + 1}</FieldLabel>
              <TextInput id={`faq-q-${i}`} value={entry.question} onChange={e => setFaqEntry(i, { question: e.target.value })} invalid={issueFor(`faq.${i}.question`) != null} />
              <Counter id={`faq-q-${i}-count`} value={entry.question} max={FAQ_QUESTION_MAX} />
              {showIssue(`faq.${i}.question`, true)}
            </div>
            <div>
              <FieldLabel htmlFor={`faq-a-${i}`}>Answer {i + 1}</FieldLabel>
              <TextArea id={`faq-a-${i}`} value={entry.answer} onChange={e => setFaqEntry(i, { answer: e.target.value })} rows={4} invalid={issueFor(`faq.${i}.answer`) != null} />
              <Counter id={`faq-a-${i}-count`} value={entry.answer} max={FAQ_ANSWER_MAX} />
              {showIssue(`faq.${i}.answer`, true)}
            </div>
            <div className="flex gap-2">
              <button type="button" className={smallButton} style={smallButtonStyle} disabled={i === 0} onClick={() => moveFaq(i, -1)} aria-label={`Move question ${i + 1} up`}>Move up</button>
              <button type="button" className={smallButton} style={smallButtonStyle} disabled={i === faq.length - 1} onClick={() => moveFaq(i, 1)} aria-label={`Move question ${i + 1} down`}>Move down</button>
              <button type="button" className={smallButton} style={smallButtonStyle} onClick={() => setFaq(faq.filter((_, idx) => idx !== i))} aria-label={`Remove question ${i + 1}`}>Remove</button>
            </div>
          </div>
        ))}
        <button type="button" className={smallButton} style={smallButtonStyle} disabled={faq.length >= FAQ_MAX} onClick={() => setFaq([...faq, { question: '', answer: '' }])}>
          Add a question ({faq.length}/{FAQ_MAX})
        </button>
        {showIssue('faq', true)}
      </section>

      {/* Hero quote, proof note, contact */}
      <section className="max-w-2xl space-y-6">
        <div className="space-y-4">
          <h2 className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>Hero quote</h2>
          <Hint>Optional. All three fields or none.</Hint>
          <div>
            <FieldLabel htmlFor="quote_text">Quote</FieldLabel>
            <TextArea id="quote_text" value={quoteText} onChange={e => setQuoteText(e.target.value)} rows={2} invalid={issueFor('heroQuoteText') != null} />
            <Counter id="quote-text-count" value={quoteText} max={QUOTE_TEXT_MAX} />
            {showIssue('heroQuoteText', true)}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="quote_author">Author</FieldLabel>
              <TextInput id="quote_author" value={quoteAuthor} onChange={e => setQuoteAuthor(e.target.value)} invalid={issueFor('heroQuoteAuthor') != null} />
              <Counter id="quote-author-count" value={quoteAuthor} max={QUOTE_AUTHOR_MAX} />
              {showIssue('heroQuoteAuthor', true)}
            </div>
            <div>
              <FieldLabel htmlFor="quote_country">Author&rsquo;s country</FieldLabel>
              <TextInput id="quote_country" value={quoteCountry} onChange={e => setQuoteCountry(e.target.value)} invalid={issueFor('heroQuoteCountry') != null} />
              <Counter id="quote-country-count" value={quoteCountry} max={QUOTE_COUNTRY_MAX} />
              {showIssue('heroQuoteCountry', true)}
            </div>
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="proof_note">Proof note</FieldLabel>
          <TextInput id="proof_note" value={proofNote} onChange={e => setProofNote(e.target.value)} invalid={issueFor('proofNote') != null} placeholder="gear included" />
          <Counter id="proof-note-count" value={proofNote} max={PROOF_NOTE_MAX} />
          <Hint>The third part of the line under the headline, after the guide count and the price. Empty = the line ends after the price.</Hint>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold f-display" style={{ color: '#0A2E4D' }}>Contact</h2>
          <Hint>Optional. Shows a &ldquo;Questions? Ask …&rdquo; block at the bottom of the hub. All three fields or none.</Hint>
          <div>
            <FieldLabel htmlFor="contact_name">Name</FieldLabel>
            <TextInput id="contact_name" value={contactName} onChange={e => setContactName(e.target.value)} invalid={issueFor('contactName') != null} />
            <Counter id="contact-name-count" value={contactName} max={CONTACT_NAME_MAX} />
            {showIssue('contactName', true)}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="contact_email">E-mail</FieldLabel>
              <TextInput id="contact_email" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} invalid={issueFor('contactEmail') != null} />
              <Counter id="contact-email-count" value={contactEmail} max={CONTACT_EMAIL_MAX} />
              {showIssue('contactEmail', true)}
            </div>
            <div>
              <FieldLabel htmlFor="contact_whatsapp">WhatsApp number</FieldLabel>
              <TextInput id="contact_whatsapp" value={contactWhatsapp} onChange={e => setContactWhatsapp(e.target.value)} invalid={issueFor('contactWhatsapp') != null} placeholder="48123456789" />
              <Hint>International format. Spaces and a leading + are removed on save.</Hint>
              {showIssue('contactWhatsapp', true)}
            </div>
          </div>
        </div>
      </section>

      {error != null && (
        <p role="alert" data-testid="form-error" className="text-sm f-body px-4 py-3 rounded-2xl max-w-2xl" style={{ background: 'rgba(179,38,30,0.08)', color: RED }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap pt-2">
        <button
          type="submit"
          disabled={isPending || blocked}
          className="px-6 py-3 rounded-2xl text-sm font-semibold f-body transition-all hover:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: '#0A2E4D', color: '#F8FAFB' }}
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        <Link href="/admin/hubs" className="text-sm f-body underline" style={{ color: 'rgba(10,46,77,0.55)' }}>Back to the list</Link>
        {blocked && (
          <span data-testid="blocked-reason" className="text-xs f-body" style={{ color: RED }}>
            Saving is off: {Object.values(issues)[0]}
          </span>
        )}
      </div>
    </form>
  )
}
