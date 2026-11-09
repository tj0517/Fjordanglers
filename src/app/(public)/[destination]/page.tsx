import { notFound } from 'next/navigation'
import { DESTINATION_HUBS } from '@/lib/destinations'
import { getDestinationHub } from '@/lib/supabase/queries'
import { WebEventTracker } from '@/components/analytics/WebEventTracker'
import DestinationHubView from '@/components/destination-hub/destination-hub-view'
import { SITE_URL } from '@/lib/site'
import { buildHubJsonLd } from '@/lib/seo/hub-jsonld'
import { serializeJsonLd } from '@/lib/seo/offer-jsonld'

export const revalidate = 60

// ─── Static params & metadata ─────────────────────────────────────────────────

export function generateStaticParams() {
  return DESTINATION_HUBS.map(hub => ({ destination: hub.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ destination: string }> }) {
  const { destination } = await params
  const data = await getDestinationHub(destination)
  if (data == null) return {}

  const { hub } = data
  const ogImage = data.ogImage ?? `${SITE_URL}/brand/og-default.png`

  return {
    title: hub.metaTitle,
    description: hub.metaDescription,
    alternates: { canonical: `${SITE_URL}/${hub.slug}` },
    openGraph: {
      title: hub.metaTitle,
      description: hub.metaDescription,
      url: `${SITE_URL}/${hub.slug}`,
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

  const jsonLd = buildHubJsonLd(data, SITE_URL)

  return (
    <div style={{ background: '#F3EDE4' }}>
      <WebEventTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd.itemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd.breadcrumb) }} />
      {jsonLd.faq != null && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd.faq) }} />
      )}

      {/* Spacer for fixed nav */}
      <div style={{ height: '72px' }} />

      <DestinationHubView data={data} />
    </div>
  )
}
