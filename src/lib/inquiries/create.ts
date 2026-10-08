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
import { assertNotFutureDate, instantOf, warsawToday } from '@/lib/inquiries/history'
import type { Brief } from '@/lib/inquiries/brief'
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

type InquirySource = 'web_form' | 'manual' | 'email' | 'whatsapp'

export interface CreateInquiryParams {
  tripId?:              string | null
  experiencePageId?:    string | null
  guideId?:             string | null
  /** Destination country, taken from `experience_pages.country` — never from the request body. */
  tripCountry?:         string | null
  anglerName:           string
  anglerEmail:          string
  /** ISO 3166-1 alpha-2 of where the angler lives — step 3 of the v2 form. */
  anglerCountry?:       string | null
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
  /**
   * FA-1.55: the answers of the v2 three-step form, already validated by `briefSchema`.
   * Stored 1:1. The v1 form does not send one, and an inquiry without a brief is written
   * and announced exactly as it was before this parameter existed.
   */
  brief?:             Brief | null
  /**
   * `experience_pages.page_version` of the page the inquiry came from. Recorded on the
   * `inquiry.created` event — but only together with a brief, so a v1 inquiry's event
   * payload keeps the exact shape it has always had.
   */
  pageVersion?:       number | null
  /** FA-1.38: admin backdates a manually created inquiry to the day it actually arrived
   *  (e.g. an Instagram DM from two months ago). 'YYYY-MM-DD', never in the future.
   *  Sets both `created_at` and the `inquiry.created` event's `occurred_at`. */
  receivedOn?:        string | null
}

export interface CreateInquiryResult {
  id:     string
  status: string
}

export async function createInquiry(params: CreateInquiryParams): Promise<CreateInquiryResult> {
  const svc = createServiceClient()

  const receivedOn = params.receivedOn ?? null
  if (receivedOn != null) {
    assertNotFutureDate(receivedOn, 'Received date')
  }
  // "Today" is not a backdate — it is what `now()` already gives, down to the second.
  // Stamping it to noon UTC would move a lead entered at 10:00 into the future and one
  // entered at 20:00 six hours into the past, corrupting the 48h SLA counter and
  // ordering for every manually created inquiry, not just genuine backfills.
  const isBackdated = receivedOn != null && receivedOn !== warsawToday()
  const receivedAt  = isBackdated ? instantOf(receivedOn) : null

  const { data, error } = await svc
    .from('inquiries')
    .insert({
      ...(receivedAt != null ? { created_at: receivedAt } : {}),
      trip_id:            params.tripId ?? null,
      experience_page_id: params.experiencePageId ?? null,
      guide_id:            params.guideId ?? null,
      trip_country:        params.tripCountry ?? null,
      angler_name:         params.anglerName,
      angler_email:        params.anglerEmail,
      ...(params.anglerCountry != null ? { angler_country: params.anglerCountry } : {}),
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
      ...(params.brief != null ? { brief: params.brief } : {}),
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
      // Only on the v2 path: the metrics of the pilot (FA-1.57) need to tell a v2 inquiry
      // from a v1 one, and a v1 event must stay byte-identical to what it was before.
      ...(params.brief != null
        ? { page_version: params.pageVersion ?? 2, brief_completed: true }
        : {}),
    },
    ...(receivedAt != null ? { occurredAt: receivedAt } : {}),
  })

  return { id: data.id, status: data.status }
}
