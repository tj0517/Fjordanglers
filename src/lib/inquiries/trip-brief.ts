/**
 * The Trip Brief — what FA writes for the guide on the inquiry card (`inquiry_trip_details`,
 * FA-M.07). Pure: the schema the admin save validates with, the licence labels the card and the
 * request page share, and the "which fields changed" diff the `inquiry.brief_updated` event carries.
 *
 * Not the public form's brief (`inquiries.brief`, `brief-schema.ts`) — tj decision (b): the
 * request page reads both, and this one is the only one FA edits.
 *
 * Limits (tj 2026-11-17): accommodation 300 and the FA note 2000 are enforced here only (no
 * database change; prod maxima 205 / 976); `licence_note` 300 is also a CHECK in the database.
 * The remaining short text fields use 300 as well; party size keeps the card's 1–20.
 */

import { z } from 'zod'

export const LICENCE_BUYERS = ['client', 'guide', 'not_needed'] as const
export type LicenceBuyer = typeof LICENCE_BUYERS[number]

/** tj decision 1 (A). No "FA buys": FA handles no client money beyond the deposit. */
export const LICENCE_BUYER_LABELS: Record<LicenceBuyer, string> = {
  client:     'Client buys',
  guide:      'Guide arranges',
  not_needed: 'No licence needed',
}

function isLicenceBuyer(value: unknown): value is LicenceBuyer {
  return typeof value === 'string' && (LICENCE_BUYERS as readonly string[]).includes(value)
}

const DATE_FLEXIBILITY_VALUES = ['fixed', 'flexible_1_2', 'flexible_week', 'very_flexible'] as const

export const TRIP_BRIEF_LIMITS = {
  accommodation: 300,
  guide_notes:   2000,
  licence_note:  300,
  shortText:     300,
  partySizeMax:  20,
} as const

/** Trimmed text with a length bound; empty or null → null (tj decision 3: an emptied field is cleared). */
function optionalText(max: number) {
  return z.union([z.string().trim().max(max), z.null()])
    .transform(v => (v == null || v === '' ? null : v))
}

/** One of `values`; empty or null → null. */
function optionalChoice<T extends readonly [string, ...string[]]>(values: T) {
  return z.union([z.enum(values), z.literal(''), z.null()])
    .transform(v => (v == null || v === '' ? null : v))
}

/**
 * The whole brief, every key required — the Brief tab always sends all of them, so a missing key
 * is a bug, not "leave as is". Strict: anything else (e.g. `guide_options`, which the guide fills)
 * is refused instead of being written.
 */
export const tripBriefInputSchema = z.object({
  confirmed_date:       optionalText(TRIP_BRIEF_LIMITS.shortText),
  confirmed_party_size: z.union([z.number().int().min(1).max(TRIP_BRIEF_LIMITS.partySizeMax), z.null()]),
  price_range:          optionalText(TRIP_BRIEF_LIMITS.shortText),
  date_flexibility:     optionalChoice(DATE_FLEXIBILITY_VALUES),
  target_species:       optionalText(TRIP_BRIEF_LIMITS.shortText),
  accommodation:        optionalText(TRIP_BRIEF_LIMITS.accommodation),
  guide_notes:          optionalText(TRIP_BRIEF_LIMITS.guide_notes),
  licence_buyer:        optionalChoice(LICENCE_BUYERS),
  licence_note:         optionalText(TRIP_BRIEF_LIMITS.licence_note),
}).strict()

export type TripBriefFields = z.output<typeof tripBriefInputSchema>

/**
 * What the Brief tab sends: every field, as the form holds it (choices as plain strings). Untrusted
 * until `tripBriefInputSchema` has parsed it — the type only keeps the caller honest about the keys.
 */
export type TripBriefInput = {
  [K in keyof TripBriefFields]: K extends 'confirmed_party_size' ? number | null : string | null
}

export const TRIP_BRIEF_FIELDS = Object.keys(tripBriefInputSchema.shape) as (keyof TripBriefFields)[]

/** The same fields as a select list — a literal, so the Supabase client types the row. */
export const TRIP_BRIEF_COLUMNS = 'confirmed_date, confirmed_party_size, price_range, date_flexibility, target_species, accommodation, guide_notes, licence_buyer, licence_note' as const

/**
 * Names of the fields whose stored value differs from `before` (null = no row yet, every field
 * null). Names only — the event never carries the text.
 */
export function changedTripBriefFields(
  before: Partial<Record<keyof TripBriefFields, string | number | null>> | null,
  after:  TripBriefFields,
): (keyof TripBriefFields)[] {
  return TRIP_BRIEF_FIELDS.filter(key => (before?.[key] ?? null) !== after[key])
}

/** "Client buys — Taupō licence" / "Client buys" / "Taupō licence"; null when neither is set. */
export function licenceLine(buyer: string | null, note: string | null): string | null {
  const label = isLicenceBuyer(buyer) ? LICENCE_BUYER_LABELS[buyer] : null
  const text = note?.trim() === '' ? null : note?.trim() ?? null
  if (label != null && text != null) return `${label} — ${text}`
  return label ?? text
}
