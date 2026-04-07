/**
 * Meta Pixel (fbq) helpers.
 *
 * window.fbq is injected by the pixel base code, which is loaded consent-gated
 * via CookieBanner (same as GTM). All helpers are safe to call unconditionally —
 * they no-op if fbq is not yet available (before consent or not configured).
 */

// ── Generic event ──────────────────────────────────────────────────────────────

export function fbqEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  if (typeof window.fbq !== 'function') return
  window.fbq('track', eventName, params)
}

// ── Standard Meta Pixel events ─────────────────────────────────────────────────

/**
 * Lead — fire when an angler submits a booking request.
 * Equivalent to GA4 qualify_lead.
 */
export function trackFbLead(params?: { value?: number; currency?: string }) {
  fbqEvent('Lead', params ? { value: params.value, currency: params.currency ?? 'EUR' } : undefined)
}

/**
 * Purchase — fire after a successful Stripe payment redirect.
 */
export function trackFbPurchase(params: { value: number; currency?: string }) {
  fbqEvent('Purchase', { value: params.value, currency: params.currency ?? 'EUR' })
}

/**
 * InitiateCheckout — fire when angler starts the inquiry/booking form.
 * Equivalent to GA4 form_start.
 */
export function trackFbInitiateCheckout() {
  fbqEvent('InitiateCheckout')
}
