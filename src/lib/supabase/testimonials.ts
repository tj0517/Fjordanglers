/**
 * Testimonials (FA-1.68) — the only reader of `public.testimonials`.
 *
 * The table has RLS with no policy and no grant for anon or authenticated (tj D3,
 * 2026-10-24), so every read goes through the service role, on the server. The public
 * read selects public columns by name: `consent_note` is internal and never leaves here
 * except to the admin form, behind requireAdmin().
 *
 * Import only in Server Components or Server Actions — never in Client Components.
 */

import { z } from 'zod'
import { createServiceClient } from './server'
import { requireAdmin } from '@/lib/auth/guards'

// ─── Public read — the banner (FA-1.69) ──────────────────────────────────────

/** What a public page may show. Deliberately has no consent field of any kind. */
export type Testimonial = {
  id:            string
  quote:         string
  authorName:    string
  /** ISO 3166-1 alpha-2, as `inquiries.angler_country`. */
  authorCountry: string | null
  /** Destination name from COUNTRIES; null = a general testimonial. */
  tripCountry:   string | null
  rating:        number | null
  photoUrl:      string | null
  source:        'trustpilot' | 'direct'
  /** Link to the original review; always set for `trustpilot` (database rule). */
  sourceUrl:     string | null
}

const PUBLIC_COLUMNS =
  'id, quote, author_name, author_country, trip_country, rating, photo_url, source, source_url'

type PublicRow = {
  id:             string
  quote:          string
  author_name:    string
  author_country: string | null
  trip_country:   string | null
  rating:         number | null
  photo_url:      string | null
  source:         string
  source_url:     string | null
}

function toTestimonial(row: PublicRow): Testimonial {
  return {
    id:            row.id,
    quote:         row.quote,
    authorName:    row.author_name,
    authorCountry: row.author_country,
    tripCountry:   row.trip_country,
    rating:        row.rating,
    photoUrl:      row.photo_url,
    source:        row.source === 'trustpilot' ? 'trustpilot' : 'direct',
    sourceUrl:     row.source_url,
  }
}

/**
 * The one testimonial a page shows (O-46 a): the first active row by `sort_order` whose
 * `trip_country` is one of the page's countries, else the first active general row, else null.
 * A list because a hub can cover several countries (Patagonia = Argentina + Chile, tj
 * FA-1.69 2B); an offer page passes its one country, the home page none (tj FA-1.69 1A).
 *
 * Active implies consent (`testimonials_active_needs_consent`); the consent filter is
 * repeated here so that no future change to that rule can put an unconsented row on a page.
 * The table holds a handful of rows, so one query reads every candidate and the pick is
 * made here — no country string goes into a filter expression.
 */
export async function getTestimonial(countries: readonly string[]): Promise<Testimonial | null> {
  const { data, error } = await createServiceClient()
    .from('testimonials')
    .select(PUBLIC_COLUMNS)
    .eq('is_active', true)
    .not('consent_confirmed_at', 'is', null)
    .order('sort_order')
    .order('created_at')

  if (error != null) {
    console.error('[getTestimonial] read failed:', error.message)
    return null
  }

  const rows = data ?? []
  const match =
    rows.find(r => r.trip_country != null && countries.includes(r.trip_country)) ??
    rows.find(r => r.trip_country == null)

  return match != null ? toTestimonial(match) : null
}

// ─── Admin read — /admin/testimonials ────────────────────────────────────────

export type TestimonialAdminRow = Testimonial & {
  isActive:           boolean
  sortOrder:          number
  consentConfirmedAt: string | null
  /** Internal note on how consent was given. Admin only. */
  consentNote:        string | null
  updatedAt:          string
}

const ADMIN_COLUMNS =
  `${PUBLIC_COLUMNS}, is_active, sort_order, consent_confirmed_at, consent_note, updated_at`

type AdminRow = PublicRow & {
  is_active:            boolean
  sort_order:           number
  consent_confirmed_at: string | null
  consent_note:         string | null
  updated_at:           string
}

function toAdminRow(row: AdminRow): TestimonialAdminRow {
  return {
    ...toTestimonial(row),
    isActive:           row.is_active,
    sortOrder:          row.sort_order,
    consentConfirmedAt: row.consent_confirmed_at,
    consentNote:        row.consent_note,
    updatedAt:          row.updated_at,
  }
}

/** Every testimonial in display order. Checks the caller itself: it returns `consent_note`. */
export async function listTestimonialsForAdmin(): Promise<TestimonialAdminRow[]> {
  await requireAdmin()

  const { data, error } = await createServiceClient()
    .from('testimonials')
    .select(ADMIN_COLUMNS)
    .order('sort_order')
    .order('created_at')

  if (error != null) throw new Error(`listTestimonialsForAdmin: ${error.message}`)
  return (data ?? []).map(toAdminRow)
}

/** One testimonial for the edit form, or null when the id does not exist. */
export async function getTestimonialForAdmin(id: string): Promise<TestimonialAdminRow | null> {
  await requireAdmin()
  // A malformed id is "not found", not a 22P02 from Postgres and a 500 page.
  if (!z.string().uuid().safeParse(id).success) return null

  const { data, error } = await createServiceClient()
    .from('testimonials')
    .select(ADMIN_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error != null) throw new Error(`getTestimonialForAdmin: ${error.message}`)
  return data != null ? toAdminRow(data) : null
}
