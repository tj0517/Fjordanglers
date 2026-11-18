/**
 * An experience page row as the v1 offer page and its Leaflet map read it. The listing card that
 * lived here was replaced on /trips by the site's trip card (src/components/site/trip-card.tsx).
 */

export type ExpPage = {
  id: string
  slug: string
  experience_name: string
  country: string
  region: string
  price_from: number
  price_type: string
  currency: string
  hero_image_url: string | null
  gallery_image_urls: unknown
  difficulty: string | null
  technique: unknown
  target_species: unknown
  non_angler_friendly: boolean | null
  location_lat: number | null
  location_lng: number | null
  location_area: unknown   // GeoJSON.Polygon | null
  location_spots: unknown  // LocationSpot[] | null
}
