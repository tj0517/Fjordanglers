/**
 * The rules of the hub editor (FA-1.85) — pure: no I/O, no React, safe to import from the form
 * (client) and from the server action alike. The table enforces the same limits
 * (`supabase/migrations/20261111000000_add_destination_hubs.sql`); this module gives the author a
 * readable message first, and the action re-checks everything on the server — the form's counters
 * are a convenience, never the guard.
 *
 * Keep the numbers here in step with the migration. The meta description limit is 160, not the
 * blog's 155: three live hub descriptions are 158–160 characters (tj, 2026-11-11).
 */

import { z } from 'zod'

export const H1_MAX = 120
export const INTRO_MAX = 1500
export const META_TITLE_MAX = 60
export const META_DESCRIPTION_MAX = 160
export const SEASON_NOTE_MAX = 600
export const PROOF_NOTE_MAX = 60
export const SPECIES_MAX = 20
const SPECIES_NAME_MAX = 40
export const FAQ_MAX = 12
export const FAQ_QUESTION_MAX = 200
export const FAQ_ANSWER_MAX = 1500
export const QUOTE_TEXT_MAX = 500
export const QUOTE_AUTHOR_MAX = 80
export const QUOTE_COUNTRY_MAX = 60
export const CONTACT_NAME_MAX = 80
export const CONTACT_EMAIL_MAX = 254

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Optional text: trimmed, and an empty string is stored as NULL. */
const optionalText = (max: number, tooLong: string) =>
  z.string().trim().max(max, tooLong).nullable()
    .transform(v => (v == null || v === '' ? null : v))

const requiredText = (label: string, max: number) =>
  z.string().trim()
    .min(1, `${label} cannot be blank`)
    .max(max, `${label} is too long — ${max} characters at most`)

const month = z.number().int().min(1, 'A month is 1–12').max(12, 'A month is 1–12')

const months = (label: string) =>
  z.array(month)
    .max(12)
    .refine(list => new Set(list).size === list.length, `${label}: a month is listed twice`)

const faqEntry = z.object({
  question: requiredText('Question', FAQ_QUESTION_MAX),
  answer: requiredText('Answer', FAQ_ANSWER_MAX),
})

/**
 * The editor's payload, flat (one key per field the form shows). The hub slug is not in it: the
 * action takes it as its own argument and checks it against the hubs in code.
 *
 * The quote and the contact are all-or-nothing, as in the table; the issue lands on the first
 * blank field so the form can mark it.
 */
export const HubContentPayloadSchema = z.object({
  h1: requiredText('Headline', H1_MAX),
  intro: requiredText('Intro', INTRO_MAX),
  metaTitle: requiredText('Meta title', META_TITLE_MAX),
  metaDescription: requiredText('Meta description', META_DESCRIPTION_MAX),
  seasonMonths: months('Season'),
  peakMonths: months('Best months'),
  seasonNote: optionalText(SEASON_NOTE_MAX, `Season note is too long — ${SEASON_NOTE_MAX} characters at most`),
  species: z.array(requiredText('Species name', SPECIES_NAME_MAX))
    .max(SPECIES_MAX, `At most ${SPECIES_MAX} species`)
    .refine(list => new Set(list.map(s => s.toLowerCase())).size === list.length, 'A species is listed twice'),
  faq: z.array(faqEntry).max(FAQ_MAX, `At most ${FAQ_MAX} questions`),
  heroQuoteText: optionalText(QUOTE_TEXT_MAX, `Quote is too long — ${QUOTE_TEXT_MAX} characters at most`),
  heroQuoteAuthor: optionalText(QUOTE_AUTHOR_MAX, `Quote author is too long — ${QUOTE_AUTHOR_MAX} characters at most`),
  heroQuoteCountry: optionalText(QUOTE_COUNTRY_MAX, `Quote country is too long — ${QUOTE_COUNTRY_MAX} characters at most`),
  proofNote: optionalText(PROOF_NOTE_MAX, `Proof note is too long — ${PROOF_NOTE_MAX} characters at most`),
  contactName: optionalText(CONTACT_NAME_MAX, `Contact name is too long — ${CONTACT_NAME_MAX} characters at most`),
  contactEmail: optionalText(CONTACT_EMAIL_MAX, `Contact e-mail is too long — ${CONTACT_EMAIL_MAX} characters at most`),
  // International format, digits only (wa.me): spaces, "+", dashes and brackets are accepted and removed.
  contactWhatsapp: z.string().trim().nullable()
    .transform(v => (v == null ? null : v.replace(/[\s+\-().]/g, '')))
    .transform(v => (v == null || v === '' ? null : v)),
}).superRefine((v, ctx) => {
  const peakOutside = v.peakMonths.filter(m => !v.seasonMonths.includes(m))
  if (peakOutside.length > 0) {
    ctx.addIssue({ code: 'custom', path: ['peakMonths'], message: `Best months must be inside the season (${peakOutside.map(m => MONTH_NAMES[m - 1]).join(', ')} are not)` })
  }

  const allOrNone = (
    group: string,
    fields: readonly { key: 'heroQuoteText' | 'heroQuoteAuthor' | 'heroQuoteCountry' | 'contactName' | 'contactEmail' | 'contactWhatsapp'; label: string }[],
  ) => {
    const blank = fields.filter(f => v[f.key] == null)
    if (blank.length > 0 && blank.length < fields.length) {
      ctx.addIssue({ code: 'custom', path: [blank[0].key], message: `${group}: ${blank.map(f => f.label).join(' and ')} ${blank.length === 1 ? 'is' : 'are'} missing — fill all of it or none` })
    }
  }
  allOrNone('Hero quote', [
    { key: 'heroQuoteText', label: 'the quote' },
    { key: 'heroQuoteAuthor', label: 'the author' },
    { key: 'heroQuoteCountry', label: 'the country' },
  ])
  allOrNone('Contact', [
    { key: 'contactName', label: 'the name' },
    { key: 'contactEmail', label: 'the e-mail' },
    { key: 'contactWhatsapp', label: 'the WhatsApp number' },
  ])

  if (v.contactEmail != null && !EMAIL_RE.test(v.contactEmail)) {
    ctx.addIssue({ code: 'custom', path: ['contactEmail'], message: 'The e-mail address does not look right' })
  }
  if (v.contactWhatsapp != null && !/^[0-9]{6,15}$/.test(v.contactWhatsapp)) {
    ctx.addIssue({ code: 'custom', path: ['contactWhatsapp'], message: 'WhatsApp: 6–15 digits in international format (for example 48123456789)' })
  }
})

export type HubContentPayload = z.input<typeof HubContentPayloadSchema>
export type HubContentValues = z.output<typeof HubContentPayloadSchema>

// ─── Database constraint → sentence ───────────────────────────────────────────

/**
 * Fallback for a violation that got past the checks above (a caller that skipped the form, or a
 * rule added to the table and not yet here). Keyed by constraint name, not by message text.
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  destination_hubs_h1_length: `The headline cannot be blank and must be at most ${H1_MAX} characters.`,
  destination_hubs_intro_length: `The intro cannot be blank and must be at most ${INTRO_MAX} characters.`,
  destination_hubs_meta_title_length: `The meta title cannot be blank and must be at most ${META_TITLE_MAX} characters.`,
  destination_hubs_meta_description_length: `The meta description cannot be blank and must be at most ${META_DESCRIPTION_MAX} characters.`,
  destination_hubs_season_note_length: `The season note must be at most ${SEASON_NOTE_MAX} characters.`,
  destination_hubs_proof_note_length: `The proof note must be at most ${PROOF_NOTE_MAX} characters.`,
  destination_hubs_season_months_valid: 'The season must be a list of months, 1–12.',
  destination_hubs_peak_months_valid: 'The best months must be inside the season.',
  destination_hubs_species_count: `At most ${SPECIES_MAX} species.`,
  destination_hubs_faq_shape: `The FAQ must be a list of at most ${FAQ_MAX} questions.`,
  destination_hubs_hero_quote_complete: 'The hero quote needs the quote, the author and the country — or none of them.',
  destination_hubs_contact_complete: 'The contact needs a name, a valid e-mail and a WhatsApp number — or none of them.',
}

export function hubConstraintMessage(dbMessage: string): string | null {
  for (const [constraint, human] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (dbMessage.includes(constraint)) return human
  }
  return null
}
