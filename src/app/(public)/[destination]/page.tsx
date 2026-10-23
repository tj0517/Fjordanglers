import { notFound } from 'next/navigation'
import { DESTINATION_HUBS } from '@/lib/destinations'
import { getDestinationHub } from '@/lib/supabase/queries'
import { WebEventTracker } from '@/components/analytics/WebEventTracker'
import DestinationHubView from '@/components/destination-hub/destination-hub-view'

export const revalidate = 60

// ─── Static params & metadata ─────────────────────────────────────────────────

export function generateStaticParams() {
  return DESTINATION_HUBS.map(hub => ({ destination: hub.slug }))
}

const BASE = 'https://fjordanglers.com'

export async function generateMetadata({ params }: { params: Promise<{ destination: string }> }) {
  const { destination } = await params
  const data = await getDestinationHub(destination)
  if (data == null) return {}

  const { hub } = data
  const ogImage = data.ogImage ?? `${BASE}/brand/og-default.png`

  return {
    title: hub.metaTitle,
    description: hub.metaDescription,
    alternates: { canonical: `${BASE}/${hub.slug}` },
    openGraph: {
      title: hub.metaTitle,
      description: hub.metaDescription,
      url: `${BASE}/${hub.slug}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: hub.h1 }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: hub.metaTitle,
      description: hub.metaDescription,
      images: [ogImage],
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DestinationHubPage({
  params,
}: {
  params: Promise<{ destination: string }>
}) {
  const { destination } = await params
  const data = await getDestinationHub(destination)
  if (data == null) notFound()

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: data.hub.h1,
    numberOfItems: data.offers.length,
    itemListElement: data.offers.map((offer, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'TouristTrip',
        name: offer.page.experience_name,
        url: `${BASE}/experiences/${offer.page.slug}`,
        ...(offer.page.hero_image_url != null ? { image: offer.page.hero_image_url } : {}),
      },
    })),
  }

  return (
    <div style={{ background: '#F3EDE4' }}>
      <WebEventTracker />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      {/* Spacer for fixed nav */}
      <div style={{ height: '72px' }} />

      <DestinationHubView data={data} />
    </div>
  )
}
