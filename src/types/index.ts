/**
 * FjordAnglers — domain types.
 *
 * Thin aliases over the generated DB row types (Tables<>) so the rest of the
 * codebase doesn't import from the verbose database.types.ts directly.
 * Also provides joined/enriched types used in components and Server Actions.
 */

import type { Tables, Enums } from '@/lib/supabase'

// ─── Row aliases ───────────────────────────────────────────────────────────

export type Profile         = Tables<'profiles'>
export type Guide           = Tables<'guides'>
export type Experience      = Tables<'experiences'>
export type ExperienceImage = Tables<'experience_images'>
export type Booking         = Tables<'bookings'>
export type Payment         = Tables<'payments'>
export type Lead            = Tables<'leads'>

// ─── Enum aliases ──────────────────────────────────────────────────────────

export type GuideStatus   = Enums<'guide_status'>
export type PricingModel  = Enums<'pricing_model'>
export type BookingStatus = Enums<'booking_status'>
export type PaymentStatus = Enums<'payment_status'>

export type UserRole      = Profile['role']                  // 'guide' | 'angler' | 'admin'
export type Difficulty    = NonNullable<Experience['difficulty']>
export type LeadStatus    = Lead['status']

// ─── Joined / enriched types ───────────────────────────────────────────────

/** Experience with guide summary + images — listing and detail pages. */
export type ExperienceWithGuide = Experience & {
  guide: Pick<
    Guide,
    'id' | 'full_name' | 'avatar_url' | 'country' | 'city' | 'average_rating'
  >
  images: ExperienceImage[]
}

/** Guide with published experiences — guide profile page. */
export type GuideWithExperiences = Guide & {
  experiences: Experience[]
}

/** Booking with experience + guide snapshot — dashboard. */
export type BookingWithDetails = Booking & {
  experience: Pick<
    Experience,
    'id' | 'title' | 'price_per_person_eur' | 'location_country' | 'location_city'
  >
  guide: Pick<Guide, 'id' | 'full_name' | 'avatar_url'>
}

// ─── Utility ───────────────────────────────────────────────────────────────

/** Typed Server Action response — always return this shape from actions. */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
