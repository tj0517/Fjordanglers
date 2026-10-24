/**
 * One testimonial on a navy band (FA-1.69) — the home page, and the stand-in for an empty S10
 * on an offer page or an empty reviews section on a country hub. Real offer reviews always
 * win: the route only fetches a testimonial when there are none, and this band never renders
 * next to them.
 *
 * Drawn in S10's language (offer-reviews.tsx) — the same band, the same white card — because
 * it is the same kind of proof. What differs is where it comes from, and the card says so:
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
import type { Testimonial } from '@/lib/supabase/testimonials'
import { anglerCountryName } from '@/lib/angler-countries'

function Stars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <p className="mb-3 flex gap-0.5" aria-label={`${full} out of 5`}>
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

export default function TestimonialBanner({ testimonial }: { testimonial: Testimonial | null }) {
  if (testimonial == null) return null

  const vertical = testimonial.photoUrl != null && testimonial.photoLayout === 'vertical'

  const who = [testimonial.authorName, anglerCountryName(testimonial.authorCountry)]
    .filter((part): part is string => part != null && part !== '')
    .join(', ')

  return (
    <section
      data-block="testimonial"
      className="-mx-4 mt-14 px-5 py-8 sm:mx-0 sm:rounded-3xl sm:px-8 sm:py-10 md:px-12 md:py-12"
      style={{ background: 'var(--fa-navy)', color: '#fff' }}
    >
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            From anglers
          </p>
          <h2 className="f-display text-[28px] font-bold leading-[1.1] tracking-[-0.01em] sm:text-[34px]">What anglers said</h2>
        </div>

        <figure
          data-photo-layout={testimonial.photoUrl != null ? testimonial.photoLayout : undefined}
          className={`flex flex-col rounded-2xl bg-white p-5 sm:p-6 ${
            vertical ? 'sm:min-h-[320px] sm:flex-row sm:items-stretch' : ''
          }`}
          style={{ color: 'var(--fa-navy)', boxShadow: '0 12px 32px -12px rgba(0,0,0,0.35)' }}
        >
          {testimonial.photoUrl != null && (
            <div
              className={vertical
                // The sm offsets are exactly the card's padding (p-6), so a stretched photo
                // ends flush with the card's edges — as in offer-story-block.tsx.
                ? 'relative -mx-5 -mt-5 mb-4 h-[300px] overflow-hidden rounded-t-2xl sm:-my-6 sm:-ml-6 sm:mr-6 sm:h-auto sm:w-[44%] sm:max-w-[280px] sm:flex-none sm:rounded-l-2xl sm:rounded-tr-none'
                : 'relative -mx-5 -mt-5 mb-4 h-[180px] overflow-hidden rounded-t-2xl sm:-mx-6 sm:-mt-6'}
            >
              <Image
                src={testimonial.photoUrl}
                alt=""
                fill
                sizes={vertical ? '(min-width: 640px) 280px, 100vw' : '(min-width: 768px) 50vw, 100vw'}
                className="object-cover"
              />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            {testimonial.rating != null && <Stars rating={testimonial.rating} />}
            <blockquote className="mb-4 text-[17px] leading-relaxed">“{testimonial.quote}”</blockquote>
            <figcaption className="mt-auto text-[13px]" style={{ color: 'rgba(10,46,77,0.62)' }}>
              <p className="font-medium">{who}</p>
              {/* A Trustpilot row always has its link (database rule); without one it says nothing
                  rather than claim the wrong source. */}
              {testimonial.source === 'trustpilot' ? testimonial.sourceUrl != null && (
                <p className="mt-2">
                  <a
                    href={testimonial.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline underline-offset-4"
                    style={{ color: 'var(--fa-navy)', textDecorationColor: 'rgba(10,46,77,0.3)' }}
                  >
                    Read on Trustpilot ›
                  </a>
                </p>
              ) : (
                <p className="mt-2" data-testid="testimonial-direct">
                  Sent to FjordAnglers directly by the angler, published with their consent.
                </p>
              )}
            </figcaption>
          </div>
        </figure>
      </div>
    </section>
  )
}
