/**
 * FjordAnglers — domain types.
 *
 * Thin aliases over the generated DB row types (Tables<>) so the rest of the
 * codebase doesn't import from the verbose database.types.ts directly.
 * Also provides joined/enriched types used in components and Server Actions.
 */

import type { Tables, Enums } from '@/lib/supabase'

// ─── Row aliases ───────────────────────────────────────────────────────────

export type Profile              = Tables<'profiles'>
export type Guide                = Tables<'guides'>
export type Experience           = Tables<'experiences'>
export type ExperienceImage      = Tables<'experience_images'>
export type GuideAccommodation   = Tables<'guide_accommodations'>
export type Booking              = Tables<'bookings'>
export type Payment              = Tables<'payments'>
export type Lead                 = Tables<'leads'>

// ─── Enum aliases ──────────────────────────────────────────────────────────

export type GuideStatus   = Enums<'guide_status'>
export type PricingModel  = Enums<'pricing_model'>
export type BookingStatus = Enums<'booking_status'>
export type PaymentStatus = Enums<'payment_status'>

export type UserRole      = Profile['role']                  // 'guide' | 'angler' | 'admin'
export type LeadStatus    = Lead['status']

// ─── Domain-specific string unions ─────────────────────────────────────────
// These mirror TEXT CHECK constraints in the DB (not PostgreSQL ENUMs, so they
// are NOT in the generated Enums<> helper — defined here as the canonical source).

/** Matches CHECK constraint on guides.cancellation_policy */
export type CancellationPolicy = 'flexible' | 'moderate' | 'strict'

/** Matches CHECK constraint on guides.boat_type */
export type BoatType = 'center_console' | 'cabin' | 'rib' | 'drift_boat' | 'kayak'

/** Difficulty level for an experience */
export type Difficulty = 'beginner' | 'intermediate' | 'expert'

/** Matches CHECK constraint on guides.accepted_payment_methods items */
export type PaymentMethod = 'cash' | 'online'

/** A named fishing spot for multi-spot experiences */
export type LocationSpot = { lat: number; lng: number; name: string }

// ─── Joined / enriched types ───────────────────────────────────────────────

/**
 * Experience with guide summary + images — listing and detail pages.
 *
 * The DB `experiences` table has an `images TEXT[] | null` column (legacy URL
 * array). Queries instead JOIN `experience_images` via FK and alias the result
 * to `images`. We Omit the column-level type and replace it with the richer
 * `ExperienceImage[]` shape returned by those joined queries.
 */
export type ExperienceWithGuide = Omit<Experience, 'images'> & {
  guide: Pick<
    Guide,
    'id' | 'full_name' | 'avatar_url' | 'country' | 'city' | 'average_rating' | 'cancellation_policy' | 'languages' | 'is_hidden'
  > & { calendar_disabled?: boolean | null }
  images: ExperienceImage[]
  /** Linked accommodations — populated when querying via EXP_SELECT. */
  accommodations?: Array<{
    accommodation: Pick<GuideAccommodation, 'id' | 'name' | 'type' | 'description' | 'max_guests' | 'location_note'>
  }>
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
