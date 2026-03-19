'use server'

/**
 * Guide Calendar Server Actions — CRUD for named calendar groups.
 *
 * A guide can create multiple calendars and assign any subset of their
 * experiences to each. Used by the CalendarsPanel component.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GuideCalendar = {
  id:         string
  guide_id:   string
  name:       string
  created_at: string
}

export type CalendarActionResult =
  | { error: string }
  | { success: true; id?: string }

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireGuide() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) redirect('/login?next=/dashboard/calendar')

  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (guide == null) redirect('/dashboard')
  return { supabase, guideId: guide.id }
}

// ─── Create calendar ──────────────────────────────────────────────────────────

export async function createCalendar(name: string): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    const trimmed = name.trim()
    if (!trimmed)            return { error: 'Calendar name is required.' }
    if (trimmed.length > 80) return { error: 'Name must be 80 characters or fewer.' }

    const { data, error } = await supabase
      .from('guide_calendars')
      .insert({ guide_id: guideId, name: trimmed })
      .select('id')
      .single()

    if (error != null) {
      console.error('[createCalendar]', error.message)
      return { error: 'Failed to create calendar.' }
    }

    return { success: true, id: data.id }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[createCalendar] Unexpected:', err)
    return { error: 'Unexpected error.' }
  }
}

// ─── Update calendar name ──────────────────────────────────────────────────────

export async function updateCalendar(id: string, name: string): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    const trimmed = name.trim()
    if (!trimmed)            return { error: 'Calendar name is required.' }
    if (trimmed.length > 80) return { error: 'Name must be 80 characters or fewer.' }

    const { error } = await supabase
      .from('guide_calendars')
      .update({ name: trimmed })
      .eq('id', id)
      .eq('guide_id', guideId)  // ownership

    if (error != null) {
      console.error('[updateCalendar]', error.message)
      return { error: 'Failed to update calendar.' }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[updateCalendar] Unexpected:', err)
    return { error: 'Unexpected error.' }
  }
}

// ─── Delete calendar ──────────────────────────────────────────────────────────

export async function deleteCalendar(id: string): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    const { error } = await supabase
      .from('guide_calendars')
      .delete()
      .eq('id', id)
      .eq('guide_id', guideId)  // ownership

    if (error != null) {
      console.error('[deleteCalendar]', error.message)
      return { error: 'Failed to delete calendar.' }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[deleteCalendar] Unexpected:', err)
    return { error: 'Unexpected error.' }
  }
}

// ─── Set experiences for a calendar ──────────────────────────────────────────

/**
 * Replaces all experience assignments for a calendar.
 * Passing an empty array removes all experiences from the calendar.
 */
export async function setCalendarExperiences(
  calendarId:    string,
  experienceIds: string[],
): Promise<CalendarActionResult> {
  try {
    const { supabase, guideId } = await requireGuide()

    // Verify calendar ownership
    const { data: cal } = await supabase
      .from('guide_calendars')
      .select('id')
      .eq('id', calendarId)
      .eq('guide_id', guideId)
      .single()

    if (cal == null) return { error: 'Calendar not found.' }

    // Verify all experiences belong to this guide
    if (experienceIds.length > 0) {
      const { data: owned } = await supabase
        .from('experiences')
        .select('id')
        .eq('guide_id', guideId)
        .in('id', experienceIds)

      if ((owned?.length ?? 0) !== experienceIds.length) {
        return { error: 'One or more experiences not found.' }
      }
    }

    // Replace: delete all then insert new
    await supabase
      .from('calendar_experiences')
      .delete()
      .eq('calendar_id', calendarId)

    if (experienceIds.length > 0) {
      const { error } = await supabase
        .from('calendar_experiences')
        .insert(
          experienceIds.map(expId => ({
            calendar_id:   calendarId,
            experience_id: expId,
          }))
        )

      if (error != null) {
        console.error('[setCalendarExperiences]', error.message)
        return { error: 'Failed to assign experiences.' }
      }
    }

    return { success: true }
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('[setCalendarExperiences] Unexpected:', err)
    return { error: 'Unexpected error.' }
  }
}

// ─── Fetch helpers (used by Server Components) ────────────────────────────────

/**
 * Returns all guide_calendars for a given guide, ordered by created_at.
 */
export async function getGuideCalendars(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  guideId: string,
): Promise<GuideCalendar[]> {
  const { data } = await supabase
    .from('guide_calendars')
    .select('id, guide_id, name, created_at')
    .eq('guide_id', guideId)
    .order('created_at')

  return (data ?? []) as GuideCalendar[]
}

/**
 * Returns a map of calendarId → experienceId[] for a list of calendars.
 */
export async function getCalendarExperienceMap(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  calendarIds: string[],
): Promise<Record<string, string[]>> {
  if (calendarIds.length === 0) return {}

  const { data } = await supabase
    .from('calendar_experiences')
    .select('calendar_id, experience_id')
    .in('calendar_id', calendarIds)

  const map: Record<string, string[]> = {}
  for (const row of (data ?? [])) {
    if (map[row.calendar_id] == null) map[row.calendar_id] = []
    map[row.calendar_id]!.push(row.experience_id)
  }
  return map
}
