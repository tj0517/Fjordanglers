/**
 * Experience lookup for inquiries.
 *
 * An inquiry points at an `experience_pages` row in one of two ways:
 *   - `experience_page_id` (new inquiries, see `create.ts`), or
 *   - `trip_id` (legacy inquiries; `experience_pages.trip_id` is the bridge).
 *
 * Every place that needs the trip title, slug, country, price or guide of an inquiry
 * goes through this module instead of hard-coding a literal. Resolution order is always
 * `experience_page_id` first, then `experience_pages.trip_id = trip_id`.
 *
 * No `'use server'` here on purpose: these are plain server-side helpers, not
 * client-callable actions. They never throw — a lookup failure must not take down an
 * email, a Stripe call or a webhook — they log and return null / an empty Map.
 */

import { createServiceClient } from '@/lib/supabase/server'

export interface InquiryExperience {
  id:         string
  name:       string
  slug:       string
  country:    string
  guideId:    string | null
  priceFrom:  number
  priceType:  string
  currency:   string
}

export interface ExperienceRef {
  experience_page_id: string | null
  trip_id:            string | null
}

export const TRIP_TITLE_FALLBACK = 'Your trip'
export const GUIDE_NAME_FALLBACK = 'Your guide'

export function tripTitleOf(exp: InquiryExperience | null): string {
  return exp?.name ?? TRIP_TITLE_FALLBACK
}

const EXPERIENCE_COLUMNS =
  'id, experience_name, slug, country, guide_id, price_from, price_type, currency, trip_id, created_at'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ExperiencePageRow {
  id:              string
  experience_name: string
  slug:            string
  country:         string
  guide_id:        string | null
  price_from:      number
  price_type:      string
  currency:        string
  trip_id:         string | null
  created_at:      string
}

function toExperience(row: ExperiencePageRow): InquiryExperience {
  return {
    id:        row.id,
    name:      row.experience_name,
    slug:      row.slug,
    country:   row.country,
    guideId:   row.guide_id,
    priceFrom: row.price_from,
    priceType: row.price_type,
    currency:  row.currency,
  }
}

/**
 * Resolve the experience of one inquiry. Returns null when neither reference is set,
 * when nothing matches, or when the database errors (logged, never thrown).
 */
export async function getInquiryExperience(ref: ExperienceRef): Promise<InquiryExperience | null> {
  if (!ref.experience_page_id && !ref.trip_id) return null

  const supabase = createServiceClient()

  if (ref.experience_page_id) {
    const { data, error } = await supabase
      .from('experience_pages')
      .select(EXPERIENCE_COLUMNS)
      .eq('id', ref.experience_page_id)
      .maybeSingle()
    if (error) {
      console.error('[experience-lookup] lookup by experience_page_id failed:', error.message)
      return null
    }
    if (data) return toExperience(data)
  }

  if (ref.trip_id) {
    // experience_pages.trip_id has no UNIQUE constraint; uniqueness is today's fact,
    // not a guarantee, hence ordered limit(1) instead of single().
    const { data, error } = await supabase
      .from('experience_pages')
      .select(EXPERIENCE_COLUMNS)
      .eq('trip_id', ref.trip_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[experience-lookup] lookup by trip_id failed:', error.message)
      return null
    }
    if (data) return toExperience(data)
  }

  return null
}

/**
 * Resolve the experience of many inquiries with ONE query. The returned Map is keyed by
 * INQUIRY id; inquiries that resolve to nothing are absent.
 */
export async function getInquiryExperiences(
  rows: Array<ExperienceRef & { id: string }>,
): Promise<Map<string, InquiryExperience>> {
  const result = new Map<string, InquiryExperience>()

  const pageIds = new Set<string>()
  const tripIds = new Set<string>()
  for (const row of rows) {
    if (row.experience_page_id && UUID_RE.test(row.experience_page_id)) pageIds.add(row.experience_page_id)
    if (row.trip_id && UUID_RE.test(row.trip_id)) tripIds.add(row.trip_id)
  }
  if (pageIds.size === 0 && tripIds.size === 0) return result

  const filters: string[] = []
  if (pageIds.size > 0) filters.push(`id.in.(${[...pageIds].join(',')})`)
  if (tripIds.size > 0) filters.push(`trip_id.in.(${[...tripIds].join(',')})`)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('experience_pages')
    .select(EXPERIENCE_COLUMNS)
    .or(filters.join(','))
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[experience-lookup] batch lookup failed:', error.message)
    return result
  }

  const byPageId = new Map<string, ExperiencePageRow>()
  const byTripId = new Map<string, ExperiencePageRow>()
  for (const page of data ?? []) {
    byPageId.set(page.id, page)
    // Rows arrive ordered by created_at asc: the first one per trip_id is the earliest.
    if (page.trip_id && !byTripId.has(page.trip_id)) byTripId.set(page.trip_id, page)
  }

  for (const row of rows) {
    const page =
      (row.experience_page_id ? byPageId.get(row.experience_page_id) : undefined) ??
      (row.trip_id ? byTripId.get(row.trip_id) : undefined)
    if (page) result.set(row.id, toExperience(page))
  }

  return result
}
