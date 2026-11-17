/**
 * S10 "What anglers said" (FA-1.55) — the first section below the sticky column, and the
 * one that has to carry trust from strangers rather than from us. Drawn as the 2026-11 mockup's
 * grain band, with the cards on it, so it reads as a different voice from the rest.
 *
 * Every card comes from a review the angler submitted through their own link (FA-1.50); the
 * data layer has already dropped unsubmitted and unconsented rows (FA-1.59) and cut the
 * reviewer down to a first name (tj 2026-10-07, option C). The band says so, in one line —
 * a reader who is told where a review comes from trusts it more than one who is not.
 * No reviews, no section: an empty "reviews" heading is worse than none.
 *
 * The aggregate in the heading and the "See all on Google" link are the *guide's* Google
 * profile, not ours — so the two numbers are deliberately not mixed into one score.
 *
 * One card is `./offer-review-card.tsx`; it picks its own photo layout (horizontal strip or
 * vertical showcase) from the photo's proportions, which is why it is a client component.
 */

import type { ExperienceV2Review } from '@/lib/supabase/queries'
import OfferReviewCard from './offer-review-card'
import { Eyebrow, ON_DARK } from '@/components/site/ui'
import grain from '@/components/site/grain.module.css'

export type OfferReviewsProps = {
  reviews: ExperienceV2Review[]
  /** The primary guide's Google aggregate, when their profile carries one. */
  googleRating:      number | null
  googleReviewCount: number | null
  /** Already checked `http(s)` by the data layer, or null. */
  googleProfileUrl:  string | null
}

/**
 * The cards on the navy band, without the band's heading. Mobile keeps the wireframe's
 * carousel — one card at a time, swiped. Desktop lays the same cards out as a grid of two.
 */
function ReviewCardList({ reviews }: { reviews: ExperienceV2Review[] }) {
  return (
    <div
      className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0"
      data-testid="offer-reviews"
    >
      {reviews.map(review => <OfferReviewCard key={review.id} review={review} />)}
    </div>
  )
}

export default function OfferReviews({
  reviews,
  googleRating,
  googleReviewCount,
  googleProfileUrl,
}: OfferReviewsProps) {
  // The empty-field guard: nothing collected for this page, no section.
  if (reviews.length === 0) return null

  const title = googleRating != null
    ? `★ ${googleRating.toFixed(1)}${googleReviewCount != null ? ` · ${googleReviewCount} reviews on Google` : ''}`
    : 'What anglers said'

  return (
    <section
      id="recenzje"
      data-section="S10"
      className={`${grain.blur} ${grain.nz} mt-14 scroll-mt-24 rounded-3xl text-white`}
      style={{ padding: 'clamp(24px, 4vw, 48px)' }}
    >
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
        <div>
          <div className="mb-2.5"><Eyebrow dark>Reviews</Eyebrow></div>
          <h2 className="f-display text-[30px] font-bold leading-[1.12] tracking-[-0.01em] sm:text-[36px]">{title}</h2>
          {googleRating != null && (
            <p className="mt-2 text-[15px]" style={{ color: ON_DARK }}>What anglers said</p>
          )}
          {googleProfileUrl != null && (
            <p className="mt-3 text-[15px]">
              <a
                href={googleProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-4"
                style={{ textDecorationColor: 'rgba(255,255,255,0.4)' }}
              >
                See all on Google ›
              </a>
            </p>
          )}

          <p
            className="mt-6 border-t pt-5 text-[13px] leading-relaxed"
            style={{ color: ON_DARK, borderColor: 'rgba(255,255,255,0.22)' }}
            data-testid="reviews-source"
          >
            Written by anglers who booked this trip through FjordAnglers, from a review link we
            send after the trip. Published only with their consent, first name and country only.
            {googleRating != null && ' The Google rating is the guide’s own profile.'}
          </p>
        </div>

        <ReviewCardList reviews={reviews} />
      </div>
    </section>
  )
}
