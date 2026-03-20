/**
 * Inquiry form configuration — per-experience field visibility settings.
 *
 * Guides can mark each field as:
 *   'required' — shown with *, validated before submission
 *   'optional' — shown without *, no validation
 *   'hidden'   — not rendered at all
 *
 * Three fields are ALWAYS required and not configurable:
 *   - dates / preferred period
 *   - group size
 *   - target species
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FieldVisibility = 'required' | 'optional' | 'hidden'

export type InquiryFormConfig = {
  // Must-have section (configurable)
  tripType:         FieldVisibility  // half-day / full-day / multi-day chips
  numDays:          FieldVisibility  // days stepper (only shown when multi-day)
  groupComposition: FieldVisibility  // "includes beginners / children" checkboxes

  // Pricing & logistics section
  experienceLevel:  FieldVisibility
  gear:             FieldVisibility
  accommodation:    FieldVisibility
  transport:        FieldVisibility
  boatPreference:   FieldVisibility
  dietary:          FieldVisibility

  // Nice-to-have section
  stayingAt:        FieldVisibility
  photography:      FieldVisibility
  regionExperience: FieldVisibility
  budget:           FieldVisibility

  // Notes (always last)
  notes:            FieldVisibility
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_INQUIRY_FORM_CONFIG: InquiryFormConfig = {
  tripType:         'required',
  numDays:          'optional',
  groupComposition: 'optional',
  experienceLevel:  'required',
  gear:             'required',
  accommodation:    'required',
  transport:        'optional',
  boatPreference:   'optional',
  dietary:          'optional',
  stayingAt:        'optional',
  photography:      'optional',
  regionExperience: 'optional',
  budget:           'optional',
  notes:            'optional',
}

// ─── Merge helper ─────────────────────────────────────────────────────────────

/** Merge partial config from DB with defaults — safe against missing keys. */
export function resolveFormConfig(
  partial: Partial<InquiryFormConfig> | null | undefined,
): InquiryFormConfig {
  return { ...DEFAULT_INQUIRY_FORM_CONFIG, ...(partial ?? {}) }
}

// ─── Editor metadata ──────────────────────────────────────────────────────────

export type FieldMeta = {
  key:         keyof InquiryFormConfig
  label:       string
  description: string
}

export type FieldGroupMeta = {
  title:  string
  note?:  string
  fields: FieldMeta[]
}

export const FIELD_GROUPS: FieldGroupMeta[] = [
  {
    title: 'Trip type & duration',
    note:  'Dates, group size and target species are always required.',
    fields: [
      {
        key:         'tripType',
        label:       'Trip type',
        description: 'Half-day / Full day / Multi-day selector',
      },
      {
        key:         'numDays',
        label:       'Number of days',
        description: 'Stepper shown when multi-day is selected',
      },
      {
        key:         'groupComposition',
        label:       'Group composition',
        description: '"Includes beginners / children" checkboxes',
      },
    ],
  },
  {
    title: 'Pricing & logistics',
    fields: [
      {
        key:         'experienceLevel',
        label:       'Fishing experience level',
        description: 'Beginner / Intermediate / Expert',
      },
      {
        key:         'gear',
        label:       'Gear & tackle',
        description: 'Own gear / needs some / provide everything',
      },
      {
        key:         'accommodation',
        label:       'Accommodation',
        description: 'Include / just guiding / flexible',
      },
      {
        key:         'transport',
        label:       'Transport',
        description: 'Need pickup / self-drive / flexible',
      },
      {
        key:         'boatPreference',
        label:       'Boat preference',
        description: 'Free text — type of boat preferred',
      },
      {
        key:         'dietary',
        label:       'Dietary restrictions & lunch',
        description: 'Dietary needs, allergies, lunch preferences',
      },
    ],
  },
  {
    title: 'Context & extras',
    note:  'Shown in the collapsible "Nice to have" section by default.',
    fields: [
      {
        key:         'stayingAt',
        label:       'Where they\'re staying',
        description: 'Hotel name or area — helps plan meeting point',
      },

      {
        key:         'photography',
        label:       'Photography / video package',
        description: 'Interest in photo/video coverage of the trip',
      },
      {
        key:         'regionExperience',
        label:       'Previous experience in region',
        description: 'Have they fished here before',
      },
      {
        key:         'budget',
        label:       'Budget indication',
        description: 'Min and max EUR range',
      },
    ],
  },
  {
    title: 'Free text',
    fields: [
      {
        key:         'notes',
        label:       'Additional notes',
        description: 'Open text box for anything else',
      },
    ],
  },
]
