'use client'

import { useEffect, useSyncExternalStore } from 'react'
import Script from 'next/script'
import Link from 'next/link'

const CONSENT_KEY   = 'fa_cookie_consent'
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const CLARITY_ID    = process.env.NEXT_PUBLIC_CLARITY_ID

/**
 * Stored consent, read as an external store rather than copied into state by an
 * effect (react-hooks/set-state-in-effect). 'unknown' is the server snapshot, so
 * the banner is never part of the SSR HTML — exactly as before, when `visible`
 * started false and an effect flipped it.
 */
type ConsentSnapshot = 'accepted' | 'declined' | 'none' | 'unknown'

const CONSENT_CHANGED = 'fa:cookie-consent-changed'

function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener('storage', onChange)
  window.addEventListener(CONSENT_CHANGED, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CONSENT_CHANGED, onChange)
  }
}

function readConsent(): ConsentSnapshot {
  try {
    const stored = localStorage.getItem(CONSENT_KEY)
    return stored === 'accepted' || stored === 'declined' ? stored : 'none'
  } catch {
    // Private mode / storage blocked — behave like a first-time visitor.
    return 'none'
  }
}

function serverConsent(): ConsentSnapshot {
  return 'unknown'
}

function storeConsent(value: 'accepted' | 'declined') {
  try {
    localStorage.setItem(CONSENT_KEY, value)
  } catch {
    // Nothing persisted — the banner reappears on the next visit.
  }
  window.dispatchEvent(new Event(CONSENT_CHANGED))
}

function grantConsent() {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      analytics_storage:  'granted',
      ad_storage:         'granted',
      ad_user_data:       'granted',
      ad_personalization: 'granted',
    })
  }
}

export function CookieBanner({ gtmId: _gtmId }: { gtmId: string }) {
  const consent = useSyncExternalStore(subscribeConsent, readConsent, serverConsent)
  const visible = consent === 'none'

  // Push the current consent to gtag — updating an external system, which is
  // what an effect is for.
  useEffect(() => {
    if (consent === 'accepted') grantConsent()
  }, [consent])

  function accept()  { storeConsent('accepted') }
  function decline() { storeConsent('declined') }

  return (
    <>

      {/* ── Clarity — loaded once after consent, direct (not via GTM) ── */}
      {consent === 'accepted' && CLARITY_ID != null && (
        <Script id="clarity-init" strategy="afterInteractive">{`
          (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");
        `}</Script>
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
