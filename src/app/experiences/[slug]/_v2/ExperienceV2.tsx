/**
 * /experiences/[slug] — template v2 (offer-centric), sections S0–S2 (FA-1.53).
 *
 * The first screen has one job: price, group size, season, level and the three things
 * that make an inquiry cheap to send, before anyone scrolls. Everything it needs comes
 * from one data-layer call (`getExperienceV2`) — no component here touches Supabase
 * (CLAUDE.md rule 3), and the guide's price override is folded into the price rows
 * server-side, so it never reaches the browser.
 *
 * S3–S9 are FA-1.54; S10–S14 and the inquiry form are FA-1.55. The anchors those tasks
 * fill are already here, and already wired to the top bar, the CTA and the sticky column,
 * so the plumbing is proven before the content lands.
 */

import { notFound } from 'next/navigation'
import { env } from '@/lib/env'
import { getExperienceV2 } from '@/lib/supabase/queries'
import { fetchIndicativeRates } from '@/lib/fx'
import { CurrencyProvider } from '@/components/experience-v2/currency-context'
import OfferTopBar from '@/components/experience-v2/offer-top-bar'
import OfferGallery from '@/components/experience-v2/offer-gallery'
import OfferChips from '@/components/experience-v2/offer-chips'
import OfferWidget, { type OfferWidgetProps } from '@/components/experience-v2/offer-widget'
import OfferMobileBar from '@/components/experience-v2/offer-mobile-bar'

/** The inquiry form of FA-1.55. Named in that task, so the anchor is stable from here. */
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
      <OfferTopBar whatsappUrl={whatsappUrl} />

      <main style={{ background: 'var(--fa-white)', color: 'var(--fa-navy)' }} className="pb-24 sm:pb-10">
        <div className="mx-auto max-w-[1200px] sm:px-8">
          {/* ── S1 gallery ── */}
          <nav aria-label="Breadcrumb" className="hidden px-4 pt-5 text-xs sm:block sm:px-0" style={{ color: 'rgba(10,46,77,0.6)' }}>
            {page.country} › {page.region} › {page.experienceName}
          </nav>
          <div className="sm:mt-4">
            <OfferGallery heroUrl={page.heroImageUrl} galleryUrls={page.galleryImageUrls} alt={page.experienceName} />
          </div>

          {/* ── two columns: the page on the left, the widget sticky on the right.
                 The flex container ends right before #recenzje, which is exactly how far
                 the sticky card is meant to travel. ── */}
          <div className="flex items-start gap-10 px-4 sm:px-0">
            <div className="min-w-0 flex-1">
              <h1 className="f-display mt-6 text-3xl font-bold leading-[1.15] sm:text-[40px]">
                {page.experienceName}
              </h1>

              {page.introText != null && (
                <p className="mt-3 text-base sm:text-lg" style={{ color: 'rgba(10,46,77,0.7)' }}>
                  {page.introText}
                </p>
              )}

              {primary?.googleRating != null && (
                <p className="mt-3 text-sm" data-testid="offer-rating">
                  ★ {primary.googleRating.toFixed(1)}
                  {primary.googleReviewCount != null && ` · ${primary.googleReviewCount} reviews`}
                  {primary.googleProfileUrl != null && (
                    <>
                      {' · '}
                      <a
                        href={primary.googleProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        see them on Google
                      </a>
                    </>
                  )}
                </p>
              )}

              <div className="mt-4">
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

              {/* The three lines that make sending an inquiry cost nothing. */}
              <ul
                className="mt-5 flex flex-col gap-1.5 border-y py-3.5 text-sm sm:flex-row sm:gap-6"
                style={{ borderColor: 'rgba(10,46,77,0.14)' }}
                data-testid="offer-assurances"
              >
                <li>✓ Inquiry is free and non-binding</li>
                <li>✓ Deposit only after you accept the offer</li>
                <li>✓ We answer within {page.responseSlaHours} h</li>
              </ul>

              {/* Mobile: the price sits directly under the assurances, as in the wireframe —
                  the bottom bar only takes over once the hero is scrolled past. */}
              <div className="mt-6 sm:hidden">
                <OfferWidget {...widget} />
              </div>

              {/* ── S3–S9 → FA-1.54. The anchors the top bar already points at. ── */}
              <section id="jak-dziala" className="mt-10 scroll-mt-20">
                <Placeholder label="S3–S8 · how it works, what is included, the day — FA-1.54" />
              </section>
              <section id="cena" className="mt-4 scroll-mt-20">
                <Placeholder label="S9 · price and deposit, in full — FA-1.54" />
              </section>
            </div>

            <aside className="hidden w-[360px] flex-none sm:block" style={{ position: 'sticky', top: 88 }}>
              <OfferWidget {...widget} />
            </aside>
          </div>

          {/* ── S10–S14 → FA-1.55. #recenzje also ends the sticky column above. ── */}
          <div className="px-4 sm:px-0">
            <section id="recenzje" className="mt-8 scroll-mt-20">
              <Placeholder label="S10 · reviews — FA-1.55" />
            </section>
            <section id="faq" className="mt-4 scroll-mt-20">
              <Placeholder label="S11–S13 · map, what to bring, FAQ — FA-1.55" />
            </section>
            <section id="zapytanie" className="mt-4 scroll-mt-20">
              <Placeholder label="S14 · inquiry, step 1 of 3 — FA-1.55" />
            </section>
          </div>
        </div>
      </main>

      <OfferMobileBar>
        <OfferWidget {...widget} compact />
      </OfferMobileBar>
    </CurrencyProvider>
  )
}

/** A section this task deliberately does not build, named so a screenshot is readable. */
function Placeholder({ label }: { label: string }) {
  return (
    <div
      className="rounded-xl border border-dashed px-4 py-6 text-center text-xs"
      style={{ borderColor: 'rgba(10,46,77,0.25)', color: 'rgba(10,46,77,0.5)' }}
    >
      {label}
    </div>
  )
}
