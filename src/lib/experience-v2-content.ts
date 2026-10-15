/**
 * Typed readers for the free-form columns of a v2 offer page (FA-1.54).
 *
 * `species_details`, `license_info`, `day_schedule`, `season_periods` and `sample_itinerary` are `jsonb`, so
 * the database promises nothing about their shape and an admin can save anything. These
 * readers keep what is usable and drop the rest instead of throwing — a malformed entry
 * costs one line on the page, never the page. No casts: every field is checked.
 *
 * The expected shapes are the ones in docs/proposals/2026-10-05-experience-offer-centric.md
 * §2.4–2.5; `species_details` is the existing `SpeciesDetailItem` of the v1 admin form.
 */

import type { Json } from '@/lib/supabase/database.types'
import { pageBlockSection, type ContentBlockSection } from '@/lib/experiences/v2-editor'

type Dict = { [key: string]: Json | undefined }

function isDict(value: Json | undefined): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: Json | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function num(value: Json | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function entries(value: Json | null | undefined): Dict[] {
  return Array.isArray(value) ? value.filter(isDict) : []
}

/**
 * Only `http(s)` URLs may become links (the value is admin-typed text, and `javascript:`
 * is the classic way an href turns into code). Anything else returns null and the caller
 * prints the text instead.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (value == null) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/** Names of the target species, in the order the admin stored them. */
export function speciesNames(value: Json | null | undefined): string[] {
  return entries(value).flatMap(item => {
    const name = text(item.name)
    return name == null ? [] : [name]
  })
}

/** `experience_pages.license_info` — `{required, buy_url, steps[], price_text}`. */
export type LicenseInfo = {
  required:  boolean
  /** Already checked: an `http(s)` URL or null. The only form that may become a link. */
  buyUrl:    string | null
  /** A `buy_url` that is not an `http(s)` URL — shown as plain text, never as a link. */
  buyText:   string | null
  priceText: string | null
  steps:     string[]
}

/** Null when the column is empty or says nothing a visitor could use. */
export function parseLicenseInfo(value: Json | null | undefined): LicenseInfo | null {
  if (!isDict(value)) return null

  const steps = Array.isArray(value.steps)
    ? value.steps.flatMap(step => {
        const line = text(step)
        return line == null ? [] : [line]
      })
    : []

  const rawBuyUrl = text(value.buy_url)
  const buyUrl    = safeHttpUrl(rawBuyUrl)

  const info: LicenseInfo = {
    // Absent means required: a page that bothers to describe a licence is describing one.
    required:  value.required !== false,
    buyUrl,
    buyText:   buyUrl == null ? rawBuyUrl : null,
    priceText: text(value.price_text),
    steps,
  }

  const hasContent = info.buyUrl != null || info.buyText != null || info.priceText != null || info.steps.length > 0
  return hasContent || value.required === true ? info : null
}

/**
 * One line of a `fixed` page's day — `[{time, title, description}]`. Rows written before
 * feedback round 1 carry `meta: {drive_min, walk_km, wading}` instead of a description: the
 * meta is not read (it is never shown) and such a row is `{time, title, description: null}`.
 */
export type DayStep = {
  /** '' when the row has no time — the gutter stays, empty. */
  time:        string
  title:       string
  description: string | null
}

export function parseDaySchedule(value: Json | null | undefined): DayStep[] {
  return entries(value).flatMap(item => {
    const title = text(item.title)
    if (title == null) return []
    return [{ time: text(item.time) ?? '', title, description: text(item.description) }]
  })
}

/**
 * `experience_pages.season_periods` — `[{title, months, text}]` (feedback round 1): what one
 * part of the season is like, shown under the season bar for each of its months.
 *
 * Months outside 1–12 or not whole are dropped; a month already claimed by an earlier period
 * is dropped from the later one, so every month maps to at most one period even if the
 * stored data says otherwise. A period with no title or no month left is skipped.
 */
export type SeasonPeriod = {
  title:  string
  months: number[]
  /** Null when the admin wrote none — such a period does not open the panel. */
  text:   string | null
}

export function parseSeasonPeriods(value: Json | null | undefined): SeasonPeriod[] {
  const claimed = new Set<number>()
  return entries(value).flatMap(item => {
    const title = text(item.title)
    if (title == null || !Array.isArray(item.months)) return []

    const months = item.months.flatMap(month => {
      const n = num(month)
      if (n == null || !Number.isInteger(n) || n < 1 || n > 12 || claimed.has(n)) return []
      claimed.add(n)
      return [n]
    })
    return months.length === 0 ? [] : [{ title, months: months.sort((a, b) => a - b), text: text(item.text) }]
  })
}

/** One day of an archetype — `[{day, title, waters, lodging, meals, transfer, notes}]`. */
export type ItineraryDay = {
  day:     number
  title:   string
  details: { label: string; value: string }[]
}

export function parseItinerary(value: Json | null | undefined): ItineraryDay[] {
  return entries(value).flatMap((item, index) => {
    const title = text(item.title)
    if (title == null) return []

    const details = [
      { label: 'Waters',   value: text(item.waters) },
      { label: 'Lodging',  value: text(item.lodging) },
      { label: 'Meals',    value: text(item.meals) },
      { label: 'Transfer', value: text(item.transfer) },
      { label: 'Notes',    value: text(item.notes) },
    ].flatMap(d => (d.value == null ? [] : [{ label: d.label, value: d.value }]))

    return [{ day: num(item.day) ?? index + 1, title, details }]
  })
}

/**
 * `guides.languages` stores ISO codes ("en", "is"); the page says "English", "Icelandic".
 * A value that is not a language code is printed as stored rather than dropped.
 */
export function languageNames(codes: readonly string[]): string[] {
  let display: Intl.DisplayNames | null = null
  try {
    display = new Intl.DisplayNames(['en'], { type: 'language' })
  } catch {
    display = null
  }

  return codes.flatMap(raw => {
    const code = raw.trim()
    if (code === '') return []
    // Only a real language code is translated. Anything else ("English", typed by hand) is
    // printed as stored: `Intl` would happily lowercase it into "english".
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(code)) return [code]
    try {
      return [display?.of(code) ?? code]
    } catch {
      return [code]
    }
  })
}

/** `experience_pages.suggested_lodging` — `[{name, url, note}]` (proposal §2.5, FA-1.55). */
export type LodgingSuggestion = {
  name: string
  /** Already checked: an `http(s)` URL or null. The only form that may become a link. */
  url:  string | null
  note: string | null
}

/** Rows without a name are dropped: a link with no name is nothing a visitor can act on. */
export function parseSuggestedLodging(value: Json | null | undefined): LodgingSuggestion[] {
  return entries(value).flatMap(item => {
    const name = text(item.name)
    if (name == null) return []
    return [{ name, url: safeHttpUrl(text(item.url)), note: text(item.note) }]
  })
}

/** `experience_pages.faq` — `[{question, answer}]`, as the v1 admin form stores it. */
export type FaqEntry = { question: string; answer: string }

/** Both halves are required: a question with no answer is worse than no question. */
export function parseFaq(value: Json | null | undefined): FaqEntry[] {
  return entries(value).flatMap(item => {
    const question = text(item.question)
    const answer   = text(item.answer)
    return question == null || answer == null ? [] : [{ question, answer }]
  })
}

/**
 * `experience_pages.content_blocks` — `[{headline, text, image_url?, image_urls?, section?}]`,
 * the v1 admin form's `ContentBlock`. `image_urls` is the block's gallery and wins when
 * present; a block written before the gallery has only `image_url`, read as a gallery of one.
 * Photos may be a site path (`/photo.jpg`) or an http(s) URL; anything else is dropped, the
 * block itself is kept. A block with neither headline nor text is nothing to show.
 * `section` is "waters" only when stored as exactly that; anything else — absent, "programs",
 * a value this reader does not know — is "programs", where every older block already shows.
 */
export type StoryBlock = {
  headline:  string | null
  text:      string | null
  /** The block's photos in order; the first is the cover. Empty = no photo. */
  imageUrls: string[]
  section:   ContentBlockSection
}

function imageUrl(value: Json | undefined): string | null {
  const raw = text(value)
  if (raw == null) return null
  return raw.startsWith('/') ? raw : safeHttpUrl(raw)
}

function blockImageUrls(item: Dict): string[] {
  if (Array.isArray(item.image_urls)) {
    return item.image_urls.flatMap(url => {
      const checked = imageUrl(url)
      return checked == null ? [] : [checked]
    })
  }
  const cover = imageUrl(item.image_url)
  return cover == null ? [] : [cover]
}

export function parseContentBlocks(value: Json | null | undefined): StoryBlock[] {
  return entries(value).flatMap(item => {
    const headline = text(item.headline)
    const body     = text(item.text)
    return headline == null && body == null
      ? []
      : [{ headline, text: body, imageUrls: blockImageUrls(item), section: pageBlockSection(item) }]
  })
}

/** `species_details` with its description and photo — the "what you fish for" cards. */
export type SpeciesDetail = { name: string; description: string | null; imageUrl: string | null }

export function parseSpeciesDetails(value: Json | null | undefined): SpeciesDetail[] {
  return entries(value).flatMap(item => {
    const name = text(item.name)
    return name == null ? [] : [{ name, description: text(item.description), imageUrl: imageUrl(item.image_url) }]
  })
}
