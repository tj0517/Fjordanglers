'use server'

/**
 * Booking Server Actions.
 *
 * Supports the Icelandic inquiry flow (createIcelandicInquiry, confirmBooking,
 * acceptOffer, declineOffer, declineBooking) and booking chat.
 *
 * Classic / direct booking flow has been replaced by the FA Inquiry Flow
 * (see src/actions/inquiries.ts and src/app/api/inquiries/route.ts).
 */

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendBookingConfirmedEmail, sendBookingDeclinedEmail, sendInquiryRequestEmails, sendOfferSentEmail, sendOfferAcceptedEmail, sendOfferDeclinedEmail } from '@/lib/email'
import { env } from '@/lib/env'
import { getAppUrl } from '@/lib/app-url'

// ─── Guide booking list type ───────────────────────────────────────────────────

export type GuideBookingListItem = {
  id: string
  status: string
  source: string
  booking_date: string
  date_to: string | null
  requested_dates: string[] | null
  guests: number
  total_eur: number
  guide_payout_eur: number
  offer_price_eur: number | null
  duration_option: string | null
  angler_full_name: string | null
  angler_email: string | null
  special_requests: string | null
  created_at: string
  experience_title: string | null
  experience_id: string | null
}

// ─── Angler booking list type ──────────────────────────────────────────────────

export type AnglerBookingListItem = {
  id: string
  status: string
  source: string
  booking_date: string
  date_to: string | null
  requested_dates: string[] | null
  confirmed_days: string[] | null
  guests: number
  total_eur: number
  guide_payout_eur: number
  platform_fee_eur: number
  service_fee_eur: number
  offer_price_eur: number | null
  duration_option: string | null
  created_at: string
  confirmed_at: string | null
  balance_paid_at: string | null
  experience_title: string | null
  experience_id: string | null
  guide_name: string | null
  guide_avatar: string | null
  guide_id: string | null
}

// ─── Guide booking detail type ─────────────────────────────────────────────────

export type GuideBookingDetail = {
  id: string
  status: string
  source: string
  booking_date: string
  date_to: string | null
  requested_dates: string[] | null
  guests: number
  total_eur: number
  platform_fee_eur: number
  service_fee_eur: number
  guide_payout_eur: number
  commission_rate: number
  duration_option: string | null
  angler_full_name: string | null
  angler_email: string | null
  special_requests: string | null
  declined_reason: string | null
  offer_details: string | null
  offer_price_eur: number | null
  offer_days: string[] | null
  offer_date_from: string | null
  offer_date_to: string | null
  offer_meeting_lat: number | null
  offer_meeting_lng: number | null
  preferences: IcelandicPreferences | null
  confirmed_at: string | null
  declined_at: string | null
  created_at: string
  experience_title: string | null
  experience_id: string | null
}

// ─── Angler booking detail type ────────────────────────────────────────────────

export type AnglerBookingDetail = {
  id: string
  status: string
  source: string
  booking_date: string
  date_to: string | null
  requested_dates: string[] | null
  guests: number
  total_eur: number
  platform_fee_eur: number
  service_fee_eur: number
  guide_payout_eur: number
  duration_option: string | null
  special_requests: string | null
  declined_reason: string | null
  offer_details: string | null
  offer_price_eur: number | null
  offer_days: string[] | null
  offer_date_from: string | null
  offer_date_to: string | null
  offer_meeting_lat: number | null
  offer_meeting_lng: number | null
  confirmed_days: string[] | null
  accepted_at: string | null
  confirmed_at: string | null
  declined_at: string | null
  created_at: string
  experience_title: string | null
  experience_id: string | null
  experience_images: string[] | null
  experience_fish_types: string[] | null
  experience_location_city: string | null
  experience_location_country: string | null
  experience_difficulty: string | null
  guide_name: string | null
  guide_avatar: string | null
  guide_id: string | null
  guide_stripe_enabled: boolean
  balance_paid_at: string | null
  stripe_checkout_id: string | null
}

// ─── createIcelandicInquiry ────────────────────────────────────────────────────

/**
 * Icelandic Flow — angler sends an availability enquiry (not a direct booking).
 *
 * Stores in bookings table with source='inquiry', status='pending', total_eur=0.
 * Custom field answers + period structure stored in preferences JSON.
 * Emails both guide and angler on success.
 */

export type IcelandicInquiryInput = {
  experienceId: string
  periods: Array<{ from: string; to: string }>   // YYYY-MM-DD ranges
  individualDates: string[]                        // extra individual dates
  guests: number
  /** { fieldId → answer } map from the guide's inquiry_form_config */
  customAnswers: Record<string, string>
  /** { fieldId → label } map — needed to produce readable email */
  fieldLabels: Record<string, string>
  notes: string | null
  /** Angler's preferred trip duration ("Half day", "1 day", "2 days", etc.) */
  durationPreference: string | null
}

export type IcelandicInquiryResult =
  | { success: true;  inquiryId: string }
  | { success: false; error: string }

/** Structured preferences stored in bookings.preferences JSON for icelandic inquiries. */
export type IcelandicPreferences = {
  periods?:           Array<{ from: string; to: string }>
  individualDates?:   string[]
  customAnswers?:     Record<string, string>
  durationPreference?: string | null
}

export async function createIcelandicInquiry(
  input: IcelandicInquiryInput,
): Promise<IcelandicInquiryResult> {
  try {
    const supabase = await createClient()

    // 1. Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (user == null) {
      return { success: false, error: 'Please sign in to send an enquiry.' }
    }

    // 2. Validate availability
    if (input.periods.length === 0 && input.individualDates.length === 0) {
      return { success: false, error: 'Please select at least one availability period or date.' }
    }

    // 3. Fetch experience (must be icelandic + published)
    const { data: experience } = await supabase
      .from('experiences')
      .select('id, title, guide_id, booking_type, max_guests, published')
      .eq('id', input.experienceId)
      .eq('published', true)
      .single()

    if (experience == null) {
      return { success: false, error: 'Experience not found or no longer available.' }
    }
    if (experience.booking_type !== 'icelandic') {
      return { success: false, error: 'This experience does not accept enquiries via this form.' }
    }

    // 4. Fetch guide
    const { data: guide } = await supabase
      .from('guides')
      .select('id, full_name, commission_rate, user_id')
      .eq('id', experience.guide_id)
      .single()

    if (guide == null) {
      return { success: false, error: 'Guide not found.' }
    }

    // 5. Fetch angler profile
    const { data: anglerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const anglerName = anglerProfile?.full_name ?? ''
    const guests = Math.max(1, Math.min(input.guests, experience.max_guests ?? 99))

    // 6. Derive booking_date + date_to from periods + individualDates
    const allFromDates = [
      ...input.periods.map(p => p.from),
      ...input.individualDates,
    ].sort()
    const allToDates = [
      ...input.periods.map(p => p.to),
      ...input.individualDates,
    ].sort()

    const bookingDate = allFromDates[0] ?? new Date().toISOString().slice(0, 10)
    const dateTo      = allToDates[allToDates.length - 1] ?? null

    // requested_dates = all individual dates within each period + individual dates
    function expandPeriod(from: string, to: string): string[] {
      const dates: string[] = []
      const end = new Date(to   + 'T12:00:00')
      let   cur = new Date(from + 'T12:00:00')
      let   safety = 0
      while (cur <= end && safety < 366) {
        dates.push(
          `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
        )
        cur.setDate(cur.getDate() + 1)
        safety++
      }
      return dates
    }

    const requestedDates = [
      ...input.periods.flatMap(p => expandPeriod(p.from, p.to)),
      ...input.individualDates,
    ]
      .filter((d, i, arr) => arr.indexOf(d) === i)
      .sort()

    // 7. Insert booking
    const { data: inquiry, error: insertError } = await createServiceClient()
      .from('bookings')
      .insert({
        source:           'inquiry',
        status:           'pending',
        experience_id:    experience.id,
        guide_id:         guide.id,
        angler_id:        user.id,
        angler_email:     user.email ?? null,
        angler_full_name: anglerName || null,
        booking_date:     bookingDate,
        date_to:          dateTo,
        requested_dates:  requestedDates,
        guests,
        total_eur:        0,
        guide_payout_eur: 0,
        platform_fee_eur: 0,
        service_fee_eur:  0,
        commission_rate:  guide.commission_rate ?? 0.10,
        special_requests: input.notes ?? null,
        preferences: {
          periods:            input.periods,
          individualDates:    input.individualDates,
          customAnswers:      input.customAnswers,
          durationPreference: input.durationPreference,
        },
      })
      .select('id')
      .single()

    if (insertError != null || inquiry == null) {
      console.error('[bookings/createIcelandicInquiry] Insert error:', insertError)
      return { success: false, error: 'Failed to send enquiry. Please try again.' }
    }

    // 8. Build labeled answers for email
    const labeledAnswers = Object.entries(input.customAnswers)
      .filter(([, answer]) => answer.trim() !== '')
      .map(([fieldId, answer]) => ({
        label:  input.fieldLabels[fieldId] ?? fieldId,
        answer,
      }))

    // 9. Send emails (fire-and-forget)
    if (guide.user_id != null) {
      const serviceClient = createServiceClient()
      serviceClient.auth.admin
        .getUserById(guide.user_id)
        .then(({ data }) => {
          const guideEmail = data.user?.email ?? null
          if (guideEmail == null) return

          sendInquiryRequestEmails({
            guideEmail,
            anglerEmail:        user.email ?? '',
            anglerName:         anglerName || 'Angler',
            guideName:          guide.full_name ?? 'Your guide',
            experienceTitle:    experience.title,
            inquiryId:          inquiry.id,
            periods:            input.periods,
            individualDates:    input.individualDates,
            guests,
            labeledAnswers,
            notes:              input.notes,
            durationPreference: input.durationPreference,
          }).catch(err => console.error('[bookings/createIcelandicInquiry] Email error:', err))
        })
        .catch(err => console.error('[bookings/createIcelandicInquiry] Guide email lookup error:', err))
    }

    return { success: true, inquiryId: inquiry.id }

  } catch (err) {
    console.error('[bookings/createIcelandicInquiry] Unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}

// ─── getGuideBookings ──────────────────────────────────────────────────────────

export type GetGuideBookingsResult =
  | { success: true;  bookings: GuideBookingListItem[] }
  | { success: false; error: string }

export async function getGuideBookings(): Promise<GetGuideBookingsResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user == null) return { success: false, error: 'Unauthorized' }

    const { data: guide } = await supabase
      .from('guides')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (guide == null) return { success: false, error: 'Guide not found' }

    const { data: rows, error } = await supabase
      .from('bookings')
      .select(`
        id, status, source, booking_date, date_to, requested_dates,
        guests, total_eur, guide_payout_eur, offer_price_eur, duration_option,
        angler_full_name, angler_email, special_requests, created_at,
        experience_id,
        experiences ( title )
      `)
      .eq('guide_id', guide.id)
      .order('created_at', { ascending: false })

    if (error != null) {
      console.error('[bookings/getGuideBookings] Query error:', error)
      return { success: false, error: 'Failed to fetch bookings.' }
    }

    const bookings: GuideBookingListItem[] = (rows ?? []).map(r => {
      const exp = r.experiences as { title: string } | null
      return {
        id:               r.id,
        status:           r.status,
        source:           r.source ?? 'direct',
        booking_date:     r.booking_date,
        date_to:          r.date_to,
        requested_dates:  r.requested_dates,
        guests:           r.guests,
        total_eur:        r.total_eur,
        guide_payout_eur: r.guide_payout_eur,
        offer_price_eur:  r.offer_price_eur,
        duration_option:  r.duration_option,
        angler_full_name: r.angler_full_name,
        angler_email:     r.angler_email,
        special_requests: r.special_requests,
        created_at:       r.created_at,
        experience_title: exp?.title ?? null,
        experience_id:    r.experience_id,
      }
    })

    return { success: true, bookings }

  } catch (err) {
    console.error('[bookings/getGuideBookings] Unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── getAnglerBookings ─────────────────────────────────────────────────────────

export type GetAnglerBookingsResult =
  | { success: true;  bookings: AnglerBookingListItem[] }
  | { success: false; error: string }

export async function getAnglerBookings(): Promise<GetAnglerBookingsResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user == null) return { success: false, error: 'Unauthorized' }

    const { data: rows, error } = await supabase
      .from('bookings')
      .select(`
        id, status, source, booking_date, date_to, requested_dates,
        confirmed_days, guests, total_eur, guide_payout_eur,
        platform_fee_eur, service_fee_eur,
        offer_price_eur, duration_option, created_at, confirmed_at,
        balance_paid_at,
        experience_id, guide_id,
        experiences ( title ),
        guides ( full_name, avatar_url )
      `)
      .eq('angler_id', user.id)
      .order('created_at', { ascending: false })

    if (error != null) {
      console.error('[bookings/getAnglerBookings] Query error:', error)
      return { success: false, error: 'Failed to fetch bookings.' }
    }

    const bookings: AnglerBookingListItem[] = (rows ?? []).map(r => {
      const exp   = r.experiences as { title: string } | null
      const guide = r.guides as { full_name: string; avatar_url: string | null } | null
      return {
        id:               r.id,
        status:           r.status,
        source:           r.source ?? 'direct',
        booking_date:     r.booking_date,
        date_to:          r.date_to,
        requested_dates:  r.requested_dates,
        confirmed_days:   r.confirmed_days,
        guests:           r.guests,
        total_eur:        r.total_eur,
        guide_payout_eur: r.guide_payout_eur ?? 0,
        platform_fee_eur: r.platform_fee_eur ?? 0,
        service_fee_eur:  r.service_fee_eur ?? 0,
        offer_price_eur:  r.offer_price_eur,
        duration_option:  r.duration_option,
        created_at:       r.created_at,
        confirmed_at:     r.confirmed_at,
        balance_paid_at:  r.balance_paid_at,
        experience_title: exp?.title ?? null,
        experience_id:    r.experience_id,
        guide_name:       guide?.full_name ?? null,
        guide_avatar:     guide?.avatar_url ?? null,
        guide_id:         r.guide_id,
      }
    })

    return { success: true, bookings }

  } catch (err) {
    console.error('[bookings/getAnglerBookings] Unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── getGuideBookingDetail ─────────────────────────────────────────────────────

export type GetGuideBookingDetailResult =
  | { success: true;  booking: GuideBookingDetail }
  | { success: false; error: string }

export async function getGuideBookingDetail(
  bookingId: string,
): Promise<GetGuideBookingDetailResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user == null) return { success: false, error: 'Unauthorized' }

    const { data: guide } = await supabase
      .from('guides')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (guide == null) return { success: false, error: 'Guide not found' }

    const { data: row, error } = await supabase
      .from('bookings')
      .select(`
        id, status, source, booking_date, date_to, requested_dates,
        guests, total_eur, platform_fee_eur, service_fee_eur, guide_payout_eur,
        commission_rate, duration_option, angler_full_name, angler_email,
        special_requests, declined_reason, offer_details,
        offer_price_eur, offer_days, offer_date_from, offer_date_to,
        offer_meeting_lat, offer_meeting_lng, preferences,
        confirmed_at, declined_at, created_at,
        experience_id,
        experiences ( title )
      `)
      .eq('id', bookingId)
      .eq('guide_id', guide.id)
      .single()

    if (error != null || row == null) {
      return { success: false, error: 'Booking not found.' }
    }

    const exp = row.experiences as { title: string } | null

    const booking: GuideBookingDetail = {
      id:               row.id,
      status:           row.status,
      source:           row.source,
      booking_date:     row.booking_date,
      date_to:          row.date_to,
      requested_dates:  row.requested_dates,
      guests:           row.guests,
      total_eur:        row.total_eur,
      platform_fee_eur: row.platform_fee_eur,
      service_fee_eur:  row.service_fee_eur,
      guide_payout_eur: row.guide_payout_eur,
      commission_rate:  row.commission_rate,
      duration_option:  row.duration_option,
      angler_full_name: row.angler_full_name,
      angler_email:     row.angler_email,
      special_requests: row.special_requests,
      declined_reason:  row.declined_reason,
      offer_details:    row.offer_details,
      offer_price_eur:  row.offer_price_eur,
      offer_days:       row.offer_days,
      offer_date_from:  row.offer_date_from,
      offer_date_to:    row.offer_date_to,
      offer_meeting_lat: row.offer_meeting_lat,
      offer_meeting_lng: row.offer_meeting_lng,
      preferences:      (row.preferences as IcelandicPreferences | null) ?? null,
      confirmed_at:     row.confirmed_at,
      declined_at:      row.declined_at,
      created_at:       row.created_at,
      experience_title: exp?.title ?? null,
      experience_id:    row.experience_id,
    }

    return { success: true, booking }

  } catch (err) {
    console.error('[bookings/getGuideBookingDetail] Unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── getAnglerBookingDetail ────────────────────────────────────────────────────

export type GetAnglerBookingDetailResult =
  | { success: true;  booking: AnglerBookingDetail }
  | { success: false; error: string }

export async function getAnglerBookingDetail(
  bookingId: string,
): Promise<GetAnglerBookingDetailResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user == null) return { success: false, error: 'Unauthorized' }

    const { data: row, error } = await supabase
      .from('bookings')
      .select(`
        id, status, source, booking_date, date_to, requested_dates,
        guests, total_eur, platform_fee_eur, service_fee_eur, guide_payout_eur,
        duration_option, special_requests, declined_reason, offer_details,
        offer_price_eur, offer_days, offer_date_from, offer_date_to,
        offer_meeting_lat, offer_meeting_lng,
        confirmed_days,
        accepted_at, confirmed_at, declined_at, created_at,
        balance_paid_at, stripe_checkout_id,
        experience_id, guide_id,
        experiences ( title, images, fish_types, location_city, location_country, difficulty ),
        guides ( full_name, avatar_url, stripe_charges_enabled )
      `)
      .eq('id', bookingId)
      .eq('angler_id', user.id)
      .single()

    if (error != null || row == null) {
      return { success: false, error: 'Booking not found.' }
    }

    const exp   = row.experiences as { title: string; images: string[] | null; fish_types: string[]; location_city: string | null; location_country: string | null; difficulty: string | null } | null
    const guide = row.guides as { full_name: string; avatar_url: string | null; stripe_charges_enabled: boolean | null } | null

    const booking: AnglerBookingDetail = {
      id:               row.id,
      status:           row.status,
      source:           row.source,
      booking_date:     row.booking_date,
      date_to:          row.date_to,
      requested_dates:  row.requested_dates,
      guests:           row.guests,
      total_eur:        row.total_eur,
      platform_fee_eur: row.platform_fee_eur,
      service_fee_eur:  row.service_fee_eur,
      guide_payout_eur: row.guide_payout_eur,
      duration_option:  row.duration_option,
      special_requests: row.special_requests,
      declined_reason:  row.declined_reason,
      offer_details:    row.offer_details,
      offer_price_eur:  row.offer_price_eur,
      offer_days:       row.offer_days,
      offer_date_from:  row.offer_date_from,
      offer_date_to:    row.offer_date_to,
      offer_meeting_lat: row.offer_meeting_lat,
      offer_meeting_lng: row.offer_meeting_lng,
      confirmed_days:   row.confirmed_days,
      accepted_at:      row.accepted_at,
      confirmed_at:     row.confirmed_at,
      declined_at:      row.declined_at,
      created_at:       row.created_at,
      experience_title:            exp?.title ?? null,
      experience_id:               row.experience_id,
      experience_images:           exp?.images ?? null,
      experience_fish_types:       exp?.fish_types ?? null,
      experience_location_city:    exp?.location_city ?? null,
      experience_location_country: exp?.location_country ?? null,
      experience_difficulty:       exp?.difficulty ?? null,
      guide_name:           guide?.full_name ?? null,
      guide_avatar:         guide?.avatar_url ?? null,
      guide_id:             row.guide_id,
      guide_stripe_enabled: guide?.stripe_charges_enabled === true,
      balance_paid_at:      row.balance_paid_at,
      stripe_checkout_id:   row.stripe_checkout_id,
    }

    return { success: true, booking }

  } catch (err) {
    console.error('[bookings/getAnglerBookingDetail] Unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── confirmBooking ────────────────────────────────────────────────────────────

export type ConfirmBookingResult =
  | { success: true }
  | { success: false; error: string }

export async function confirmBooking(
  bookingId: string,
  data: {
    message:         string
    meetingLocation: string
    meetingLat?:     number
    meetingLng?:     number
    /** Guide's confirmed/offered days (ISO strings). For direct bookings = angler's requested dates ± guide edits. */
    selectedDates:   string[]
    /** Guide-offered price (EUR). For icelandic inquiries. Pass 0 to keep existing total_eur. */
    offeredPriceEur: number
    /** River / beat section (optional, Icelandic flow) */
    riverSection?:   string
    /** What's included in the trip (optional array of labels) */
    included?:       string[]
  },
): Promise<ConfirmBookingResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user == null) return { success: false, error: 'Unauthorized' }

    // Verify guide ownership
    const { data: guide } = await supabase
      .from('guides')
      .select('id, full_name, user_id')
      .eq('user_id', user.id)
      .single()

    if (guide == null) return { success: false, error: 'Guide not found' }

    // Fetch the booking (must be pending + owned by this guide)
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, source, angler_email, angler_full_name, experience_id, booking_date, date_to, requested_dates, guests, duration_option, total_eur, commission_rate')
      .eq('id', bookingId)
      .eq('guide_id', guide.id)
      .single()

    if (booking == null) return { success: false, error: 'Booking not found.' }
    if (booking.status !== 'pending') return { success: false, error: 'Booking is not in pending status.' }

    // Fetch experience title
    const { data: experience } = await supabase
      .from('experiences')
      .select('title')
      .eq('id', booking.experience_id ?? '')
      .single()

    const isInquiry     = booking.source === 'inquiry'
    const offeredDays   = [...data.selectedDates].sort()
    const offerDateFrom = offeredDays[0] ?? null
    const offerDateTo   = offeredDays[offeredDays.length - 1] ?? null
    const now           = new Date().toISOString()

    // For direct bookings: detect if guide changed the requested dates
    const originalDates  = [...(booking.requested_dates ?? [booking.booking_date])].sort()
    const datesChanged   = isInquiry ? false
      : JSON.stringify(offeredDays) !== JSON.stringify(originalDates)

    let updateError: { message?: string } | null = null
    let isDirectConfirm = false  // true when booking is immediately confirmed

    if (isInquiry || datesChanged) {
      // ── Offer flow: angler must still approve (inquiry OR direct with changed dates) ──
      const originalDays      = originalDates.length || 1
      const newDays           = offeredDays.length || 1
      const dailyRate         = booking.total_eur / originalDays
      const computedOffer     = data.offeredPriceEur > 0
        ? data.offeredPriceEur
        : Math.round(dailyRate * newDays * 100) / 100

      const { error } = await supabase
        .from('bookings')
        .update({
          status:            'offer_sent',
          offer_days:        offeredDays,
          offer_date_from:   offerDateFrom,
          offer_date_to:     offerDateTo,
          offer_price_eur:   computedOffer,
          offer_meeting_lat: data.meetingLat ?? null,
          offer_meeting_lng: data.meetingLng ?? null,
          offer_details: JSON.stringify({
            message:         data.message.trim() || null,
            meetingLocation: data.meetingLocation.trim() || null,
            riverSection:    data.riverSection?.trim() || null,
            included:        data.included ?? [],
          }),
        })
        .eq('id', bookingId)
      updateError = error

      // Email angler about the new offer
      if (error == null && booking.angler_email != null) {
        const baseUrl = await getAppUrl()
        sendOfferSentEmail({
          to:              booking.angler_email,
          anglerName:      booking.angler_full_name ?? 'Angler',
          guideName:       guide.full_name,
          experienceTitle: experience?.title ?? 'Your trip',
          bookingId:       booking.id,
          offerDates:      offeredDays,
          offerPriceEur:   computedOffer > 0 ? computedOffer : null,
          bookingUrl:      `${baseUrl}/account/bookings/${booking.id}`,
        }).catch(err => console.error('[bookings/confirmBooking] Offer email error:', err))
      }
    } else {
      // ── Direct booking, same dates → confirm immediately ──
      isDirectConfirm = true
      const { error } = await supabase
        .from('bookings')
        .update({
          status:              'confirmed',
          confirmed_at:        now,
          confirmed_days:      offeredDays,
          confirmed_date_from: offerDateFrom,
          confirmed_date_to:   offerDateTo,
          offer_details: JSON.stringify({
            message:         data.message.trim() || null,
            meetingLocation: data.meetingLocation.trim() || null,
            meetingLat:      data.meetingLat ?? null,
            meetingLng:      data.meetingLng ?? null,
            riverSection:    data.riverSection?.trim() || null,
            included:        data.included ?? [],
          }),
        })
        .eq('id', bookingId)
      updateError = error

      // Block calendar dates (fire-and-forget)
      if (offeredDays.length > 0 && booking.experience_id != null) {
        const svc = createServiceClient()
        ;(async () => {
          const { data: calLink } = await svc
            .from('calendar_experiences')
            .select('calendar_id')
            .eq('experience_id', booking.experience_id!)
            .limit(1)
            .single()

          let calendarId: string | null = calLink?.calendar_id ?? null

          if (calendarId == null) {
            const { data: fallback } = await svc
              .from('guide_calendars')
              .select('id')
              .eq('guide_id', guide.id)
              .limit(1)
              .single()
            calendarId = fallback?.id ?? null
          }

          if (calendarId == null) return

          await svc.from('calendar_blocked_dates').insert(
            offeredDays.map((d: string) => ({
              calendar_id: calendarId!,
              date_start:  d,
              date_end:    d,
              reason:      `Booking — ${bookingId.slice(0, 8).toUpperCase()}`,
            }))
          )
        })().catch(err => console.error('[bookings/confirmBooking] Calendar block error:', err))
      }
    }

    if (updateError != null) {
      console.error('[bookings/confirmBooking] Update error:', updateError)
      return { success: false, error: 'Failed to confirm booking. Please try again.' }
    }

    // Email angler on immediate direct confirm
    if (isDirectConfirm && booking.angler_email != null) {
      const baseUrl = env.NEXT_PUBLIC_APP_URL
      sendBookingConfirmedEmail({
        to:              booking.angler_email,
        anglerName:      booking.angler_full_name ?? 'Angler',
        guideName:       guide.full_name,
        experienceTitle: experience?.title ?? 'Your trip',
        bookingId:       booking.id,
        bookingDate:     booking.booking_date,
        dateTo:          booking.date_to,
        requestedDates:  offeredDays,
        guests:          booking.guests,
        packageLabel:    booking.duration_option,
        totalEur:        booking.total_eur,
        guideMessage:    data.message.trim() || null,
        meetingLocation: data.meetingLocation.trim() || null,
        bookingUrl:      `${baseUrl}/account/bookings/${booking.id}`,
      }).catch(err => console.error('[bookings/confirmBooking] Email error:', err))
    }

    return { success: true }

  } catch (err) {
    console.error('[bookings/confirmBooking] Unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── declineBooking ────────────────────────────────────────────────────────────

export type DeclineBookingResult =
  | { success: true }
  | { success: false; error: string }

export async function declineBooking(
  bookingId: string,
  data: { reason: string },
): Promise<DeclineBookingResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user == null) return { success: false, error: 'Unauthorized' }

    const { data: guide } = await supabase
      .from('guides')
      .select('id, full_name')
      .eq('user_id', user.id)
      .single()

    if (guide == null) return { success: false, error: 'Guide not found' }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, angler_email, angler_full_name, experience_id, booking_date')
      .eq('id', bookingId)
      .eq('guide_id', guide.id)
      .single()

    if (booking == null) return { success: false, error: 'Booking not found.' }
    if (booking.status !== 'pending') return { success: false, error: 'Booking is not in pending status.' }

    const { data: experience } = await supabase
      .from('experiences')
      .select('title')
      .eq('id', booking.experience_id ?? '')
      .single()

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status:          'declined',
        declined_at:     new Date().toISOString(),
        declined_reason: data.reason.trim() || null,
      })
      .eq('id', bookingId)

    if (updateError != null) {
      console.error('[bookings/declineBooking] Update error:', updateError)
      return { success: false, error: 'Failed to decline booking. Please try again.' }
    }

    if (booking.angler_email != null) {
      const baseUrl = env.NEXT_PUBLIC_APP_URL
      sendBookingDeclinedEmail({
        to:              booking.angler_email,
        anglerName:      booking.angler_full_name ?? 'Angler',
        guideName:       guide.full_name,
        experienceTitle: experience?.title ?? 'Your trip',
        bookingId:       booking.id,
        declineReason:   data.reason.trim() || null,
        bookingUrl:      `${baseUrl}/account/bookings/${booking.id}`,
      }).catch(err => console.error('[bookings/declineBooking] Email error:', err))
    }

    return { success: true }

  } catch (err) {
    console.error('[bookings/declineBooking] Unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── acceptOffer ──────────────────────────────────────────────────────────────

export type AcceptOfferResult =
  | { success: true; checkoutUrl: string | null }
  | { success: false; error: string }

/**
 * Angler accepts the guide's offer (icelandic flow).
 * Status: offer_sent → confirmed.
 * Copies offer_days → confirmed_days and updates total_eur + payout.
 * Blocks guide's confirmed dates in their calendar (fire-and-forget).
 */
export async function acceptOffer(bookingId: string): Promise<AcceptOfferResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user == null) return { success: false, error: 'Unauthorized' }

    // Fetch booking — must be offer_sent + owned by this angler
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, guide_id, experience_id, offer_price_eur, offer_days, commission_rate, angler_full_name, angler_email')
      .eq('id', bookingId)
      .eq('angler_id', user.id)
      .single()

    if (booking == null) return { success: false, error: 'Booking not found.' }
    if (booking.status !== 'offer_sent') return { success: false, error: 'No offer to accept.' }

    const offeredDays    = (booking.offer_days ?? []).sort()
    const offerPriceEur  = booking.offer_price_eur ?? 0
    const commissionRate = booking.commission_rate ?? 0.10

    const serviceFeeEur = offerPriceEur > 0
      ? Math.min(Math.round(offerPriceEur * 0.05 * 100) / 100, 50)
      : 0

    const priceUpdate = offerPriceEur > 0
      ? {
          total_eur:        offerPriceEur,
          guide_payout_eur: Math.round(offerPriceEur * (1 - commissionRate) * 100) / 100,
          platform_fee_eur: Math.round(offerPriceEur * commissionRate * 100) / 100,
          service_fee_eur:  serviceFeeEur,
        }
      : {}

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status:              'confirmed',
        accepted_at:         new Date().toISOString(),
        confirmed_at:        new Date().toISOString(),
        confirmed_days:      offeredDays,
        confirmed_date_from: offeredDays[0] ?? null,
        confirmed_date_to:   offeredDays[offeredDays.length - 1] ?? null,
        ...priceUpdate,
      })
      .eq('id', bookingId)

    if (updateError != null) {
      console.error('[bookings/acceptOffer] Update error:', updateError)
      return { success: false, error: 'Failed to accept offer. Please try again.' }
    }

    // Block calendar dates (fire-and-forget)
    if (offeredDays.length > 0 && booking.experience_id != null && booking.guide_id != null) {
      const svc = createServiceClient()
      ;(async () => {
        const { data: calLink } = await svc
          .from('calendar_experiences')
          .select('calendar_id')
          .eq('experience_id', booking.experience_id!)
          .limit(1)
          .single()

        let calendarId: string | null = calLink?.calendar_id ?? null

        if (calendarId == null) {
          const { data: fallback } = await svc
            .from('guide_calendars')
            .select('id')
            .eq('guide_id', booking.guide_id!)
            .limit(1)
            .single()
          calendarId = fallback?.id ?? null
        }

        if (calendarId == null) return

        await svc.from('calendar_blocked_dates').insert(
          offeredDays.map((d: string) => ({
            calendar_id: calendarId!,
            date_start:  d,
            date_end:    d,
            reason:      `Trip confirmed — ${bookingId.slice(0, 8).toUpperCase()}`,
          }))
        )
      })().catch(err => console.error('[bookings/acceptOffer] Calendar block error:', err))
    }

    // Email guide (fire-and-forget)
    if (booking.guide_id != null) {
      const svc2 = createServiceClient()
      ;(async () => {
        const [{ data: guideRow }, { data: expRow }] = await Promise.all([
          svc2.from('guides').select('full_name, user_id').eq('id', booking.guide_id!).single(),
          booking.experience_id != null
            ? svc2.from('experiences').select('title').eq('id', booking.experience_id).single()
            : Promise.resolve({ data: null }),
        ])
        if (guideRow?.user_id == null) return
        const { data: authUser } = await svc2.auth.admin.getUserById(guideRow.user_id)
        const guideEmail = authUser.user?.email ?? null
        if (guideEmail == null) return
        const baseUrl = await getAppUrl()
        await sendOfferAcceptedEmail({
          to:              guideEmail,
          guideName:       guideRow.full_name ?? 'Guide',
          anglerName:      booking.angler_full_name ?? 'Angler',
          experienceTitle: (expRow as { title: string } | null)?.title ?? 'Your trip',
          bookingId,
          confirmedDates:  offeredDays,
          bookingUrl:      `${baseUrl}/dashboard/bookings/${bookingId}`,
        })
      })().catch(err => console.error('[bookings/acceptOffer] Email error:', err))
    }

    return { success: true, checkoutUrl: null }

  } catch (err) {
    console.error('[bookings/acceptOffer] Unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── declineOffer ─────────────────────────────────────────────────────────────

export type DeclineOfferResult =
  | { success: true }
  | { success: false; error: string }

/**
 * Angler declines the guide's offer (icelandic flow).
 * Status: offer_sent → declined.
 */
export async function declineOffer(
  bookingId: string,
  reason?: string,
): Promise<DeclineOfferResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user == null) return { success: false, error: 'Unauthorized' }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, guide_id, experience_id, angler_full_name')
      .eq('id', bookingId)
      .eq('angler_id', user.id)
      .single()

    if (booking == null) return { success: false, error: 'Booking not found.' }
    if (booking.status !== 'offer_sent') return { success: false, error: 'No offer to decline.' }

    const declineReason = reason?.trim() || null

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status:          'declined',
        declined_at:     new Date().toISOString(),
        declined_reason: declineReason,
      })
      .eq('id', bookingId)

    if (updateError != null) {
      console.error('[bookings/declineOffer] Update error:', updateError)
      return { success: false, error: 'Failed to decline offer. Please try again.' }
    }

    // Email guide (fire-and-forget)
    if (booking.guide_id != null) {
      const svc = createServiceClient()
      ;(async () => {
        const [{ data: guideRow }, { data: expRow }] = await Promise.all([
          svc.from('guides').select('full_name, user_id').eq('id', booking.guide_id!).single(),
          booking.experience_id != null
            ? svc.from('experiences').select('title').eq('id', booking.experience_id).single()
            : Promise.resolve({ data: null }),
        ])
        if (guideRow?.user_id == null) return
        const { data: authUser } = await svc.auth.admin.getUserById(guideRow.user_id)
        const guideEmail = authUser.user?.email ?? null
        if (guideEmail == null) return
        const baseUrl = await getAppUrl()
        await sendOfferDeclinedEmail({
          to:              guideEmail,
          guideName:       guideRow.full_name ?? 'Guide',
          anglerName:      booking.angler_full_name ?? 'Angler',
          experienceTitle: (expRow as { title: string } | null)?.title ?? 'Your trip',
          bookingId,
          declineReason,
          bookingUrl:      `${baseUrl}/dashboard/bookings/${bookingId}`,
        })
      })().catch(err => console.error('[bookings/declineOffer] Email error:', err))
    }

    return { success: true }

  } catch (err) {
    console.error('[bookings/declineOffer] Unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── BookingMessage type ───────────────────────────────────────────────────────

export type BookingMessage = {
  id: string
  booking_id: string
  body: string
  sender_id: string
  sender_role: string | null
  created_at: string
  read_at: string | null
}

// ─── getBookingMessages ────────────────────────────────────────────────────────

export type GetBookingMessagesResult =
  | { success: true;  messages: BookingMessage[] }
  | { success: false; error: string }

export async function getBookingMessages(
  bookingId: string,
): Promise<GetBookingMessagesResult> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user == null) return { success: false, error: 'Unauthorized' }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, guide_id, angler_id')
      .eq('id', bookingId)
      .single()

    if (booking == null) return { success: false, error: 'Booking not found.' }

    let hasAccess = booking.angler_id === user.id
    if (!hasAccess) {
      const { data: guide } = await supabase
        .from('guides')
        .select('id')
        .eq('user_id', user.id)
        .single()
      hasAccess = guide != null && booking.guide_id === guide.id
    }
    if (!hasAccess) return { success: false, error: 'Unauthorized' }

    const { data: rows, error } = await supabase
      .from('booking_messages')
      .select('id, booking_id, body, sender_id, sender_role, created_at, read_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })

    if (error != null) {
      console.error('[bookings/getBookingMessages] Query error:', error)
      return { success: false, error: 'Failed to fetch messages.' }
    }

    return { success: true, messages: rows ?? [] }

  } catch (err) {
    console.error('[bookings/getBookingMessages] Unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── sendBookingMessage ────────────────────────────────────────────────────────

export type SendBookingMessageResult =
  | { success: true;  message: BookingMessage }
  | { success: false; error: string }

export async function sendBookingMessage(
  bookingId: string,
  body: string,
): Promise<SendBookingMessageResult> {
  try {
    const trimmed = body.trim()
    if (trimmed === '') return { success: false, error: 'Message cannot be empty.' }

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user == null) return { success: false, error: 'Unauthorized' }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, guide_id, angler_id')
      .eq('id', bookingId)
      .single()

    if (booking == null) return { success: false, error: 'Booking not found.' }

    let senderRole: 'guide' | 'angler'

    if (booking.angler_id === user.id) {
      senderRole = 'angler'
    } else {
      const { data: guide } = await supabase
        .from('guides')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (guide != null && booking.guide_id === guide.id) {
        senderRole = 'guide'
      } else {
        return { success: false, error: 'Unauthorized' }
      }
    }

    const { data: message, error: insertError } = await createServiceClient()
      .from('booking_messages')
      .insert({
        booking_id:  bookingId,
        body:        trimmed,
        sender_id:   user.id,
        sender_role: senderRole,
      })
      .select('id, booking_id, body, sender_id, sender_role, created_at, read_at')
      .single()

    if (insertError != null || message == null) {
      console.error('[bookings/sendBookingMessage] Insert error:', insertError)
      return { success: false, error: 'Failed to send message. Please try again.' }
    }

    return { success: true, message }

  } catch (err) {
    console.error('[bookings/sendBookingMessage] Unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
