/**
 * S10 "What anglers said" (FA-1.55) — the first section below the sticky column, and the
 * one that has to carry trust from strangers rather than from us. Drawn as a navy band
 * across the page, with the cards on it, so it reads as a different voice from the rest.
 *
 * Every card comes from a review the angler submitted through their own link (FA-1.50); the
 * data layer has already dropped unsubmitted and unconsented rows (FA-1.59) and cut the
 * reviewer down to a first name (tj 2026-10-07, option C). The band says so, in one line —
 * a reader who is told where a review comes from trusts it more than one who is not.
 * No reviews, no section: an empty "reviews" heading is worse than none.
 *
 * The aggregate in the heading and the "See all on Google" link are the *guide's* Google
 * profile, not ours — so the two numbers are deliberately not mixed into one score.
 */

import Image from 'next/image'
import { Star } from 'lucide-react'
import type { ExperienceV2Review } from '@/lib/supabase/queries'
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
    <p className="mb-2 flex gap-0.5" aria-label={`${full} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          size={14}
          strokeWidth={0}
          fill="currentColor"
          style={{ color: i < full ? 'var(--fa-navy)' : 'rgba(10,46,77,0.18)' }}
        />
      ))}
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
    <div
      className="flex w-[280px] flex-none snap-start flex-col rounded-2xl bg-white p-5 md:w-auto"
      style={{ color: 'var(--fa-navy)', boxShadow: '0 12px 32px -12px rgba(0,0,0,0.35)' }}
    >
      {review.photoUrl != null && (
        <div className="relative -mx-5 -mt-5 mb-4 h-[150px] overflow-hidden rounded-t-2xl">
          <Image
            src={review.photoUrl}
            alt=""
            fill
            sizes="(min-width: 768px) 33vw, 280px"
            className="object-cover"
          />
        </div>
      )}
      {review.rating != null && <Stars rating={review.rating} />}
      {review.comment != null && (
        <p className="mb-3 text-[15px] leading-relaxed">“{review.comment}”</p>
      )}
      <p className="mt-auto text-[13px] font-medium" style={{ color: 'rgba(10,46,77,0.62)' }}>
        {[who, month].filter(part => part !== '').join(' · ')}
      </p>
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
      className="-mx-4 mt-14 scroll-mt-24 px-5 py-8 sm:mx-0 sm:rounded-3xl sm:px-8 sm:py-10 md:px-12 md:py-12"
      style={{ background: 'var(--fa-navy)', color: '#fff' }}
    >
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            From anglers
          </p>
          <h2 className="f-display text-[28px] font-bold leading-[1.1] tracking-[-0.01em] sm:text-[34px]">{title}</h2>
          {googleRating != null && (
            <p className="mt-2 text-[15px]" style={{ color: 'rgba(255,255,255,0.75)' }}>What anglers said</p>
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
            style={{ color: 'rgba(255,255,255,0.62)', borderColor: 'rgba(255,255,255,0.14)' }}
            data-testid="reviews-source"
          >
            Written by anglers who booked this trip through FjordAnglers, from a review link we
            send after the trip. Published only with their consent, first name and country only.
            {googleRating != null && ' The Google rating is the guide’s own profile.'}
          </p>
        </div>

        {/* Mobile keeps the wireframe's carousel — one card at a time, swiped. Desktop lays
            the same cards out as a grid of two. */}
        <div
          className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0"
          data-testid="offer-reviews"
        >
          {reviews.map(review => <ReviewCard key={review.id} review={review} />)}
        </div>
      </div>
    </section>
  )
}
