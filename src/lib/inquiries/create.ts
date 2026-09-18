/**
 * Single insert path for `inquiries`.
 *
 * Both the public widget (`source: 'web_form'`, via `api/inquiries/route.ts`)
 * and the admin "new inquiry" form (`source: 'manual'`, via `createManualInquiry`
 * in `src/actions/inquiries.ts`) go through this function. No other code should
 * insert into `inquiries` directly.
 *
 * Every inquiry starts as `new` — nobody has replied to it yet. A caller that wants
 * to start further along (the admin form can open at `qualifying`) calls
 * `transition()` afterwards, so that step leaves its own `status.changed` row instead
 * of being invented at insert time.
 */

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { createServiceClient } from '@/lib/supabase/server'
import { emitEvent, type EventActor } from '@/lib/events/emit'
import type { UtmParams } from '@/lib/utm'

/**
 * Maps FA destination country names to ISO 3166-1 alpha-2 codes.
 * Used as a fallback when `anglerPhoneCountry` is not provided on the form.
 */
const TRIP_COUNTRY_ISO: Record<string, string> = {
  'Iceland':          'IS',
  'New Zealand':      'NZ',
  'Norway':           'NO',
  'Sweden':           'SE',
  'Finland':          'FI',
  'Denmark':          'DK',
  'Faroe Islands':    'FO',
  'UK':               'GB',
  'United Kingdom':   'GB',
  'Poland':           'PL',
  'United States':    'US',
  'Canada':           'CA',
  'Australia':        'AU',
  'Ireland':          'IE',
  'Netherlands':      'NL',
  'Germany':          'DE',
  'France':           'FR',
}

/**
 * Normalise a raw phone string to E.164 using libphonenumber-js.
 *
 * Rule 1: starts with '+' → strip formatting then validate/normalise.
 * Rule 2: starts with '00' → replace prefix with '+' then validate/normalise.
 * Rule 3: defaultCountry provided → try country-aware parse.
 * Rule 4: everything else → return original unchanged (do not guess the country).
 *
 * `defaultCountry` should be an ISO 3166-1 alpha-2 code (e.g. 'PL', 'US').
 * Returns null for empty/null input.
 */
export function normalisePhoneForStorage(
  raw: string | null | undefined,
  defaultCountry?: string,
): string | null {
  if (!raw?.trim()) return null
  const s = raw.trim()

  if (s.startsWith('+')) {
    const stripped = s.replace(/[^\d+]/g, '')
    const parsed = parsePhoneNumberFromString(stripped)
    return parsed?.isValid() ? parsed.number : stripped
  }

  if (s.startsWith('00')) {
    const withPlus = '+' + s.slice(2).replace(/[^\d]/g, '')
    const parsed = parsePhoneNumberFromString(withPlus)
    return parsed?.isValid() ? parsed.number : raw
  }

  if (defaultCountry) {
    const parsed = parsePhoneNumberFromString(s, defaultCountry as CountryCode)
    if (parsed?.isValid()) return parsed.number
  }

  return s
}

export type InquirySource = 'web_form' | 'manual' | 'email' | 'whatsapp'

export interface CreateInquiryParams {
  tripId?:              string | null
  experiencePageId?:    string | null
  guideId?:             string | null
  /** Destination country, taken from `experience_pages.country` — never from the request body. */
  tripCountry?:         string | null
  anglerName:           string
  anglerEmail:          string
  anglerPhone?:         string | null
  /** ISO 3166-1 alpha-2 code for the angler's phone country (e.g. 'US', 'PL'). Sent by the form picker. */
  anglerPhoneCountry?:  string | null
  requestedDates?:    string[]
  partySize:          number
  message?:           string | null
  selectedOption?:    string | null
  tripLength?:        string | null
  source:             InquirySource
  /** Who created it: `system` for the public widget, `admin` for the manual form. */
  actor:              EventActor
  gclid?:             string | null
  utm?:               UtmParams | null
  internalNotes?:     string | null
}

export interface CreateInquiryResult {
  id:     string
  status: string
}

export async function createInquiry(params: CreateInquiryParams): Promise<CreateInquiryResult> {
  const svc = createServiceClient()

  const { data, error } = await svc
    .from('inquiries')
    .insert({
      trip_id:            params.tripId ?? null,
      experience_page_id: params.experiencePageId ?? null,
      guide_id:            params.guideId ?? null,
      trip_country:        params.tripCountry ?? null,
      angler_name:         params.anglerName,
      angler_email:        params.anglerEmail,
      angler_phone:        normalisePhoneForStorage(
                             params.anglerPhone ?? null,
                             params.anglerPhoneCountry
                               ?? (params.tripCountry ? TRIP_COUNTRY_ISO[params.tripCountry] : undefined)
                               ?? undefined,
                           ),
      requested_dates:     params.requestedDates ?? [],
      party_size:          params.partySize,
      message:             params.message ?? null,
      selected_option:     params.selectedOption ?? null,
      trip_length:         params.tripLength ?? null,
      status:              'new',
      source:              params.source,
      gclid:               params.gclid ?? null,
      utm:                 params.utm ?? null,
      internal_notes:      params.internalNotes ?? null,
    })
    .select('id, status')
    .single()

  if (error != null || data == null) {
    throw new Error(error?.message ?? 'Failed to create inquiry')
  }

  await emitEvent(svc, {
    inquiryId: data.id,
    type:      'inquiry.created',
    actor:     params.actor,
    source:    'app',
    channel:   'app',
    payload:   {
      inquiry_source:     params.source,
      experience_page_id: params.experiencePageId ?? null,
      guide_id:           params.guideId ?? null,
      trip_country:       params.tripCountry ?? null,
    },
  })

  return { id: data.id, status: data.status }
}
