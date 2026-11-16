/**
 * Server-side validation of a guide's answer (FA-M.03). Everything the guide sends — the answer,
 * the dates, the note — passes through here before it reaches the database. "In the future" is
 * not checked here: it depends on the trip country's time zone and is decided inside the database
 * transaction (`guide_request_apply_answer`).
 */

import { z } from 'zod'

export const GUIDE_ANSWERS = ['accepted', 'declined', 'other_dates'] as const
export type GuideAnswer = typeof GUIDE_ANSWERS[number]

const MAX_ALT_DATES = 3
const MAX_NOTE_LENGTH = 500

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').refine(
  s => {
    const d = new Date(`${s}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
  },
  'not a calendar date',
)

export const GuideRequestAnswerSchema = z
  .object({
    answer:   z.enum(GUIDE_ANSWERS),
    altDates: z.array(IsoDate).max(MAX_ALT_DATES).default([]),
    note:     z.string().trim().max(MAX_NOTE_LENGTH).nullish(),
  })
  .transform(v => ({ ...v, note: v.note == null || v.note === '' ? null : v.note }))
  .superRefine((v, ctx) => {
    if (v.answer === 'other_dates' && v.altDates.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['altDates'], message: 'other_dates needs 1–3 dates' })
    }
    if (v.answer !== 'other_dates' && v.altDates.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['altDates'], message: 'dates only with other_dates' })
    }
    if (new Set(v.altDates).size !== v.altDates.length) {
      ctx.addIssue({ code: 'custom', path: ['altDates'], message: 'duplicate dates' })
    }
    if (v.answer === 'accepted' && v.note != null) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'no note with accepted' })
    }
  })

