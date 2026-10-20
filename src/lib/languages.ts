// ─── SINGLE SOURCE OF TRUTH FOR GUIDE LANGUAGES ───────────────────────────
// The languages a guide can say they speak — the admin guide forms and the guide's own
// profile form pick from this one list (FA-1.62; tj 2026-10-20: the profile form's 12).

export const GUIDE_LANGUAGES = [
  'English', 'Norwegian', 'Swedish', 'Finnish', 'Danish', 'Icelandic',
  'German', 'Polish', 'French', 'Dutch', 'Russian', 'Spanish',
] as const
