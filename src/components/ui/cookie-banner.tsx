'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import Link from 'next/link'

const CONSENT_KEY    = 'fa_cookie_consent'
const META_PIXEL_ID  = process.env.NEXT_PUBLIC_META_PIXEL_ID

export function CookieBanner({ gtmId }: { gtmId: string }) {
  const [consent, setConsent] = useState<'accepted' | 'declined' | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (stored === 'accepted') setConsent('accepted')
    else if (stored === 'declined') setConsent('declined')
    else setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setConsent('accepted')
    setVisible(false)
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'declined')
    setConsent('declined')
    setVisible(false)
  }

  return (
    <>
      {/* ── GTM — loaded only after consent ─────────────────────────── */}
      {consent === 'accepted' && (
        <>
          {/* GTM script tag */}
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
          </Script>

          {/* GTM noscript fallback — also consent-gated */}
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        </>
      )}

      {/* ── Meta Pixel — loaded only after consent ───────────────────── */}
      {consent === 'accepted' && META_PIXEL_ID != null && (
        <>
          <Script id="meta-pixel-init" strategy="afterInteractive">{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');
fbq('track','PageView');
          `}</Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1" width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}

      {/* ── Cookie banner ────────────────────────────────────────────── */}
      {visible && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: 'min(560px, calc(100vw - 32px))',
            background: '#0A2E4D',
            borderRadius: '16px',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 8px 40px rgba(10,46,77,0.35)',
          }}
        >
          <p
            className="f-body"
            style={{
              flex: 1,
              color: 'rgba(248,250,251,0.75)',
              fontSize: '13px',
              lineHeight: '1.5',
              margin: 0,
            }}
          >
            We use cookies to understand how visitors use FjordAnglers and improve the experience.{' '}
            <Link
              href="/legal/privacy-policy"
              style={{ color: '#E67E50', textDecoration: 'underline' }}
            >
              Privacy policy
            </Link>
          </p>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={decline}
              className="f-body"
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(248,250,251,0.2)',
                background: 'transparent',
                color: 'rgba(248,250,251,0.6)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Decline
            </button>
            <button
              onClick={accept}
              className="f-body"
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                background: '#E67E50',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  )
}
