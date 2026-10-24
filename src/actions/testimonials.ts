'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { COUNTRIES } from '@/lib/countries'
import { ANGLER_COUNTRIES } from '@/lib/angler-countries'
import { env } from '@/lib/env'
import { DESTINATION_HUBS } from '@/lib/destinations'

// ─── Constraint name → human message ─────────────────────────────────────────
// The two rules that matter (Trustpilot link, consent before active) are enforced by the
// database only, so a different caller cannot skip them; this map turns the violation into
// a sentence for the form instead of a 500.

const CONSTRAINT_MESSAGES: Record<string, string> = {
  testimonials_active_needs_consent:
    'A testimonial cannot be active without the client’s consent. Tick the consent box first.',
  testimonials_trustpilot_needs_url:
    'A Trustpilot testimonial needs the link to its review on trustpilot.com (https://…trustpilot.com/…).',
  testimonials_source_url_https:
    'The link must start with https://.',
  testimonials_quote_not_blank:        'Quote cannot be blank.',
  testimonials_quote_length:           'Quote is too long — 1000 characters at most.',
  testimonials_author_name_not_blank:  'Name cannot be blank.',
  testimonials_author_name_length:     'Name is too long — 80 characters at most.',
  testimonials_author_country_check:   'Unknown client country.',
  testimonials_trip_country_check:     'Unknown trip country.',
  testimonials_rating_check:           'Rating must be 1–5.',
  testimonials_photo_layout_check:     'Unknown photo layout.',
  testimonials_source_check:           'Unknown source.',
  testimonials_consent_note_length:    'Consent note is too long — 1000 characters at most.',
}

// ─── After every change: the admin list and every page that shows the banner ──
// Without this a public page keeps its rendered testimonial until its ISR window ends —
// up to an hour on an offer page, also after consent is withdrawn (tj FA-1.69 D3 B). Hubs
// by their literal paths: the route sits in a route group, and a literal path needs none.

function revalidateTestimonialPages(): void {
  revalidatePath('/admin/testimonials')
  revalidatePath('/')
  for (const hub of DESTINATION_HUBS) revalidatePath(`/${hub.slug}`)
  revalidatePath('/experiences/[slug]', 'page')
}

function mapDbError(message: string): string {
  for (const [constraint, human] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (message.includes(constraint)) return human
  }
  return message
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

/**
 * Photos are accepted only from our own bucket, folder `testimonials/` (tj D2 a,
 * 2026-10-24): on prod that prefix is https, and nobody can paste someone else's image.
 * The URL is compared in its normalised form, so `testimonials/../x.jpg` does not pass.
 */
function isTestimonialPhotoUrl(value: string): boolean {
  const prefix = new URL(
    '/storage/v1/object/public/guide-photos/testimonials/',
    env.NEXT_PUBLIC_SUPABASE_URL,
  ).href
  try {
    const href = new URL(value).href
    return href === value && href.startsWith(prefix) && href.length > prefix.length
  } catch {
    return false
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/** Optional text: trimmed, and an empty string is stored as NULL. */
const optionalText = (max: number, tooLong: string) =>
  z.string().trim().max(max, tooLong).nullable()
    .transform(v => (v == null || v === '' ? null : v))

const TestimonialPayloadSchema = z.object({
  quote:          z.string().trim()
                    .min(1, 'Quote cannot be blank')
                    .max(1000, 'Quote is too long — 1000 characters at most'),
  author_name:    z.string().trim()
                    .min(1, 'Name cannot be blank')
                    .max(80, 'Name is too long — 80 characters at most'),
  author_country: z.string()
                    .refine(c => ANGLER_COUNTRIES.some(a => a.code === c && c !== 'ZZ'), 'Unknown client country')
                    .nullable(),
  trip_country:   z.string()
                    .refine(c => (COUNTRIES as readonly string[]).includes(c), 'Unknown trip country')
                    .nullable(),
  rating:         z.number().int().min(1, 'Rating must be 1–5').max(5, 'Rating must be 1–5').nullable(),
  photo_url:      z.string()
                    .refine(isTestimonialPhotoUrl, 'The photo must be uploaded with the photo field above')
                    .nullable(),
  /** How the banner shows that photo (FA-1.71); ignored when there is none. */
  photo_layout:   z.enum(['horizontal', 'vertical']),
  source:         z.enum(['trustpilot', 'direct']),
  source_url:     z.string().trim()
                    .refine(isHttpsUrl, 'The link must be a full https:// address')
                    .nullable(),
  /** The admin ticked "I have the client's consent…" — sets or keeps consent_confirmed_at. */
  consent_confirmed: z.boolean(),
  consent_note:   optionalText(1000, 'Consent note is too long — 1000 characters at most'),
  is_active:      z.boolean(),
})

export type TestimonialPayload = z.input<typeof TestimonialPayloadSchema>

export type TestimonialActionResult =
  | { success: true }
  | { success: false; error: string }

const IdSchema = z.string().uuid()

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Validation error'
}

/** Columns written from a validated payload; consent is resolved by the caller. */
function toColumns(p: z.output<typeof TestimonialPayloadSchema>) {
  return {
    quote:          p.quote,
    author_name:    p.author_name,
    author_country: p.author_country,
    trip_country:   p.trip_country,
    rating:         p.rating,
    photo_url:      p.photo_url,
    // No photo, no choice to store — a stale 'vertical' on a row without a photo would
    // reappear the next time a photo is uploaded.
    photo_layout:   p.photo_url != null ? p.photo_layout : 'horizontal',
    source:         p.source,
    // A direct testimonial carries no review link — the field is hidden in the form.
    source_url:     p.source === 'trustpilot' ? p.source_url : null,
    consent_note:   p.consent_note,
    is_active:      p.is_active,
  }
}

// ─── createTestimonial ────────────────────────────────────────────────────────

export async function createTestimonial(
  payload: TestimonialPayload,
): Promise<TestimonialActionResult> {
  await requireAdmin()

  const parsed = TestimonialPayloadSchema.safeParse(payload)
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error) }

  const supabase = createServiceClient()

  // A new testimonial goes to the end of the list; the admin moves it up from there.
  const { data: last, error: lastError } = await supabase
    .from('testimonials')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastError != null) return { success: false, error: mapDbError(lastError.message) }

  const { error } = await supabase
    .from('testimonials')
    .insert({
      ...toColumns(parsed.data),
      consent_confirmed_at: parsed.data.consent_confirmed ? new Date().toISOString() : null,
      sort_order:           (last?.sort_order ?? -1) + 1,
    })

  if (error != null) return { success: false, error: mapDbError(error.message) }

  revalidateTestimonialPages()
  return { success: true }
}

// ─── updateTestimonial ────────────────────────────────────────────────────────

export async function updateTestimonial(
  id: string,
  payload: TestimonialPayload,
): Promise<TestimonialActionResult> {
  await requireAdmin()

  if (!IdSchema.safeParse(id).success) return { success: false, error: 'Invalid testimonial id' }

  const parsed = TestimonialPayloadSchema.safeParse(payload)
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error) }

  const supabase = createServiceClient()

  const { data: current, error: readError } = await supabase
    .from('testimonials')
    .select('consent_confirmed_at')
    .eq('id', id)
    .maybeSingle()
  if (readError != null) return { success: false, error: mapDbError(readError.message) }
  if (current == null) return { success: false, error: 'Testimonial not found' }

  // Ticked and already recorded → keep the original moment; ticked now → now; unticked → none.
  const consentConfirmedAt = parsed.data.consent_confirmed
    ? (current.consent_confirmed_at ?? new Date().toISOString())
    : null

  const { data, error } = await supabase
    .from('testimonials')
    .update({ ...toColumns(parsed.data), consent_confirmed_at: consentConfirmedAt })
    .eq('id', id)
    .select('id')

  if (error != null) return { success: false, error: mapDbError(error.message) }
  if ((data ?? []).length === 0) return { success: false, error: 'Testimonial not found' }

  revalidateTestimonialPages()
  return { success: true }
}

// ─── setTestimonialActive ─────────────────────────────────────────────────────

export async function setTestimonialActive(
  id: string,
  active: boolean,
): Promise<TestimonialActionResult> {
  await requireAdmin()

  if (!IdSchema.safeParse(id).success) return { success: false, error: 'Invalid testimonial id' }
  if (!z.boolean().safeParse(active).success) return { success: false, error: 'Invalid value' }

  const { data, error } = await createServiceClient()
    .from('testimonials')
    .update({ is_active: active })
    .eq('id', id)
    .select('id')

  if (error != null) return { success: false, error: mapDbError(error.message) }
  if ((data ?? []).length === 0) return { success: false, error: 'Testimonial not found' }

  revalidateTestimonialPages()
  return { success: true }
}

// ─── moveTestimonial ──────────────────────────────────────────────────────────

/**
 * Moves one testimonial a step up or down the list (O-46 a: manual order). The whole list
 * is renumbered 0…n-1 in its new order, so rows that shared a sort_order get distinct ones.
 * The rows are written one by one: a failure half-way leaves an order that is still valid,
 * just not the one asked for — the admin sees the error and moves again.
 */
export async function moveTestimonial(
  id: string,
  direction: 'up' | 'down',
): Promise<TestimonialActionResult> {
  await requireAdmin()

  if (!IdSchema.safeParse(id).success) return { success: false, error: 'Invalid testimonial id' }
  if (!z.enum(['up', 'down']).safeParse(direction).success) return { success: false, error: 'Invalid direction' }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('testimonials')
    .select('id, sort_order')
    .order('sort_order')
    .order('created_at')
  if (error != null) return { success: false, error: mapDbError(error.message) }

  const rows = data ?? []
  const from = rows.findIndex(r => r.id === id)
  if (from === -1) return { success: false, error: 'Testimonial not found' }

  const to = direction === 'up' ? from - 1 : from + 1
  if (to < 0 || to >= rows.length) return { success: true }

  const ordered = [...rows]
  ;[ordered[from], ordered[to]] = [ordered[to], ordered[from]]

  for (const [index, row] of ordered.entries()) {
    if (row.sort_order === index) continue
    const { error: writeError } = await supabase
      .from('testimonials')
      .update({ sort_order: index })
      .eq('id', row.id)
    if (writeError != null) return { success: false, error: mapDbError(writeError.message) }
  }

  revalidateTestimonialPages()
  return { success: true }
}
