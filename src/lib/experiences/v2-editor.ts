/**
 * Offer v2 editor — validation and pure helpers (FA-1.56). No I/O, no React.
 *
 * One module for both sides of the admin form: the server actions in
 * `src/actions/experience-pages.ts` validate with these schemas, and the form uses the
 * same helpers to warn before the round trip. A rule that exists only in the form is not
 * a rule — the action re-checks everything.
 *
 * Money is integer minor units (CLAUDE.md rule 6). What the admin types ("1250.50") is
 * turned into cents by reading the digits, never by multiplying a float.
 *
 * The jsonb shapes below are the ones written down in
 * docs/proposals/2026-10-05-experience-offer-centric.md §2.4–2.5. The public template
 * reads the same columns, so it should import these types rather than restate them.
 */

import { z } from 'zod'

// ─── Limits ──────────────────────────────────────────────────────────────────

/** O-32: a per-guide override may be at most this percentage of the page's base price. */
const OVERRIDE_CAP_PCT = 115

/** 10 million major units — a typo guard, far above any real trip price. */
const MAX_CENTS = 1_000_000_000

const MAX_DAYS    = 60
const MAX_ANGLERS = 20

// ─── Atoms ───────────────────────────────────────────────────────────────────

export const idSchema = z.uuid('Not a valid id')

const centsSchema = z
  .number('Amount must be a whole number of minor units')
  .int('Amount must be a whole number of minor units')
  .nonnegative('Amount cannot be negative')
  .max(MAX_CENTS, 'Amount is implausibly large')

const positiveCentsSchema = centsSchema.positive('Amount must be greater than 0')

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine(s => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Not a real date')

/**
 * The format `slugify()` in the page form has always produced: lowercase letters, digits
 * and hyphens. Deliberately not stricter (no "no double hyphen" rule) — an alias has to be
 * able to name any slug that was ever live.
 */
export const slugSchema = z
  .string()
  .trim()
  .min(1, 'Slug is required')
  .max(200, 'Slug is too long')
  .regex(/^[a-z0-9-]+$/, 'Slug may contain only lowercase letters, digits and hyphens')

/** http(s) only — a `javascript:` or `data:` URL must never reach an href on the public page. */
const httpUrlSchema = z
  .string()
  .trim()
  .max(500, 'URL is too long')
  .refine(value => {
    try {
      const { protocol } = new URL(value)
      return protocol === 'http:' || protocol === 'https:'
    } catch {
      return false
    }
  }, 'URL must start with http:// or https://')

const text = (max: number) => z.string().trim().max(max, `Text is longer than ${max} characters`)

/** Empty string means "not set" — stored as NULL, never as ''. */
const optionalText = (max: number) =>
  text(max).nullable().transform(value => (value == null || value === '' ? null : value))

const lineList = (maxItems: number) =>
  z.array(text(300).min(1, 'Empty line')).max(maxItems, `At most ${maxItems} lines`)

/** numeric(4,1): one decimal, below 1000. */
const kmSchema = z
  .number()
  .min(0, 'Distance cannot be negative')
  .max(999.9, 'Distance is implausibly large')
  .refine(n => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, 'At most one decimal')

// ─── Money typed by a human ──────────────────────────────────────────────────

/**
 * "1250", "1250.5", "1 250,50" → 125000 / 125050 / 125050. Null when the text is not an
 * amount. Digits are read as text: no float is ever multiplied by 100.
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[\s ]/g, '').replace(',', '.')
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (match == null) return null
  const whole    = Number.parseInt(match[1], 10)
  const fraction = Number.parseInt((match[2] ?? '').padEnd(2, '0'), 10)
  return whole * 100 + fraction
}

/** 125050 → "1250.50" — the inverse of parseMoneyToCents, for pre-filling an input. */
export function centsToMoneyText(cents: number | null): string {
  if (cents == null) return ''
  const whole    = Math.trunc(cents / 100)
  const fraction = Math.abs(cents % 100)
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0')}`
}

// ─── Other numbers typed by a human ──────────────────────────────────────────

/** "20", "17.5", "17,25" → 2000 / 1750 / 1725 basis points. Null when it is not a percentage. */
export function parsePercentToBp(input: string): number | null {
  const match = /^(\d{1,2})(?:\.(\d{1,2}))?$/.exec(input.trim().replace(',', '.'))
  if (match == null) return null
  return Number.parseInt(match[1], 10) * 100 + Number.parseInt((match[2] ?? '').padEnd(2, '0'), 10)
}

/** 1750 → "17.5" — the inverse of parsePercentToBp. */
export function bpToPercentText(bp: number): string {
  const whole    = Math.trunc(bp / 100)
  const fraction = bp % 100
  if (fraction === 0) return String(whole)
  return `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`
}

/** Digits only → a whole number; anything else (sign, decimal point, exponent) → null. */
export function parseWholeNumber(input: string): number | null {
  const trimmed = input.trim()
  return /^\d{1,6}$/.test(trimmed) ? Number.parseInt(trimmed, 10) : null
}

/** "4", "4.5", "4,5" → a distance with at most one decimal; anything else → null. */
export function parseKm(input: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d))?$/.exec(input.trim().replace(',', '.'))
  if (match == null) return null
  return Number.parseInt(match[1], 10) + Number.parseInt(match[2] ?? '0', 10) / 10
}

// ─── Base price and the override cap ─────────────────────────────────────────

export interface EditorPriceCell {
  days:            number
  anglers:         number
  guidePriceCents: number
  validFrom:       string | null
  validTo:         string | null
}

/**
 * The row an override is measured against — a mirror of the lookup in the trigger
 * `experience_guides_check_override`: days = 1, anglers = max_anglers_per_guide, valid on
 * `today`, newest `valid_from` first with an undated row last. Null when there is none,
 * in which case the database rejects any override.
 */
export function basePriceCents(
  prices: readonly EditorPriceCell[],
  maxAnglersPerGuide: number,
  today: string,
): number | null {
  const candidates = prices.filter(row =>
    row.days === 1
    && row.anglers === maxAnglersPerGuide
    && (row.validFrom == null || row.validFrom <= today)
    && (row.validTo == null || row.validTo >= today),
  )

  let best: EditorPriceCell | null = null
  for (const row of candidates) {
    const newer = best == null
      || (row.validFrom != null && (best.validFrom == null || row.validFrom > best.validFrom))
    if (newer) best = row
  }
  return best?.guidePriceCents ?? null
}

/** Same integer comparison as the trigger: override × 100 > base × 115. */
export function overrideExceedsCap(overrideCents: number, baseCents: number): boolean {
  return overrideCents * 100 > baseCents * OVERRIDE_CAP_PCT
}

/** The highest override the database accepts for this base price. */
export function overrideLimitCents(baseCents: number): number {
  return Math.floor((baseCents * OVERRIDE_CAP_PCT) / 100)
}

// ─── Guides ──────────────────────────────────────────────────────────────────

const guideRowSchema = z.object({
  guideId:       idSchema,
  role:          z.enum(['primary', 'backup']),
  status:        z.enum(['active', 'paused']),
  showOnPage:    z.boolean(),
  sortOrder:     z.number().int().min(0).max(999),
  overrideCents: positiveCentsSchema.nullable(),
})

export type GuideRowInput = z.infer<typeof guideRowSchema>

export interface GuidesContext {
  /** basePriceCents() of the page as stored right now. */
  baseCents:       number | null
  /** guide id → override currently in the database (absent = no row yet). */
  storedOverrides: ReadonlyMap<string, number | null>
}

/**
 * The whole guide list of a page, as the admin wants it to be.
 *
 * The override rule mirrors the trigger, including *when* it applies: only an override
 * that is new or changed is checked. A stored override that prices have since moved away
 * from is left alone (the trigger does the same on an unrelated UPDATE) — the form shows
 * a warning for it instead.
 */
export function guidesSchema({ baseCents, storedOverrides }: GuidesContext) {
  return z.array(guideRowSchema).max(20, 'At most 20 guides per page').superRefine((rows, ctx) => {
    const seen = new Set<string>()
    for (const [index, row] of rows.entries()) {
      if (seen.has(row.guideId)) {
        ctx.addIssue({ code: 'custom', path: [index, 'guideId'], message: 'The same guide is listed twice' })
      }
      seen.add(row.guideId)
    }

    if (rows.filter(isActivePrimary).length > 1) {
      ctx.addIssue({ code: 'custom', message: 'Only one guide can be the active primary' })
    }

    for (const [index, row] of rows.entries()) {
      if (row.overrideCents == null) continue
      if (storedOverrides.get(row.guideId) === row.overrideCents) continue

      if (baseCents == null) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'overrideCents'],
          message: 'Price override rejected: the price grid has no current base row (1 day × max anglers per guide) to measure it against',
        })
      } else if (overrideExceedsCap(row.overrideCents, baseCents)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'overrideCents'],
          message: `Price override ${row.overrideCents} exceeds 115% of the base price ${baseCents} (limit ${overrideLimitCents(baseCents)})`,
        })
      }
    }
  })
}

export function isActivePrimary(row: { role: string; status: string }): boolean {
  return row.role === 'primary' && row.status === 'active'
}

// ─── Mode and price ──────────────────────────────────────────────────────────

export const offerSchema = z
  .object({
    offerMode:          z.enum(['fixed', 'custom']),
    priceFromCents:     centsSchema.nullable(),
    priceToCents:       centsSchema.nullable(),
    /** fee_pct in basis points: 2000 = 20%. An integer on the wire; the column is numeric(5,4). */
    feeBp:              z.number().int().min(0, 'Fee cannot be negative').max(9999, 'Fee must be below 100%'),
    maxAnglersPerGuide: z.number().int().min(1, 'At least 1 angler per guide').max(MAX_ANGLERS),
    minDays:            z.number().int().min(1, 'At least 1 day').max(MAX_DAYS),
    maxDays:            z.number().int().min(1).max(MAX_DAYS).nullable(),
  })
  .superRefine((offer, ctx) => {
    if (offer.maxDays != null && offer.maxDays < offer.minDays) {
      ctx.addIssue({ code: 'custom', path: ['maxDays'], message: 'Max days cannot be below min days' })
    }
    if (offer.priceFromCents != null && offer.priceToCents != null && offer.priceToCents < offer.priceFromCents) {
      ctx.addIssue({ code: 'custom', path: ['priceToCents'], message: '"Price to" cannot be below "price from"' })
    }
  })

export type OfferInput = z.infer<typeof offerSchema>

// ─── Price grid ──────────────────────────────────────────────────────────────

const priceCellSchema = z
  .object({
    days:            z.number().int().min(1, 'Days must be at least 1').max(MAX_DAYS),
    anglers:         z.number().int().min(1, 'Anglers must be at least 1').max(MAX_ANGLERS),
    guidePriceCents: positiveCentsSchema,
    validFrom:       dateSchema.nullable(),
    validTo:         dateSchema.nullable(),
  })
  .refine(
    cell => cell.validFrom == null || cell.validTo == null || cell.validTo >= cell.validFrom,
    { message: '"Valid to" cannot be before "valid from"', path: ['validTo'] },
  )

/** The page's whole price table. One row per (days, anglers, valid_from) — the table's unique slot. */
export const pricesSchema = z.array(priceCellSchema).max(600, 'Too many price rows').superRefine((cells, ctx) => {
  const seen = new Set<string>()
  for (const [index, cell] of cells.entries()) {
    const key = priceSlotKey(cell)
    if (seen.has(key)) {
      ctx.addIssue({
        code: 'custom',
        path: [index],
        message: `Two prices for ${cell.days} day(s) × ${cell.anglers} angler(s) starting ${cell.validFrom ?? 'undated'}`,
      })
    }
    seen.add(key)
  }
})

export function priceSlotKey(cell: { days: number; anglers: number; validFrom: string | null }): string {
  return `${cell.days}|${cell.anglers}|${cell.validFrom ?? ''}`
}

// ─── Content (S3–S9, S11–S13) ────────────────────────────────────────────────

/** day_schedule item — proposal §2.5: [{time, title, meta:{drive_min, walk_km, wading}}]. */
const dayScheduleItemSchema = z.object({
  time:  text(20),
  title: text(200).min(1, 'Every schedule row needs a title'),
  meta:  z.object({
    drive_min: z.number().int().min(0).max(1440).nullable(),
    walk_km:   kmSchema.nullable(),
    wading:    z.boolean(),
  }),
})

/** suggested_lodging item — proposal §2.5: [{name, url, note}]. */
const lodgingItemSchema = z.object({
  name: text(200).min(1, 'Every lodging row needs a name'),
  url:  httpUrlSchema.nullable(),
  note: optionalText(300),
})

/** license_info — proposal §2.5: {required, buy_url, steps[], price_text}. */
const licenseInfoSchema = z.object({
  required:   z.boolean(),
  buy_url:    httpUrlSchema.nullable(),
  steps:      lineList(12),
  price_text: optionalText(200),
})

export const dayScheduleSchema      = z.array(dayScheduleItemSchema).max(30, 'At most 30 schedule rows')
export const suggestedLodgingSchema = z.array(lodgingItemSchema).max(20, 'At most 20 lodging rows')
export const licenseInfoOrNullSchema = licenseInfoSchema.nullable()

export type DayScheduleItem = z.infer<typeof dayScheduleItemSchema>
export type LodgingItem     = z.infer<typeof lodgingItemSchema>
export type LicenseInfo     = z.infer<typeof licenseInfoSchema>

export const contentSchema = z
  .object({
    suitedFor:         lineList(20),
    notSuitedFor:      lineList(20),
    expectationsText:  optionalText(4000),
    skillLevel:        z.number().int().min(1).max(5).nullable(),
    walkingKmMin:      kmSchema.nullable(),
    walkingKmMax:      kmSchema.nullable(),
    daySchedule:       dayScheduleSchema,
    nearestAirport:    optionalText(200),
    suggestedLodging:  suggestedLodgingSchema,
    licenseInfo:       licenseInfoOrNullSchema,
    tipGuidanceText:   optionalText(2000),
    weatherPolicyText: optionalText(4000),
    responseSlaHours:  z.number().int().min(1, 'Response time must be at least 1 hour').max(720),
    offerEtaText:      optionalText(200),
  })
  .refine(
    c => c.walkingKmMin == null || c.walkingKmMax == null || c.walkingKmMax >= c.walkingKmMin,
    { message: 'Walking distance: max cannot be below min', path: ['walkingKmMax'] },
  )

export type ContentInput = z.infer<typeof contentSchema>

// ─── Options ─────────────────────────────────────────────────────────────────

/** sample_itinerary item — proposal §2.4: [{day, title, waters, lodging, meals, transfer, notes}]. */
const itineraryItemSchema = z.object({
  day:      z.number().int().min(1).max(MAX_DAYS),
  title:    text(200).min(1, 'Every itinerary day needs a title'),
  waters:   text(300),
  lodging:  text(300),
  meals:    text(300),
  transfer: text(300),
  notes:    text(1000),
})

export const sampleItinerarySchema = z.array(itineraryItemSchema).max(MAX_DAYS, 'Too many itinerary days')

export type ItineraryItem = z.infer<typeof itineraryItemSchema>

export const optionV2Schema = z
  .object({
    kind:            z.enum(['variant', 'archetype', 'addon']),
    priceFromCents:  centsSchema.nullable(),
    priceToCents:    centsSchema.nullable(),
    durationDaysMin: z.number().int().min(1).max(MAX_DAYS).nullable(),
    durationDaysMax: z.number().int().min(1).max(MAX_DAYS).nullable(),
    sampleItinerary: sampleItinerarySchema,
  })
  .superRefine((option, ctx) => {
    if (option.priceFromCents != null && option.priceToCents != null && option.priceToCents < option.priceFromCents) {
      ctx.addIssue({ code: 'custom', path: ['priceToCents'], message: '"Price to" cannot be below "price from"' })
    }
    if (option.durationDaysMin != null && option.durationDaysMax != null && option.durationDaysMax < option.durationDaysMin) {
      ctx.addIssue({ code: 'custom', path: ['durationDaysMax'], message: 'Max duration cannot be below min duration' })
    }
  })

export type OptionV2Input = z.infer<typeof optionV2Schema>

// ─── Publication ─────────────────────────────────────────────────────────────

export const pageVersionSchema = z.union([z.literal(1), z.literal(2)], 'Page version must be 1 or 2')

/**
 * What a page must have before it may render the v2 template. Each message names the
 * section of the editor where the gap is closed, because the error is shown as a list.
 */
const v2ReadinessSchema = z.object({
  priceFromCents:      z.number('a "from" price greater than 0 (Mode and price)').positive('a "from" price greater than 0 (Mode and price)'),
  activePrimaryGuides: z.number().min(1, 'an active primary guide (Guides)'),
  suitedFor:           z.array(z.string()).min(1, 'at least one "Suited for" line (Content)'),
})

export interface V2Readiness {
  priceFromCents:      number | null
  activePrimaryGuides: number
  suitedFor:           readonly string[]
}

/** Empty when the page may be switched to v2; otherwise everything that is missing, at once. */
export function missingForV2(state: V2Readiness): string[] {
  const parsed = v2ReadinessSchema.safeParse(state)
  return parsed.success ? [] : parsed.error.issues.map(issue => issue.message)
}

// ─── Error text ──────────────────────────────────────────────────────────────

/** Every issue, not just the first — the admin fixes a form in one pass. */
export function formatIssues(error: z.ZodError): string {
  return [...new Set(error.issues.map(issue => issue.message))].join('; ')
}
