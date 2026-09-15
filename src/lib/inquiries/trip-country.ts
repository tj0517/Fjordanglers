/**
 * `inquiries.trip_country` for inquiries that arrive without an experience page.
 *
 * The website form knows the destination at insert time and writes it there
 * (`createInquiry`, `tripCountry`). Inquiries that come in by e-mail or WhatsApp have
 * no experience page, so the first moment their destination is known for certain is
 * when FA assigns a guide — a guide works in exactly one country.
 *
 * This returns a *patch* rather than running its own `update()`: the caller merges it
 * into the same statement that writes `assigned_guide_id`, so the country can never
 * end up written without the assignment or the other way round.
 *
 * A country already on the inquiry is never overwritten — the page-derived value and
 * the AI classification both outrank a guess made from the guide.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { COUNTRIES } from '@/lib/countries'

/** Canonical `COUNTRIES` entry for a raw DB value, or null if it is not one of ours. */
function canonicalCountry(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  return COUNTRIES.find(c => c.toLowerCase() === trimmed.toLowerCase()) ?? null
}

/**
 * Returns `{ trip_country }` when the inquiry has no country yet and the guide has a
 * usable one, otherwise `{}`. Spread into the `update()` that sets `assigned_guide_id`.
 */
export async function tripCountryPatchFromGuide(
  inquiryId: string,
  guideId: string | null,
): Promise<{ trip_country?: string }> {
  if (guideId == null) return {}

  const svc = createServiceClient()

  const { data: inquiry } = await svc
    .from('inquiries')
    .select('trip_country')
    .eq('id', inquiryId)
    .single()

  // Already known (from the experience page or from the AI classification) — leave it.
  if (inquiry == null || canonicalCountry(inquiry.trip_country) != null) return {}

  const { data: guide } = await svc
    .from('guides')
    .select('country')
    .eq('id', guideId)
    .single()

  const country = canonicalCountry(guide?.country)
  if (country == null) {
    console.log(
      `[trip-country] Guide ${guideId} has no usable country (${JSON.stringify(guide?.country ?? null)}) — inquiry ${inquiryId} stays NULL`,
    )
    return {}
  }

  return { trip_country: country }
}
