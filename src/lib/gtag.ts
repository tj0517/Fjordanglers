/**
 * GA4 event helpers.
 *
 * window.gtag is injected by GTM, which is loaded consent-gated via CookieBanner.
 * All helpers are safe to call unconditionally — they no-op if gtag is not available
 * (before consent, or when GTM_ID is not configured).
 */

// ── Generic event ──────────────────────────────────────────────────────────────

export function gtagEvent(action: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  if (typeof window.gtag !== 'function') return
  window.gtag('event', action, params)
}

// ── Typed event helpers ────────────────────────────────────────────────────────

/**
 * qualify_lead — fire when an angler submits a booking request.
 * Maps to the GA4 "Qualify lead" recommended event.
 */
export function trackQualifyLead(params: {
  value: number
  trip_name?: string
  currency?: string
}) {
  gtagEvent('qualify_lead', {
    currency: 'EUR',
    value: params.value,
    ...(params.trip_name ? { trip_name: params.trip_name } : {}),
    ...(params.currency  ? { currency: params.currency }   : {}),
  })
}

/**
 * purchase — fire after a successful Stripe payment (status=paid redirect).
 * Maps to the GA4 "Purchase" recommended e-commerce event.
 */
export function trackPurchase(params: {
  transaction_id: string
  value: number
  trip_name?: string
  location_country?: string
  currency?: string
}) {
  gtagEvent('purchase', {
    transaction_id: params.transaction_id,
    value:          params.value,
    currency:       params.currency ?? 'EUR',
    items: [
      {
        item_name:     params.trip_name        ?? 'Fishing trip',
        item_category: params.location_country ?? '',
        price:         params.value,
        quantity:      1,
      },
    ],
  })
}

/**
 * form_start — fire on the first interaction with a booking / inquiry form.
 */
export function trackFormStart(params: { form_id: string; form_name: string }) {
  gtagEvent('form_start', params)
}
