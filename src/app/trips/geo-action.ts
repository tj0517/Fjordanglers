'use server'

import { getAllExperiencesWithCoords } from '@/lib/supabase/queries'
import type { ExperienceSearchParams } from '@/lib/supabase/queries'

/**
 * Server Action wrapper for map geo data.
 * Called lazily: on desktop at mount, on mobile only when user opens the map.
 * Uses the same unstable_cache as the server-side query, so after the first hit
 * subsequent calls are instant (cache TTL = 5 min).
 */
export async function fetchGeoExperiences(filterKey: string): Promise<Awaited<ReturnType<typeof getAllExperiencesWithCoords>>> {
  const params = Object.fromEntries(new URLSearchParams(filterKey)) as ExperienceSearchParams
  return getAllExperiencesWithCoords(params)
}
