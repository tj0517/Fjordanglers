'use client'

/**
 * One testimonial card of S10 "What anglers said".
 *
 * The photo is whatever the angler uploaded with their review (FA-1.50) — as often a landscape
 * shot of the river as a portrait one of a fish held up — and we never get to pick it. So the
 * card asks the photo instead of guessing: the browser reports its natural size on load, and a
 * photo taller than it is wide gets the **vertical** showcase (the photo down the left edge,
 * the words beside it) rather than the **horizontal** strip across the top. A portrait photo
 * cropped into a 150px band shows a chest and a pair of hands.
 *
 * Until the photo loads — and if it never loads — the card stays horizontal: that is the safe
 * shape for a photo whose proportions nobody knows yet, and the one the server renders.
 * A square photo counts as horizontal.
 */

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Star } from 'lucide-react'
import type { ExperienceV2Review } from '@/lib/supabase/queries'
import { anglerCountryName } from '@/lib/angler-countries'

type Orientation = 'horizontal' | 'vertical'

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

export default function OfferReviewCard({ review }: { review: ExperienceV2Review }) {
  const [orientation, setOrientation] = useState<Orientation>('horizontal')
  const vertical = orientation === 'vertical'

  // `next/image` calls `onLoad` with an event of its own making, after it has decoded the
  // photo — there is no `currentTarget` on it — so the size is read off the element itself.
  // Next fires it for a photo that was already in the cache too, which is the common case.
  const photoRef = useRef<HTMLImageElement | null>(null)

  function measurePhoto() {
    const photo = photoRef.current
    if (photo == null) return
    const { naturalWidth, naturalHeight } = photo
    // 0 × 0 is a photo the browser could not decode — leave the card as it is.
    if (naturalWidth > 0 && naturalHeight > naturalWidth) setOrientation('vertical')
  }

  const who = [
    review.firstName,
    anglerCountryName(review.country),
  ].filter((part): part is string => part != null && part !== '').join(', ')

  const month = monthOf(review.submittedAt)

  return (
    <div
      data-testid="review-card"
      data-orientation={orientation}
      className={`flex w-[280px] flex-none snap-start rounded-2xl bg-white p-5 md:w-auto ${
        vertical ? 'min-h-[220px] flex-row items-stretch gap-4' : 'flex-col'
      }`}
      style={{ color: 'var(--fa-navy)', boxShadow: '0 12px 32px -12px rgba(0,0,0,0.35)' }}
    >
      {review.photoUrl != null && (
        <div
          className={vertical
            ? 'relative -my-5 -ml-5 w-[42%] max-w-[170px] flex-none overflow-hidden rounded-l-2xl'
            : 'relative -mx-5 -mt-5 mb-4 h-[150px] overflow-hidden rounded-t-2xl'}
        >
          <Image
            ref={photoRef}
            src={review.photoUrl}
            alt=""
            fill
            sizes={vertical ? '170px' : '(min-width: 768px) 33vw, 280px'}
            className="object-cover"
            onLoad={measurePhoto}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {review.rating != null && <Stars rating={review.rating} />}
        {review.comment != null && (
          <p className="mb-3 text-[15px] leading-relaxed">“{review.comment}”</p>
        )}
        <p className="mt-auto text-[13px] font-medium" style={{ color: 'rgba(10,46,77,0.62)' }}>
          {[who, month].filter(part => part !== '').join(' · ')}
        </p>
      </div>
    </div>
  )
}
