/**
 * /experiences/[slug] — template v2 (offer-centric), sections S0–S2 (FA-1.53).
 *
 * The first screen has one job: price, group size, season, level and the three things
 * that make an inquiry cheap to send, before anyone scrolls. Everything it needs comes
 * from one data-layer call (`getExperienceV2`) — no component here touches Supabase
 * (CLAUDE.md rule 3), and the guide's price override is folded into the price rows
 * server-side, so it never reaches the browser.
 *
 * S3–S9 are `OfferBody` (FA-1.54); S10–S14 and the three-step inquiry form are FA-1.55. The
 * whole tree sits inside `InquiryWizardProvider`, so every CTA on the page — the hero, the
 * sticky widget, the mobile bar — opens the one form, with the one set of answers.
 */

import { notFound } from 'next/navigation'
import { Clock, Lock, ShieldCheck, Star } from 'lucide-react'
import { env } from '@/lib/env'
import { getExperienceV2 } from '@/lib/supabase/queries'
import { fetchIndicativeRates } from '@/lib/fx'
import { CurrencyProvider } from '@/components/experience-v2/currency-context'
import OfferTopBar from '@/components/experience-v2/offer-top-bar'
import OfferGallery from '@/components/experience-v2/offer-gallery'
import OfferChips from '@/components/experience-v2/offer-chips'
import OfferPriceLead from '@/components/experience-v2/offer-price-lead'
import OfferWidget, { type OfferWidgetProps } from '@/components/experience-v2/offer-widget'
import OfferMobileBar from '@/components/experience-v2/offer-mobile-bar'
import OfferBody from '@/components/experience-v2/offer-body'
import OfferReviews from '@/components/experience-v2/offer-reviews'
import OfferLogistics from '@/components/experience-v2/offer-logistics'
import OfferBring from '@/components/experience-v2/offer-bring'
import OfferFaq from '@/components/experience-v2/offer-faq'
import OfferInquiry from '@/components/experience-v2/offer-inquiry'
import { InquiryWizardProvider, type InquiryWizardPage } from '@/components/inquiry-wizard/inquiry-wizard'
import { fromPrice } from '@/lib/pricing/experience-price'

/** The inquiry section of S14. The CTAs keep the href even though they also open the wizard. */
const INQUIRY_ANCHOR = '#zapytanie'

/**
 * Metadata for a v2 page: the page's own `meta_title` / `meta_description`, falling back
 * to its name. `absolute` when the stored title already carries the site suffix, so it is
 * not appended twice by the root layout's `title.template` (FA-0.12 — same guard as v1).
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await getExperienceV2(slug)
  if (page == null) return {}

  const title = page.metaTitle ?? page.experienceName

  return {
    title: title.endsWith('| FjordAnglers') ? { absolute: title } : title,
    description: page.metaDescription
      ?? `Guided fishing in ${page.region}, ${page.country}. Free inquiry, answer within ${page.responseSlaHours} h, deposit only after you accept the offer.`,
    alternates: { canonical: `https://fjordanglers.com/experiences/${slug}` },
    openGraph: {
      title,
      description: page.metaDescription ?? undefined,
      images: page.heroImageUrl != null ? [{ url: page.heroImageUrl }] : undefined,
    },
  }
}

export default async function ExperienceV2({ slug }: { slug: string }) {
  const page = await getExperienceV2(slug)
  if (page == null) notFound()

  // Display only, never stored, never charged (CLAUDE.md rule 6). A provider that fails
  // returns nothing usable and the "≈" line simply does not appear.
  const rates = await fetchIndicativeRates(page.currency)

  const primary = page.guides.find(g => g.isPrimary) ?? page.guides[0] ?? null

  const whatsappUrl = `https://wa.me/${env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi, I am looking at ${page.experienceName}. Dates: ___ Anglers: ___`,
  )}`

  // What the form needs to know about the page it is on. `fromTotalCents` is the same number
  // the widget prints as "from …" (FA fee included), so the budget checkbox confirms the price
  // the angler actually saw, not a different one.
  const wizardPage: InquiryWizardPage = {
    experiencePageId: page.id,
    experienceName:   page.experienceName,
    responseSlaHours: page.responseSlaHours,
    licenseUrl:       page.license?.buyUrl ?? null,
    offerMode:        page.offerMode,
    currency:         page.currency,
    fromTotalCents:   page.offerMode === 'fixed'
      ? fromPrice({ prices: page.prices, feePct: page.feePct, maxAnglersPerGuide: page.maxAnglersPerGuide })?.totalCents ?? null
      : null,
    priceFromCents:     page.priceFromCents,
    priceToCents:       page.priceToCents,
    minDays:            page.minDays,
    maxDays:            page.maxDays,
    maxAnglersPerGuide: page.maxAnglersPerGuide,
  }

  const widget: OfferWidgetProps = {
    offerMode:          page.offerMode,
    prices:             page.prices,
    feePct:             page.feePct,
    currency:           page.currency,
    maxAnglersPerGuide: page.maxAnglersPerGuide,
    minDays:            page.minDays,
    maxDays:            page.maxDays,
    priceFromCents:     page.priceFromCents,
    priceToCents:       page.priceToCents,
    responseSlaHours:   page.responseSlaHours,
    inquiryHref:        INQUIRY_ANCHOR,
    guide: primary != null
      ? {
          fullName:          primary.fullName,
          avatarUrl:         primary.avatarUrl,
          googleRating:      primary.googleRating,
          googleReviewCount: primary.googleReviewCount,
        }
      : null,
  }

  return (
    <CurrencyProvider baseCurrency={page.currency} rates={rates}>
     <InquiryWizardProvider page={wizardPage}>
      <OfferTopBar whatsappUrl={whatsappUrl} />

      <main style={{ background: 'var(--fa-white)', color: 'var(--fa-navy)' }} className="pb-24 sm:pb-10">
        <div className="mx-auto max-w-[1200px] sm:px-8">
          {/* ── S1 gallery ── */}
          <nav aria-label="Breadcrumb" className="hidden px-4 pt-3 text-xs sm:block sm:px-0" style={{ color: 'rgba(10,46,77,0.6)' }}>
            {page.country} › {page.region} › {page.experienceName}
          </nav>
          <div className="sm:mt-2.5">
            <OfferGallery heroUrl={page.heroImageUrl} galleryUrls={page.galleryImageUrls} alt={page.experienceName} />
          </div>

          {/* ── two columns: the page on the left, the widget sticky on the right.
                 The flex container ends right before #recenzje, which is exactly how far
                 the sticky card is meant to travel. ── */}
          <div className="flex items-start gap-12 px-4 sm:px-0">
            <div className="min-w-0 flex-1">
              <div className="anim-1">
                <h1 className="f-display mt-6 text-[32px] font-bold leading-[1.08] tracking-[-0.015em] sm:mt-8 sm:text-[44px]">
                  {page.experienceName}
                </h1>

                {page.introText != null && (
                  <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed sm:text-lg" style={{ color: 'rgba(10,46,77,0.7)' }}>
                    {page.introText}
                  </p>
                )}

                {primary?.googleRating != null && (
                  <p className="mt-4 flex items-center gap-1.5 text-sm" data-testid="offer-rating">
                    <Star aria-hidden size={15} fill="currentColor" strokeWidth={0} />
                    <b>{primary.googleRating.toFixed(1)}</b>
                    {primary.googleReviewCount != null && <span style={{ color: 'rgba(10,46,77,0.7)' }}>· {primary.googleReviewCount} reviews</span>}
                    {primary.googleProfileUrl != null && (
                      <>
                        <span style={{ color: 'rgba(10,46,77,0.7)' }}>·</span>
                        <a
                          href={primary.googleProfileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-[rgba(10,46,77,0.3)] underline-offset-4 hover:decoration-current"
                        >
                          see them on Google
                        </a>
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* Mobile keeps the wireframe's order: the price sits above the chips, and the
                  full calculator is further down. Desktop shows the same numbers in the
                  sticky card instead. */}
              <div className="mt-3 sm:hidden">
                <OfferPriceLead
                  offerMode={page.offerMode}
                  prices={page.prices}
                  feePct={page.feePct}
                  currency={page.currency}
                  maxAnglersPerGuide={page.maxAnglersPerGuide}
                  priceFromCents={page.priceFromCents}
                  priceToCents={page.priceToCents}
                />
              </div>

              <div className="anim-2 mt-5">
                <OfferChips
                  region={page.region}
                  minDays={page.minDays}
                  maxDays={page.maxDays}
                  maxAnglersPerGuide={page.maxAnglersPerGuide}
                  seasonMonths={page.seasonMonths}
                  skillLevel={page.skillLevel}
                  includes={page.includes}
                />
              </div>

              {/* Mobile: the CTA is above the fold on its own, so the first screen ends on
                  an action rather than on a form the visitor has to scroll to find. The
                  bottom bar repeats it once the hero is scrolled past. */}
              <a
                href={INQUIRY_ANCHOR}
                className="mt-5 block w-full rounded-xl px-4 py-3.5 text-center text-base font-bold sm:hidden"
                style={{ background: 'var(--fa-salmon)', color: 'var(--fa-navy)' }}
              >
                {page.offerMode === 'custom' ? 'Plan your trip' : 'Check availability'}
              </a>

              {/* The three lines that make sending an inquiry cost nothing. */}
              <ul
                className="anim-3 mt-3 grid grid-cols-1 gap-0.5 rounded-2xl p-1.5 text-sm sm:mt-6 sm:grid-cols-3 sm:gap-1 sm:p-2"
                style={{ background: 'rgba(10,46,77,0.05)' }}
                data-testid="offer-assurances"
              >
                {([
                  [ShieldCheck, 'Inquiry is free and non-binding'],
                  [Lock,        'Deposit only after you accept the offer'],
                  [Clock,       `We answer within ${page.responseSlaHours} h`],
                ] as const).map(([Icon, text]) => (
                  <li key={text} className="flex items-center gap-3 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2.5">
                    <span
                      aria-hidden
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white sm:h-8 sm:w-8"
                      style={{ boxShadow: '0 1px 2px rgba(10,46,77,0.08)' }}
                    >
                      <Icon size={15} strokeWidth={2} />
                    </span>
                    <span className="font-medium leading-snug">{text}</span>
                  </li>
                ))}
              </ul>

              {/* The full calculator, for the visitor who wants the three numbers. */}
              <div className="mt-6 sm:hidden">
                <OfferWidget {...widget} />
              </div>

              {/* ── S3–S9 (FA-1.54). S8 carries #jak-dziala and S9 #cena, the anchors the
                     top bar and the CTA already point at. ── */}
              <OfferBody page={page} />
            </div>

            <aside className="anim-2 hidden w-[360px] flex-none sm:block" style={{ position: 'sticky', top: 92 }}>
              <OfferWidget {...widget} />
            </aside>
          </div>

          {/* ── S10–S14 (FA-1.55). #recenzje also ends the sticky column above. ── */}
          <div className="px-4 sm:px-0">
            <OfferReviews
              reviews={page.reviews}
              googleRating={primary?.googleRating ?? null}
              googleReviewCount={primary?.googleReviewCount ?? null}
              googleProfileUrl={primary?.googleProfileUrl ?? null}
            />
            <OfferLogistics
              locationLat={page.locationLat}
              locationLng={page.locationLng}
              nearestAirport={page.nearestAirport}
              suggestedLodging={page.suggestedLodging}
              seasonMonths={page.seasonMonths}
              peakMonths={page.peakMonths}
              region={page.region}
            />
            <OfferBring whatToBring={page.whatToBring} />
            <OfferFaq faq={page.faq} />
            <OfferInquiry />
          </div>
        </div>
      </main>

      <OfferMobileBar>
        <OfferWidget {...widget} compact />
      </OfferMobileBar>
     </InquiryWizardProvider>
    </CurrencyProvider>
  )
}
