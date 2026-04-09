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
export type Lead                 = Tables<'leads'>

// ─── Enum aliases ──────────────────────────────────────────────────────────

export type GuideStatus   = Enums<'guide_status'>
export type PricingModel  = Enums<'pricing_model'>

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

/**
 * Status of a predefined enquiry field for the Icelandic Flow:
 *   excluded — not shown in the angler form
 *   optional — shown, angler may skip
 *   included — shown and required (angler must fill in)
 */
export type InquiryFieldStatus = 'excluded' | 'optional' | 'included'

/** Static definition of one predefined enquiry field (not stored in DB). */
export type InquiryPresetFieldDef = {
  id: string
  label: string
  hint: string         // shown to guide in the field builder
  type: 'text' | 'textarea' | 'select'
  placeholder?: string
  options?: string[]   // for type='select'
}

/** Canonical list of predefined enquiry fields — order is the display order. */
export const INQUIRY_PRESET_FIELDS: InquiryPresetFieldDef[] = [
  {
    id: 'experience_level',
    label: 'Experience level',
    hint: 'How experienced is the angler with fishing?',
    type: 'select',
    options: ['Beginner', 'Intermediate', 'Experienced', 'Expert'],
  },
  {
    id: 'fishing_method',
    label: 'Fishing method preference',
    hint: 'Which type of fishing are they most interested in?',
    type: 'select',
    options: ['Fly fishing', 'Spinning / lure', 'Trolling', 'Jigging', 'Bottom fishing', 'Shore fishing'],
  },
  {
    id: 'target_species',
    label: 'Target species',
    hint: 'Which fish species are they hoping to catch?',
    type: 'text',
    placeholder: 'e.g. Atlantic salmon, Arctic char, Brown trout…',
  },
  {
    id: 'own_gear',
    label: 'Own fishing gear',
    hint: 'Do they bring their own equipment or need rental gear?',
    type: 'select',
    options: ['Yes – I bring my own gear', 'No – I need full rental gear', 'Partial – I have some gear'],
  },
  {
    id: 'group_type',
    label: 'Group type',
    hint: 'Who is in the group?',
    type: 'select',
    options: ['Solo', 'Couple', 'Friends group', 'Family (children included)', 'Corporate / team event'],
  },
  {
    id: 'accommodation',
    label: 'Accommodation needed',
    hint: 'Does the group need accommodation as part of the trip?',
    type: 'select',
    options: ['Yes, please include it', 'No, I arrange my own', 'Not sure yet'],
  },
  {
    id: 'notes',
    label: 'Additional information',
    hint: 'Any extra details, special requests or accessibility needs.',
    type: 'textarea',
    placeholder: 'e.g. celebrating a birthday, wheelchair user in group, dietary requirements…',
  },
]

/** JSON config for the Icelandic Flow enquiry form — stored in experiences.inquiry_form_config */
export type IcelandicFormConfig = {
  /** Only non-excluded fields are stored. Missing id → treated as 'excluded'. */
  fields?: Array<{ id: string; status: InquiryFieldStatus }>
}

/** @deprecated Use INQUIRY_PRESET_FIELDS + IcelandicFormConfig instead. */
export type InquiryCustomField = {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'number'
  required?: boolean
  placeholder?: string
  options?: string[]
}

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

// ─── Utility ───────────────────────────────────────────────────────────────

/** Typed Server Action response — always return this shape from actions. */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
