/**
 * One testimonial on a navy band (FA-1.69) — the home page, and the stand-in for an empty S10
 * on an offer page or an empty reviews section on a country hub. Real offer reviews always
 * win: the route only fetches a testimonial when there are none, and this band never renders
 * next to them.
 *
 * Drawn in S10's language (offer-reviews.tsx) — the same grain band as the 2026-11 mockup, the
 * heading on the left and the quote large on the right — because it is the same kind of proof. What differs is where it comes from, and the card says so:
 * a Trustpilot review links to itself, one sent to us directly says that in one sentence.
 * No testimonial, no band: an empty "what anglers said" is worse than none.
 *
 * `data-block`, not `data-section`: on the hub and offer pages `data-section` is a measured
 * anchor (FA-1.66 expects exactly six), and the banner is not one.
 *
 * The photo is shown the way the admin chose (FA-1.71, `photo_layout`): `horizontal` is the
 * strip across the top of the card, `vertical` puts it down the side with the quote beside it
 * — a portrait photo in the strip is a chest and a pair of hands. Mobile stacks either way;
 * the side-by-side starts at `sm`, as in offer-story-block.tsx.
 */

import Image from 'next/image'
import { Star } from 'lucide-react'
import { Eyebrow, SALMON_ON_DARK } from '@/components/site/ui'
import grain from '@/components/site/grain.module.css'
import type { Testimonial } from '@/lib/supabase/testimonials'
import { anglerCountryName } from '@/lib/angler-countries'

function Stars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <p className="flex gap-0.5" aria-label={`${full} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          size={14}
          strokeWidth={0}
          fill="currentColor"
          style={{ color: i < full ? SALMON_ON_DARK : 'rgba(255,255,255,0.3)' }}
        />
      ))}
    </p>
  )
}

export default function TestimonialBanner({ testimonial }: { testimonial: Testimonial | null }) {
  if (testimonial == null) return null

  const vertical = testimonial.photoUrl != null && testimonial.photoLayout === 'vertical'

  const who = [testimonial.authorName, anglerCountryName(testimonial.authorCountry)]
    .filter((part): part is string => part != null && part !== '')
    .join(', ')

  return (
    <section
      data-block="testimonial"
      className={`${grain.blur} ${grain.nz} mt-14 flex flex-wrap items-center gap-x-12 gap-y-7 rounded-3xl text-white`}
      style={{ padding: 'clamp(24px, 4vw, 48px)' }}
    >
      <div className="flex max-w-[340px] flex-[1_1_240px] flex-col gap-2.5">
        <Eyebrow dark>Reviews</Eyebrow>
        <h2 className="f-display text-[30px] font-bold leading-[1.12] tracking-[-0.01em] sm:text-[36px]">What anglers said</h2>
      </div>

      <figure
        data-photo-layout={testimonial.photoUrl != null ? testimonial.photoLayout : undefined}
        className={`m-0 flex min-w-0 flex-[999_1_420px] flex-col gap-5 ${vertical ? 'sm:flex-row sm:items-center sm:gap-7' : ''}`}
      >
        {testimonial.photoUrl != null && (
          <div
            className={vertical
              ? 'relative h-[300px] flex-none overflow-hidden rounded-2xl sm:h-[300px] sm:w-[40%] sm:max-w-[240px]'
              : 'relative h-[200px] overflow-hidden rounded-2xl sm:h-[220px]'}
          >
            <Image
              src={testimonial.photoUrl}
              alt=""
              fill
              sizes={vertical ? '(min-width: 640px) 240px, 100vw' : '(min-width: 768px) 50vw, 100vw'}
              className="object-cover"
            />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {testimonial.rating != null && <Stars rating={testimonial.rating} />}
          <blockquote className="f-display m-0 font-medium leading-[1.3]" style={{ fontSize: 'clamp(21px, 2.6vw, 28px)' }}>
            “{testimonial.quote}”
          </blockquote>
          <figcaption className="text-[15px] font-semibold" style={{ color: SALMON_ON_DARK }}>
            <p>{who}</p>
            {/* A Trustpilot row always has its link (database rule); without one it says nothing
                rather than claim the wrong source. */}
            {testimonial.source === 'trustpilot' ? testimonial.sourceUrl != null && (
              <p className="mt-1.5">
                <a
                  href={testimonial.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                  style={{ color: SALMON_ON_DARK, textDecorationColor: 'rgba(246,181,150,0.5)' }}
                >
                  Read on Trustpilot ›
                </a>
              </p>
            ) : (
              <p className="mt-1.5 text-[13.5px] font-medium text-white/80" data-testid="testimonial-direct">
                Sent to FjordAnglers directly by the angler, published with their consent.
              </p>
            )}
          </figcaption>
        </div>
      </figure>
    </section>
  )
}
