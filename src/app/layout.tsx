import type { Metadata } from 'next'
import { Fraunces, DM_Sans } from 'next/font/google'
import Script from 'next/script'
import { CookieBanner } from '@/components/ui/cookie-banner'
import { GclidCapture } from '@/components/analytics/GclidCapture'
import './globals.css'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['400', '500', '600', '700', '900'],
  style: ['normal', 'italic'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://fjordanglers.com'),
  title: {
    default: 'FjordAnglers. Fishing guides who own the boat.',
    template: '%s | FjordAnglers',
  },
  description:
    'Owner-guides in Iceland, Norway, Sweden, Finland, Patagonia and New Zealand. Send your dates, we check with the guide and reply within 24 hours. No payment to enquire.',
  keywords: [
    'fishing guide Iceland', 'salmon fishing Iceland', 'fly fishing Patagonia',
    'Bariloche fishing guide', 'Coyhaique fly fishing', 'trout fishing New Zealand',
    'Tongariro fishing guide', 'fishing guide Norway', 'pike fishing Sweden',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    // alternateLocale removed — no translated pages exist yet; add back when /pl/ and /de/ routes are built
    url: 'https://fjordanglers.com',
    siteName: 'FjordAnglers',
    title: 'FjordAnglers. Fishing guides who own the boat.',
    description: 'Owner-guides in Iceland, Norway, Sweden, Finland, Patagonia and New Zealand. Send your dates, we check with the guide and reply within 24 hours. No payment to enquire.',
    images: [{ url: '/brand/og-default.png', width: 1200, height: 630, alt: 'A guide and an angler on a river bank at first light' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FjordAnglers. Fishing guides who own the boat.',
    description: 'Owner-guides in Iceland, Norway, Sweden, Finland, Patagonia and New Zealand. Send your dates, we check with the guide and reply within 24 hours. No payment to enquire.',
    images: ['/brand/og-default.png'],
  },
  robots: {
    index: true,
    follow: true,
    'max-snippet': -1,
    'max-image-preview': 'large',
    'max-video-preview': -1,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`}>
      <head>
        {/* Preconnect to Supabase CDN — speeds up all guide/experience images */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />

        {/* Preconnect to jsDelivr CDN — used for country flag SVGs */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />

        {/* ── Google Consent Mode v2 defaults — MUST be first, before GTM ── */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            wait_for_update: 500,
          });
        `}} />

        {/* WebSite + SearchAction — enables sitelinks searchbox in branded SERPs */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'FjordAnglers',
              url: 'https://fjordanglers.com',
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: 'https://fjordanglers.com/trips?country={search_term_string}',
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />

        {/* Organization + LocalBusiness structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': ['Organization', 'LocalBusiness'],
              name: 'FjordAnglers',
              url: 'https://fjordanglers.com',
              logo: 'https://fjordanglers.com/brand/sygnet.png',
              description: 'FjordAnglers puts anglers in direct contact with independent fishing guides in Iceland, Scandinavia, Patagonia and New Zealand. Each guide is met and checked by the founders before listing.',
              email: 'contact@fjordanglers.com',
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Otwarta 38b/11',
                addressLocality: 'Gdańsk',
                addressRegion: 'Pomeranian',
                addressCountry: 'PL',
              },
              foundingDate: '2026-04',
              founder: [
                { '@type': 'Person', name: 'Tymon' },
                { '@type': 'Person', name: 'Krzychu' },
                { '@type': 'Person', name: 'Lukas' },
              ],
              sameAs: ['https://instagram.com/fjordanglers'],
              areaServed: [
                { '@type': 'Country', name: 'Norway' },
                { '@type': 'Country', name: 'Sweden' },
                { '@type': 'Country', name: 'Iceland' },
                { '@type': 'Country', name: 'Finland' },
                { '@type': 'Country', name: 'Argentina' },
                { '@type': 'Country', name: 'Chile' },
                { '@type': 'Country', name: 'New Zealand' },
              ],
              knowsAbout: ['Atlantic salmon', 'Brown trout', 'Arctic char', 'Fly fishing', 'Rangá river', 'Limay river', 'Mataura river', 'Tongariro river', 'Iceland', 'Norway', 'Sweden', 'Finland', 'Argentina', 'Chile', 'New Zealand'],
            }),
          }}
        />
      </head>
      <body>
        {children}
        <GclidCapture />
        {GTM_ID && <CookieBanner gtmId={GTM_ID} />}

        {/* ── GTM — loads unconditionally, consent mode controls what fires ── */}
        {GTM_ID && (
          <Script id="gtm-init" strategy="afterInteractive">{`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');
          `}</Script>
        )}

        {/* ── Google Ads — unconditional, consent mode governs ad cookies ── */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-18171634204"
          strategy="afterInteractive"
        />
        <Script id="google-ads" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-18171634204');
        `}</Script>
      </body>
    </html>
  )
}
