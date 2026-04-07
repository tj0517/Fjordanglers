// Extend the browser Window interface with tracking functions injected by
// GTM and Meta Pixel. Both are consent-gated via CookieBanner.

export {}

declare global {
  interface Window {
    // ── Google Tag Manager / GA4 ─────────────────────────────────────────────
    gtag: (
      command: 'event' | 'config' | 'js' | 'set',
      targetId: string | Date,
      params?: Record<string, unknown>,
    ) => void
    dataLayer: unknown[]

    // ── Meta Pixel ───────────────────────────────────────────────────────────
    fbq: (
      command: 'track' | 'trackCustom' | 'init' | 'consent',
      eventOrId: string,
      params?: Record<string, unknown>,
    ) => void
    _fbq: Window['fbq']
  }
}
