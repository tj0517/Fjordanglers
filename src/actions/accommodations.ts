'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

type GuideAccommodationRow = Database['public']['Tables']['guide_accommodations']['Row']
type AccommodationPayload  = {
  name: string
  type: string
  description?: string | null
  max_guests?: number | null
  location_note?: string | null
}

export type AccActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string }

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function resolveCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) return null

  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (guide == null) return null
  return { guideId: guide.id, supabase }
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createAccommodation(
  payload: AccommodationPayload,
): Promise<AccActionResult<GuideAccommodationRow>> {
  try {
    const ctx = await resolveCtx()
    if (ctx == null) return { success: false, error: 'Unauthorized' }

    const { data, error } = await ctx.supabase
      .from('guide_accommodations')
      .insert({
        guide_id:      ctx.guideId,
        name:          payload.name.trim(),
        type:          payload.type,
        description:   payload.description?.trim() || null,
        max_guests:    payload.max_guests ?? null,
        location_note: payload.location_note?.trim() || null,
      })
      .select()
      .single()

    if (error != null) return { success: false, error: error.message }
    return { success: true, data }
  } catch {
    return { success: false, error: 'Unexpected error' }
  }
}

export async function updateAccommodation(
  id: string,
  payload: Partial<AccommodationPayload>,
): Promise<AccActionResult> {
  try {
    const ctx = await resolveCtx()
    if (ctx == null) return { success: false, error: 'Unauthorized' }

    const update: Record<string, unknown> = {}
    if (payload.name          != null)      update.name          = payload.name.trim()
    if (payload.type          != null)      update.type          = payload.type
    if (payload.description   !== undefined) update.description   = payload.description?.trim() || null
    if (payload.max_guests    !== undefined) update.max_guests    = payload.max_guests ?? null
    if (payload.location_note !== undefined) update.location_note = payload.location_note?.trim() || null

    const { error } = await ctx.supabase
      .from('guide_accommodations')
      .update(update)
      .eq('id', id)
      .eq('guide_id', ctx.guideId)

    if (error != null) return { success: false, error: error.message }
    return { success: true }
  } catch {
    return { success: false, error: 'Unexpected error' }
  }
}

export async function deleteAccommodation(id: string): Promise<AccActionResult> {
  try {
    const ctx = await resolveCtx()
    if (ctx == null) return { success: false, error: 'Unauthorized' }

    const { error } = await ctx.supabase
      .from('guide_accommodations')
      .delete()
      .eq('id', id)
      .eq('guide_id', ctx.guideId)

    if (error != null) return { success: false, error: error.message }
    return { success: true }
  } catch {
    return { success: false, error: 'Unexpected error' }
  }
}

export async function updateAccommodationImages(
  id: string,
  images: string[],
): Promise<AccActionResult> {
  try {
    const ctx = await resolveCtx()
    if (ctx == null) return { success: false, error: 'Unauthorized' }

    const { error } = await ctx.supabase
      .from('guide_accommodations')
      .update({ images })
      .eq('id', id)
      .eq('guide_id', ctx.guideId)

    if (error != null) return { success: false, error: error.message }
    return { success: true }
  } catch {
    return { success: false, error: 'Unexpected error' }
  }
}

/**
 * Replace all experience_accommodations rows for a given experience.
 * Deletes existing rows then inserts the new set.
 * Called from createExperience / updateExperience after the main DB write.
 */
export async function setExperienceAccommodations(
  expId: string,
  accIds: string[],
): Promise<AccActionResult> {
  try {
    const supabase = await createClient()

    const { error: delError } = await supabase
      .from('experience_accommodations')
      .delete()
      .eq('experience_id', expId)

    if (delError != null) return { success: false, error: delError.message }

    if (accIds.length > 0) {
      const { error: insError } = await supabase
        .from('experience_accommodations')
        .insert(accIds.map(accommodation_id => ({ experience_id: expId, accommodation_id })))

      if (insError != null) return { success: false, error: insError.message }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Unexpected error' }
  }
}
