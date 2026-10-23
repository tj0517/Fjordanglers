/**
 * The listing card of an experience page — one card on `/trips` and on the country hubs
 * (FA-1.65; until then the hub carried a copy of it, deferred in FA-0.14).
 *
 * No `'use client'`: the card has no state of its own, so it renders on the server where a
 * server page uses it and inside the client tree where `/trips` uses it.
 */

import Image from 'next/image'
import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { CountryFlag } from '@/components/ui/country-flag'
import { formatPrice } from '@/lib/format-price'

// ─── Shared type ──────────────────────────────────────────────────────────────

export type ExpPage = {
  id: string
  slug: string
  experience_name: string
  country: string
  region: string
  price_from: number
  price_type: string
  currency: string
  hero_image_url: string | null
  gallery_image_urls: unknown
  difficulty: string | null
  technique: unknown
  target_species: unknown
  non_angler_friendly: boolean | null
  location_lat: number | null
  location_lng: number | null
  location_area: unknown   // GeoJSON.Polygon | null
  location_spots: unknown  // LocationSpot[] | null
}

/** The fields the card itself prints. */
export type ExpCardPage = Pick<
  ExpPage,
  | 'slug' | 'experience_name' | 'country' | 'region' | 'price_from' | 'price_type' | 'currency'
  | 'hero_image_url' | 'gallery_image_urls' | 'difficulty' | 'non_angler_friendly'
>

// ─── Difficulty colours ───────────────────────────────────────────────────────

const DIFFICULTY_COLOR: Record<string, { bg: string; color: string }> = {
  Beginner:     { bg: 'rgba(74,222,128,0.12)',  color: '#16A34A' },
  Intermediate: { bg: 'rgba(230,126,80,0.12)',  color: '#E67E50' },
  Advanced:     { bg: 'rgba(239,68,68,0.1)',    color: '#DC2626' },
  Expert:       { bg: 'rgba(139,0,0,0.1)',      color: '#8B0000' },
}

// ─── Full listing card ────────────────────────────────────────────────────────

export function ExpCard({
  page,
  priority = false,
  priceText,
  guideName,
  guideAvatarUrl,
  moreGuides = 0,
  onMouseEnter,
  onMouseLeave,
}: {
  page: ExpCardPage
  priority?: boolean
  /** Replaces the v1 `formatPrice` line — the hub passes the price the offer page prints. */
  priceText?: string
  /** The first guide shown on the offer page; absent = no guide line. */
  guideName?: string
  guideAvatarUrl?: string | null
  /** Further guides shown on the offer page — printed as "+N". */
  moreGuides?: number
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}) {
  const gallery   = (page.gallery_image_urls as string[] | null) ?? []
  const coverUrl  = gallery[0] ?? page.hero_image_url
  const dc = page.difficulty ? (DIFFICULTY_COLOR[page.difficulty] ?? { bg: 'rgba(10,46,77,0.07)', color: '#0A2E4D' }) : null

  return (
    <Link
      href={`/experiences/${page.slug}`}
      className="block group"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <article
        className="transition-all duration-200 group-hover:-translate-y-0.5"
        style={{ borderRadius: '20px' }}
      >
        {/* ── Image ─────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden"
          style={{ height: '240px', borderRadius: '16px', background: '#EDE6DB' }}
        >
          {coverUrl != null && (
            <Image
              src={coverUrl}
              alt={page.experience_name}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              priority={priority}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          )}

          {/* Top-left badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {dc != null && page.difficulty && (
              <div
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full f-body"
                style={{ background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(8px)', color: '#0A2E4D' }}
              >
                {page.difficulty}
              </div>
            )}
            {page.non_angler_friendly && (
              <div
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full f-body"
                style={{ background: 'rgba(74,222,128,0.85)', backdropFilter: 'blur(8px)', color: '#fff' }}
              >
                Family-friendly
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
            <span
              className="text-[13px] font-bold px-3.5 py-1.5 rounded-full f-body"
              style={{ background: 'rgba(5,12,22,0.72)', color: '#fff', backdropFilter: 'blur(8px)' }}
              data-testid="exp-card-price"
            >
              {priceText ?? formatPrice({ priceFrom: page.price_from, priceType: page.price_type, currency: page.currency })}
            </span>
          </div>
        </div>

        {/* ── Text info ─────────────────────────────────────────── */}
        <div className="pt-3 px-0.5 pb-3">

          <h3
            className="font-semibold leading-snug f-body line-clamp-2"
            style={{ fontSize: '15px', color: '#0A2E4D' }}
          >
            {page.experience_name}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(10,46,77,0.07)' }}>
            <MapPin size={10} strokeWidth={2} style={{ color: 'rgba(10,46,77,0.45)', flexShrink: 0 }} />
            <p className="text-[11px] font-medium f-body truncate min-w-0" style={{ color: 'rgba(10,46,77,0.65)' }}>
              {page.region}, {page.country}
            </p>
            <span className="flex-shrink-0"><CountryFlag country={page.country} /></span>
          </div>

          {/* Guide */}
          {guideName != null && (
            <div className="flex items-center gap-2 mt-2" data-testid="exp-card-guide">
              {guideAvatarUrl != null ? (
                <span className="relative block h-6 w-6 flex-none overflow-hidden rounded-full" style={{ background: '#EDE6DB' }}>
                  <Image src={guideAvatarUrl} alt="" fill sizes="24px" className="object-cover" />
                </span>
              ) : (
                <span
                  aria-hidden
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-semibold f-body"
                  style={{ background: 'rgba(10,46,77,0.10)', color: '#0A2E4D' }}
                >
                  {guideName.charAt(0)}
                </span>
              )}
              <p className="text-[13px] f-body truncate min-w-0" style={{ color: 'rgba(10,46,77,0.75)' }}>
                with <span className="font-semibold" style={{ color: '#0A2E4D' }}>{guideName}</span>
                {moreGuides > 0 && <span style={{ color: 'rgba(10,46,77,0.55)' }}> +{moreGuides}</span>}
              </p>
            </div>
          )}

        </div>
      </article>
    </Link>
  )
}
