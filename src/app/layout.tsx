import type { Metadata } from 'next'
import { Fraunces, DM_Sans } from 'next/font/google'
import Script from 'next/script'
import { CookieBanner } from '@/components/ui/cookie-banner'
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
    default: 'FjordAnglers — Guided Fishing Trips in Nordic Countries',
    template: '%s | FjordAnglers',
  },
  description:
    'Book guided fishing trips in Norway, Sweden, Iceland & Finland with verified local guides. Salmon, sea trout, pike & fly fishing. Free to browse — only pay when you confirm.',
  keywords: [
    'guided fishing trips Norway', 'salmon fishing Norway', 'fly fishing Iceland',
    'fishing guide Scandinavia', 'sea trout fishing Sweden', 'Nordic fishing guide',
    'guided salmon fishing', 'fjord fishing', 'wędkowanie Norwegia', 'Angelreisen Norwegen',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    // alternateLocale removed — no translated pages exist yet; add back when /pl/ and /de/ routes are built
    url: 'https://fjordanglers.com',
    siteName: 'FjordAnglers',
    title: 'FjordAnglers — Guided Fishing Trips in Nordic Countries',
    description: 'Book guided fishing trips in Norway, Sweden, Iceland & Finland with verified local guides. Salmon, trout, pike & more.',
    images: [{ url: '/brand/og-default.png', width: 1200, height: 630, alt: 'FjordAnglers — Guided Fishing Trips in Nordic Countries' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FjordAnglers — Guided Fishing Trips in Nordic Countries',
    description: 'Book guided fishing trips in Norway, Sweden, Iceland & Finland. Salmon, trout, pike & fly fishing.',
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
              description: 'Guided fishing trips marketplace connecting Central European anglers with verified local guides across Norway, Sweden, Iceland and Finland.',
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
              ],
              knowsAbout: ['Salmon fishing', 'Sea trout fishing', 'Fly fishing', 'Nordic fishing guides', 'Pike fishing'],
            }),
          }}
        />
      </head>
      <body>
        {children}
        {GTM_ID && <CookieBanner gtmId={GTM_ID} />}

        {/* ── GTM — loads unconditionally, consent mode controls what fires ── */}
        {GTM_ID && (
          <Script id="gtm-init" strategy="afterInteractive">{`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');
          `}</Script>
        )}

        {/* ── Google Ads — unconditional, consent mode governs ad cookies ── */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-18008446689"
          strategy="afterInteractive"
        />
        <Script id="google-ads" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-18008446689');
        `}</Script>
      </body>
    </html>
  )
}
