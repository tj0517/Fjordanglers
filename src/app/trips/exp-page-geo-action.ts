'use server'

import { createServiceClient } from '@/lib/supabase/server'
import type { ExpPage } from './exp-page-map-section'

/**
 * Fetches ALL active experience_pages that have coordinates set.
 * Called lazily: on desktop at mount, on mobile only when user opens the map.
 * Used to show pins for the entire dataset without pagination.
 */
export async function fetchGeoExpPages(): Promise<ExpPage[]> {
  const svc = createServiceClient()

  const { data, error } = await svc
    .from('experience_pages')
    .select('id, slug, experience_name, country, region, price_from, price_type, hero_image_url, gallery_image_urls, difficulty, technique, target_species, non_angler_friendly, location_lat, location_lng, location_area, location_spots')
    .eq('status', 'active')
    .or('location_lat.not.is.null,location_area.not.is.null,location_spots.not.is.null')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) {
    console.error('[fetchGeoExpPages]', error.message)
    return []
  }

  return (data ?? []) as ExpPage[]
}
