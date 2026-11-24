import { getDestinationHub, getFeaturedGuides, getLatestBlogPosts, type DestinationHubData } from '@/lib/supabase/queries'
import { getTestimonial } from '@/lib/supabase/testimonials'
import { COUNTRIES } from '@/lib/countries'
import { DESTINATION_HUBS } from '@/lib/destinations'
import { SITE_URL } from '@/lib/site'
import HomeView from '@/components/home/home-view'

export const revalidate = 300

export const metadata = {
  alternates: { canonical: SITE_URL },
}

/**
 * One hub for the countries, the globe and the trip cards. A hub that cannot be read (its content
 * row is missing, an outage) is left out of the home page rather than failing it, and logged.
 */
async function hubOrNone(slug: string): Promise<DestinationHubData | null> {
  try {
    return await getDestinationHub(slug)
  } catch (err) {
    console.error('[home] hub unavailable:', slug, err instanceof Error ? err.message : err)
    return null
  }
}

export default async function HomePage() {
  const [hubs, guides, testimonial, posts] = await Promise.all([
    Promise.all(DESTINATION_HUBS.map(h => hubOrNone(h.slug))),
    getFeaturedGuides(6),
    // Every country we guide in: the first active testimonial whatever its trip, else a general one (tj, 2026-11-17).
    getTestimonial(COUNTRIES),
    getLatestBlogPosts(3),
  ])

  return (
    <HomeView
      data={{
        hubs:        hubs.filter((h): h is DestinationHubData => h != null),
        guides,
        testimonial,
        posts,
      }}
    />
  )
}
