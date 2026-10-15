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

function gtagEvent(action: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  if (typeof window.gtag !== 'function') return
  window.gtag('event', action, params)
}

// ── Typed event helpers ────────────────────────────────────────────────────────

/**
 * SUBMIT_LEAD_FORM — fires when an angler submits the inquiry form.
 * Two calls: direct Google Ads conversion + GA4 lead-form event.
 * Always PLN so Google Ads can compare value across lead types.
 */
export function trackSubmitLeadForm(params: {
  value:      number
  currency?:  string
  trip_name?: string
  /** FA-1.60 — the experience page it was sent from; GA4 event only, never the Ads call. */
  page?:      FunnelPage
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
    ...(params.page ?? {}),
  })
}

/**
 * form_start — fire on the first interaction with a booking / inquiry form.
 */
export function trackFormStart(params: { form_id: string; form_name: string }) {
  gtagEvent('form_start', params)
}

// ── Experience-page funnel (FA-1.60) ──────────────────────────────────────────
//
// One measure for both templates of /experiences/[slug]: every event says which template
// was rendered and on which page. Sent to GA4 explicitly, like SUBMIT_LEAD_FORM — without
// `send_to` the event goes only to the configured Ads tag and never reaches GA4 (which is
// why `form_start` above has never appeared there). The once-per-load guards live with the
// callers (src/components/analytics/experience-funnel.tsx); these helpers only send.

/** The template actually rendered (also on ?preview=v2) and the slug of the page. */
export interface FunnelPage {
  page_version: '1' | '2'
  page_slug:    string
}

/** Sections whose view is counted. Names are the funnel's, mapped to sections per template. */
export const FUNNEL_SECTIONS = ['pricing', 'faq', 'fit'] as const
export type FunnelSection = (typeof FUNNEL_SECTIONS)[number]

export interface FunnelStep {
  /** The step's name in the form's own code: v2 `trip` / `angler` / `contact`, v1 `calendar` / `form`. */
  step:        string
  step_index:  number
  total_steps: number
}

export function trackExperienceView(page: FunnelPage) {
  gtagEvent('experience_view', { send_to: GA4_MEASUREMENT_ID, ...page })
}

export function trackSectionView(page: FunnelPage, section: FunnelSection) {
  gtagEvent('section_view', { send_to: GA4_MEASUREMENT_ID, ...page, section })
}

export function trackFormOpen(page: FunnelPage) {
  gtagEvent('form_open', { send_to: GA4_MEASUREMENT_ID, ...page })
}

export function trackFormStep(page: FunnelPage, step: FunnelStep) {
  gtagEvent('form_step', { send_to: GA4_MEASUREMENT_ID, ...page, ...step })
}
