/**
 * S10 "What anglers said" (FA-1.55) — the first section below the sticky column, and the
 * one that has to carry trust from strangers rather than from us.
 *
 * Every card comes from a review the angler submitted through their own link (FA-1.50); the
 * data layer has already dropped unsubmitted and empty rows and cut the reviewer down to a
 * first name (tj 2026-10-07, option C — the review form records no consent to publish more).
 * No reviews, no section: an empty "reviews" heading is worse than none.
 *
 * The aggregate in the heading and the "See all on Google" link are the *guide's* Google
 * profile, not ours — so the two numbers are deliberately not mixed into one score.
 */

import Image from 'next/image'
import type { ExperienceV2Review } from '@/lib/supabase/queries'
import OfferSection from './offer-section'
import { Box, mutedStyle } from './offer-box'
import { anglerCountryName } from '@/lib/angler-countries'

export type OfferReviewsProps = {
  reviews: ExperienceV2Review[]
  /** The primary guide's Google aggregate, when their profile carries one. */
  googleRating:      number | null
  googleReviewCount: number | null
  /** Already checked `http(s)` by the data layer, or null. */
  googleProfileUrl:  string | null
}

/** "March 2026" — the month is as precise as a review needs to be. */
function monthOf(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function Stars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <p className="mb-1.5 text-[15px]" aria-label={`${full} out of 5`}>
      <span aria-hidden>{'★'.repeat(full)}{'☆'.repeat(5 - full)}</span>
    </p>
  )
}

function ReviewCard({ review }: { review: ExperienceV2Review }) {
  const who = [
    review.firstName,
    anglerCountryName(review.country),
  ].filter((part): part is string => part != null && part !== '').join(', ')

  const month = monthOf(review.submittedAt)

  return (
    <Box className="flex w-[280px] flex-none snap-start flex-col sm:w-auto">
      {review.photoUrl != null && (
        <div className="relative mb-3 h-[150px] w-full overflow-hidden rounded-lg">
          <Image
            src={review.photoUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 33vw, 280px"
            className="object-cover"
          />
        </div>
      )}
      {review.rating != null && <Stars rating={review.rating} />}
      {review.comment != null && (
        <p className="mb-2 text-[15px]">“{review.comment}”</p>
      )}
      <p className="mt-auto text-[13px]" style={mutedStyle}>
        {[who, month].filter(part => part !== '').join(' · ')}
      </p>
    </Box>
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
    <OfferSection section="S10" anchor="recenzje" eyebrow="From anglers" title={title}>
      {googleProfileUrl != null && (
        <p className="-mt-2 mb-4 text-[15px]">
          <a
            href={googleProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline"
          >
            See all on Google ›
          </a>
        </p>
      )}

      {/* Mobile keeps the wireframe's carousel — one card at a time, swiped. Desktop lays
          the same cards out as a grid of three. */}
      <div
        className="flex snap-x gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0"
        data-testid="offer-reviews"
      >
        {reviews.map(review => <ReviewCard key={review.id} review={review} />)}
      </div>
    </OfferSection>
  )
}
