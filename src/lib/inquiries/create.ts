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

import { createServiceClient } from '@/lib/supabase/server'
import { emitEvent, type EventActor } from '@/lib/events/emit'
import { normalisePhone } from '@/lib/inquiry-matcher'
import type { UtmParams } from '@/lib/utm'

export type InquirySource = 'web_form' | 'manual' | 'email' | 'whatsapp'

export interface CreateInquiryParams {
  tripId?:            string | null
  experiencePageId?:  string | null
  guideId?:           string | null
  /** Destination country, taken from `experience_pages.country` — never from the request body. */
  tripCountry?:       string | null
  anglerName:         string
  anglerEmail:        string
  anglerPhone?:       string | null
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
      angler_phone:        params.anglerPhone?.trim()
                             ? normalisePhone(params.anglerPhone.trim())
                             : null,
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
