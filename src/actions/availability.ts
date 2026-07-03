'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ActionResult = { success: true } | { success: false; error: string }

function genDatesInRange(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  while (cur <= endD) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Set open season: block everything outside [from, to], unblock inside.
 * Replaces all existing blocks from today forward.
 */
export async function setOpenSeason(from: string, to: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) return { success: false, error: 'Not authenticated' }

  const { data: guide } = await supabase
    .from('guides').select('id').eq('user_id', user.id).single()
  if (guide == null) return { success: false, error: 'Guide not found' }

  const today = new Date().toISOString().slice(0, 10)
  const twoYearsOut = new Date()
  twoYearsOut.setFullYear(twoYearsOut.getFullYear() + 2)
  const maxDate = twoYearsOut.toISOString().slice(0, 10)

  // Delete all existing blocks from today forward
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delError } = await (supabase as any)
    .from('guide_unavailable_dates')
    .delete()
    .eq('guide_id', guide.id)
    .gte('date', today)
  if (delError != null) return { success: false, error: delError.message }

  // Block everything outside [from, to]
  const toBlock: string[] = []
  if (from > today) toBlock.push(...genDatesInRange(today, addDays(from, -1)))
  if (to < maxDate)  toBlock.push(...genDatesInRange(addDays(to, 1), maxDate))

  if (toBlock.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insError } = await (supabase as any)
      .from('guide_unavailable_dates')
      .upsert(
        toBlock.map(d => ({ guide_id: guide.id, date: d })),
        { ignoreDuplicates: true },
      )
    if (insError != null) return { success: false, error: insError.message }
  }

  revalidatePath('/dashboard/calendar')
  return { success: true }
}

/**
 * Mark dates as unavailable/blocked (insert) or remove block (delete).
 * Dates are ISO strings: 'YYYY-MM-DD'.
 * Default state is available — only blocked dates are stored.
 */
export async function setAvailability(
  dates: string[],
  blocked: boolean,
): Promise<ActionResult> {
  if (dates.length === 0) return { success: true }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user == null) return { success: false, error: 'Not authenticated' }

  const { data: guide } = await supabase
    .from('guides')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (guide == null) return { success: false, error: 'Guide not found' }

  if (blocked) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('guide_unavailable_dates')
      .upsert(
        dates.map(d => ({ guide_id: guide.id, date: d })),
        { ignoreDuplicates: true },
      )
    if (error != null) return { success: false, error: error.message }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('guide_unavailable_dates')
      .delete()
      .eq('guide_id', guide.id)
      .in('date', dates)
    if (error != null) return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/calendar')
  return { success: true }
}
