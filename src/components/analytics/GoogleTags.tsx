'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { thirdPartyScriptsAllowed } from '@/lib/analytics/third-party-free-routes'

/**
 * GTM and the Google Ads tag, exactly as the root layout loaded them, skipped on the routes in
 * `THIRD_PARTY_FREE_ROUTES` (FA-M.04). `usePathname` is known during the server render, so on a
 * skipped route the HTML carries neither the scripts nor their preload links.
 */
export function GoogleTags({ gtmId }: { gtmId: string | undefined }) {
  const pathname = usePathname()
  if (!thirdPartyScriptsAllowed(pathname)) return null

  return (
    <>
      {/* ── GTM — loads unconditionally, consent mode controls what fires ── */}
      {gtmId && (
        <Script id="gtm-init" strategy="afterInteractive">{`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');
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
    </>
  )
}
