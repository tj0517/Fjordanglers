/**
 * GA4 event helpers.
 *
 * window.gtag is injected by GTM, which is loaded consent-gated via CookieBanner.
 * All helpers are safe to call unconditionally — they no-op if gtag is not available
 * (before consent, or when GTM_ID is not configured).
 */

// ── Measurement IDs ───────────────────────────────────────────────────────────
const ADS_CONVERSION_SEND_TO = 'AW-18171634204/yydcCKmuoe0cEJzE9NhD'
const GA4_MEASUREMENT_ID     = 'G-Z3Y8GMHR4J'

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
 * SUBMIT_LEAD_FORM — fires when an angler submits the inquiry form.
 * Two calls: direct Google Ads conversion + GA4 lead-form event.
 * Always PLN so Google Ads can compare value across lead types.
 */
export function trackSubmitLeadForm(params: {
  value:      number
  currency?:  string
  trip_name?: string
}) {
  const currency = params.currency ?? 'PLN'

  // Direct Google Ads conversion — independent of GA4/GTM
  gtagEvent('conversion', {
    send_to:  ADS_CONVERSION_SEND_TO,
    value:    params.value,
    currency,
  })

  // GA4 lead-form event — explicit send_to so GTM-loaded GA4 receives it
  gtagEvent('SUBMIT_LEAD_FORM', {
    send_to:  GA4_MEASUREMENT_ID,
    value:    params.value,
    currency,
    ...(params.trip_name ? { trip_name: params.trip_name } : {}),
  })
}

/**
 * form_start — fire on the first interaction with a booking / inquiry form.
 */
export function trackFormStart(params: { form_id: string; form_name: string }) {
  gtagEvent('form_start', params)
}
