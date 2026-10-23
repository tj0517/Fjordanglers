/**
 * The country hub (FA-1.65) — what `/[destination]` renders, from one `getDestinationHub()`
 * result and nothing else, so the same view renders a fixture in the tests.
 *
 * Order (task FA-1.65, "Goal"): hero → season → species → trips → FAQ → reviews →
 * how it works → more destinations → contact. A section with no data is not rendered at all —
 * no empty heading. The six sections FA-1.66 measures carry `data-section`; the three that
 * every hub has carry `data-block`, so the anchors stay exactly the six it expects.
 *
 * There is no inquiry form here on purpose: the hub leads to an offer page, and the offer
 * page asks.
 */

import Link from 'next/link'
import OfferSection from '@/components/experience-v2/offer-section'
import SeasonBar from '@/components/experience-v2/offer-season-bar'
import { FaqList } from '@/components/experience-v2/offer-faq'
import { ReviewCardList } from '@/components/experience-v2/offer-reviews'
import { StepCards, type Step } from '@/components/experience-v2/offer-how-it-works'
import HubTrips from './hub-trips'
import type { DestinationHubData } from '@/lib/supabase/queries'

const HOW_IT_WORKS: Step[] = [
  { title: 'Tell us your dates.', body: 'Dates, group size, what you want to catch.' },
  { title: 'We check with the guide.', body: 'We come back with availability and a price within two business days.' },
  { title: 'Deposit once dates are confirmed.', body: 'You pay nothing to ask.' },
]

/** "3 guides · from NZ$1,320 · 1–2 anglers per guide · gear included" — each part only when known. */
function proofLine(data: Pick<DestinationHubData, 'guideCount' | 'priceFrom' | 'hub'>): string {
  const guides = data.guideCount > 0 ? `${data.guideCount} ${data.guideCount === 1 ? 'guide' : 'guides'}` : null
  const note   = data.hub.proofNote?.trim() ?? ''
  return [guides, data.priceFrom?.text ?? null, note === '' ? null : note]
    .filter((part): part is string => part != null)
    .join(' · ')
}

function Hero({ data }: { data: DestinationHubData }) {
  const { hub } = data
  const proof = proofLine(data)

  return (
    <header data-block="hero" className="pt-8 pb-2 md:pt-12">
      <div className="flex items-center gap-3 mb-4 md:mb-5">
        <div className="w-6 h-px" style={{ background: '#E67E50' }} />
        <p className="text-xs font-semibold uppercase tracking-[0.25em] f-body" style={{ color: '#E67E50' }}>
          FjordAnglers
        </p>
      </div>
      <h1
        className="f-display font-bold mb-4 md:mb-6"
        style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.06, color: '#0A2E4D' }}
      >
        {hub.h1}
      </h1>
      <p
        className="f-body leading-relaxed"
        style={{ fontSize: '17px', color: 'rgba(10,46,77,0.72)', maxWidth: '640px' }}
      >
        {hub.intro}
      </p>
      {proof !== '' && (
        <p
          className="mt-5 inline-flex rounded-full px-4 py-2 text-[14px] font-semibold f-body"
          style={{ background: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }}
          data-testid="hub-proof-line"
        >
          {proof}
        </p>
      )}
      {hub.heroQuote != null && (
        <figure className="mt-6 max-w-[640px] border-l-2 pl-4" style={{ borderColor: 'rgba(10,46,77,0.2)' }} data-testid="hub-quote">
          <blockquote className="f-display text-[18px] leading-snug md:text-[20px]" style={{ color: '#0A2E4D' }}>
            “{hub.heroQuote.text}”
          </blockquote>
          <figcaption className="mt-2 text-[13px] f-body" style={{ color: 'rgba(10,46,77,0.62)' }}>
            {hub.heroQuote.author}, {hub.heroQuote.country}
          </figcaption>
        </figure>
      )}
    </header>
  )
}

function Season({ data }: { data: DestinationHubData }) {
  const seasonMonths = data.hub.seasonMonths ?? []
  const peakMonths   = data.hub.peakMonths ?? []
  if (seasonMonths.length === 0 && peakMonths.length === 0) return null

  return (
    <OfferSection section="season" anchor="season" eyebrow="Season" title="When to go">
      {/* Below `sm` the bar keeps readable cells and scrolls sideways instead of the page.
          `relative` keeps the bar's absolutely positioned sr-only month names inside the
          scroller; without it they widen the document past the viewport. */}
      <div className="relative -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" data-testid="hub-season-scroll">
        <div className="min-w-[560px] max-w-[720px] sm:min-w-0">
          <SeasonBar seasonMonths={seasonMonths} peakMonths={peakMonths} periods={[]} />
        </div>
      </div>
      {data.hub.seasonNote != null && data.hub.seasonNote.trim() !== '' && (
        <p className="mt-4 max-w-[640px] text-[15px] leading-relaxed f-body" style={{ color: 'rgba(10,46,77,0.78)' }}>
          {data.hub.seasonNote}
        </p>
      )}
    </OfferSection>
  )
}

function Faq({ data }: { data: DestinationHubData }) {
  const faq = data.hub.faq ?? []
  if (faq.length === 0) return null

  return (
    <OfferSection section="faq" anchor="faq" eyebrow="Good to know" title="Questions anglers ask">
      <div className="max-w-[760px]"><FaqList faq={faq} /></div>
    </OfferSection>
  )
}

function Reviews({ data }: { data: DestinationHubData }) {
  if (data.reviews.length === 0) return null

  return (
    <section
      id="reviews"
      data-section="reviews"
      className="-mx-4 mt-14 scroll-mt-24 px-5 py-8 sm:mx-0 sm:rounded-3xl sm:px-8 sm:py-10 md:px-12 md:py-12"
      style={{ background: 'var(--fa-navy)', color: '#fff' }}
    >
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            From anglers
          </p>
          <h2 className="f-display text-[28px] font-bold leading-[1.1] tracking-[-0.01em] sm:text-[34px]">What anglers said</h2>
          <p
            className="mt-6 border-t pt-5 text-[13px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.62)', borderColor: 'rgba(255,255,255,0.14)' }}
          >
            Written by anglers who booked through FjordAnglers, from a review link we send after
            the trip. Published only with their consent, first name and country only.
          </p>
        </div>
        <ReviewCardList reviews={data.reviews} />
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section data-block="how-it-works" className="mt-14 border-t pt-10 sm:pt-12" style={{ borderColor: 'rgba(10,46,77,0.08)' }}>
      <h2 className="f-display text-[26px] font-bold leading-[1.1] tracking-[-0.01em] sm:text-[32px] mb-6">How it works</h2>
      <StepCards steps={HOW_IT_WORKS} className="md:grid-cols-3" />
    </section>
  )
}

function MoreDestinations({ data }: { data: DestinationHubData }) {
  if (data.otherHubs.length === 0) return null

  return (
    <section data-block="destinations" className="mt-14 border-t pt-10 sm:pt-12" style={{ borderColor: 'rgba(10,46,77,0.08)' }}>
      <h2 className="f-display text-[26px] font-bold leading-[1.1] tracking-[-0.01em] sm:text-[32px] mb-6">More destinations</h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.otherHubs.map(other => (
          <li key={other.slug}>
            <Link
              href={`/${other.slug}`}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 text-[15px] font-semibold f-body transition-transform hover:-translate-y-0.5"
              style={{ color: '#0A2E4D', boxShadow: '0 1px 2px rgba(10,46,77,0.06), 0 12px 32px -12px rgba(10,46,77,0.14)' }}
            >
              {other.h1}
              <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Contact({ data }: { data: DestinationHubData }) {
  const contact = data.hub.contact
  if (contact == null) return null

  const whatsapp = contact.whatsapp.replace(/\D/g, '')

  return (
    <OfferSection section="contact" anchor="contact" eyebrow="Contact" title={`Questions? Ask ${contact.name}`}>
      <div className="flex flex-wrap gap-3">
        <a
          href={`mailto:${contact.email}`}
          className="inline-flex items-center rounded-full px-5 text-[15px] font-semibold f-body"
          style={{ minHeight: 44, background: '#0A2E4D', color: '#fff' }}
        >
          {contact.email}
        </a>
        {whatsapp !== '' && (
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full px-5 text-[15px] font-semibold f-body"
            style={{ minHeight: 44, background: '#fff', color: '#0A2E4D', boxShadow: 'inset 0 0 0 1px rgba(10,46,77,0.16)' }}
          >
            WhatsApp
          </a>
        )}
      </div>
    </OfferSection>
  )
}

export default function DestinationHubView({ data }: { data: DestinationHubData }) {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 pb-20">
      <Hero data={data} />
      <Season data={data} />
      <HubTrips offers={data.offers} species={data.species} />
      <Faq data={data} />
      <Reviews data={data} />
      <HowItWorks />
      <MoreDestinations data={data} />
      <Contact data={data} />
    </div>
  )
}
