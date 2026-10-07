/**
 * S8 "How booking works" (FA-1.54) — four steps, the order the money moves in.
 *
 *   1  inquiry (free)
 *   2  availability + offer — the ETA is per offer (`offer_eta_text`, O-36)
 *   3  accept and pay the deposit — `fee_pct` of the guide's price, plus how long the offer lasts
 *   4  balance to the guide — in the way that guide collects it (`default_balance_payment_method`)
 *
 * Always rendered: it is the same four steps on every page and says nothing a page can leave
 * empty. A missing ETA only drops the clause, not the step.
 */

import OfferSection from './offer-section'

export type OfferHowItWorksProps = {
  offerEtaText: string | null
  /** `experience_pages.fee_pct`, e.g. 0.2. */
  feePct:       number
  /** The primary guide's `default_balance_payment_method`; null when no guide is shown. */
  balancePaymentMethod: 'cash' | 'stripe' | null
}

/**
 * How long an offer stays open — one global sentence, not a per-page field. The wireframe
 * (docs/brand/wireframes/Main.dc.html, S8 step 3) says 72 h; nothing in `src/` sets the
 * expiry from this, so the number is copy until the offer flow reads it from somewhere.
 */
const OFFER_VALIDITY_TEXT = 'the offer is valid for 72 h'

function percent(feePct: number): string {
  // numeric(5,4) — at most four decimals — so basis points are exact.
  const pct = Math.round(feePct * 10_000) / 100
  return `${pct}%`
}

function balanceText(method: OfferHowItWorksProps['balancePaymentMethod']): string {
  switch (method) {
    case 'stripe': return 'You pay the balance to your guide on the day of the trip, online by card.'
    case 'cash':   return 'You pay the balance to your guide on the day of the trip, in cash.'
    default:       return 'You pay the balance directly to your guide on the day of the trip.'
  }
}

export default function OfferHowItWorks({ offerEtaText, feePct, balancePaymentMethod }: OfferHowItWorksProps) {
  const steps: { title: string; body: string; highlight?: boolean }[] = [
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
    { title: 'You pay the balance to the guide', body: balanceText(balancePaymentMethod) },
  ]

  return (
    <OfferSection section="S8" anchor="jak-dziala" title="How booking works" accordion={{ defaultOpen: false }}>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, i) => (
          <li
            key={step.title}
            data-step={i + 1}
            className="rounded-xl border p-3.5"
            style={{
              borderColor: step.highlight ? 'var(--fa-navy)' : 'rgba(10,46,77,0.16)',
              background:  step.highlight ? 'rgba(10,46,77,0.05)' : '#fff',
            }}
          >
            <b className="mb-1 block text-lg">{i + 1}</b>
            <p className="text-[15px] font-semibold">{step.title}</p>
            <p className="mt-1 text-sm" style={{ color: 'rgba(10,46,77,0.7)' }}>{step.body}</p>
          </li>
        ))}
      </ol>
    </OfferSection>
  )
}
