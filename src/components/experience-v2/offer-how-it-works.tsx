/**
 * S8 "How booking works" (FA-1.54) — four steps, the order the money moves in.
 *
 *   1  inquiry (free)
 *   2  availability + offer — the ETA is per offer (`offer_eta_text`, O-36)
 *   3  accept and pay the deposit — `fee_pct` of the guide's price, plus how long the offer lasts
 *   4  remaining balance — paid directly to the guide. One sentence for every
 *      `default_balance_payment_method` (cash / stripe / none): tj, Figma review 2026-10-20
 *
 * Always rendered: it is the same four steps on every page and says nothing a page can leave
 * empty. A missing ETA only drops the clause, not the step.
 */

import OfferSection from './offer-section'
import { cardShadow } from './offer-box'

export type OfferHowItWorksProps = {
  offerEtaText: string | null
  /** `experience_pages.fee_pct`, e.g. 0.2. */
  feePct:       number
}

/**
 * How long an offer stays open — one global sentence, not a per-page field. The wireframe
 * (docs/brand/wireframes/Main.dc.html, S8 step 3) says 72 h; nothing in `src/` sets the
 * expiry from this, so the number is copy until the offer flow reads it from somewhere.
 */
const OFFER_VALIDITY_TEXT = 'the offer is valid for 72 h'

/** Step 4 — the same for a cash guide, a card guide and no guide (tj, 2026-10-20). */
const BALANCE_TEXT = 'The balance is paid directly to your guide.'

function percent(feePct: number): string {
  // numeric(5,4) — at most four decimals — so basis points are exact.
  const pct = Math.round(feePct * 10_000) / 100
  return `${pct}%`
}

export default function OfferHowItWorks({ offerEtaText, feePct }: OfferHowItWorksProps) {
  const steps: Step[] = [
    { title: 'You send an inquiry', body: 'Two minutes, free, no obligation.' },
    {
      title: 'We send you an offer',
      body: `We check availability with the guide and send you an offer${offerEtaText != null ? ` — ${offerEtaText}` : ''}.`,
    },
    {
      title: 'You accept and pay the deposit',
      body: `The deposit is ${percent(feePct)} of the guide's price, paid online by card (Stripe) — ${OFFER_VALIDITY_TEXT}.`,
      highlight: true,
    },
    { title: 'Remaining balance', body: BALANCE_TEXT },
  ]

  return (
    <OfferSection section="S8" anchor="jak-dziala" eyebrow="Booking" title="How booking works" accordion={{ defaultOpen: false }}>
      <StepCards steps={steps} className="sm:grid-cols-2 xl:grid-cols-4" />
    </OfferSection>
  )
}

export type Step = { title: string; body: string; highlight?: boolean }

/** The numbered step cards, without the section frame — the country hub uses it too (FA-1.65). */
export function StepCards({ steps, className = '' }: { steps: Step[]; className?: string }) {
  return (
    <ol className={`grid grid-cols-1 gap-3 ${className}`}>
      {steps.map((step, i) => (
        <li
          key={step.title}
          data-step={i + 1}
          className="rounded-2xl p-5"
          style={step.highlight
            ? { background: 'var(--fa-navy)', color: '#fff' }
            : { background: '#fff', boxShadow: cardShadow }}
        >
          <b
            className="f-display block text-[32px] font-bold leading-none"
            style={{ color: step.highlight ? 'rgba(255,255,255,0.45)' : 'rgba(10,46,77,0.28)' }}
          >
            {String(i + 1).padStart(2, '0')}
          </b>
          <p className="mt-3 text-[15px] font-semibold leading-snug">{step.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: step.highlight ? 'rgba(255,255,255,0.78)' : 'rgba(10,46,77,0.7)' }}>
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  )
}
