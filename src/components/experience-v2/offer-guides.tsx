/**
 * S7 "Your guides" (FA-1.54, O-34).
 *
 * One card for every guide the data layer returns — `getExperienceV2` already keeps only
 * `experience_guides` rows with `show_on_page` AND `status = 'active'`, so a paused or
 * hidden guide never reaches this component and no second filter lives here.
 *
 * Each guide is one flat navy block (2026-11 mockup): the photo, the name, one line of facts —
 * Google rating, years on the water, association, languages, all real fields, nothing
 * invented — the bio, and the page's reply promise in salmon. The photo is the guide's avatar,
 * else the page's gallery photo of the same index.
 *
 * There is no "quote" field on `guides` or `experience_guides`, so a guide card has none.
 *
 * A card links to the guide's profile, `/guides/[slug]` (FA-1.62, Figma review 2026-10-20);
 * a guide without a slug gets the same card, not a link.
 */

import Image from 'next/image'
import Link from 'next/link'
import OfferSection from './offer-section'
import { languageNames } from '@/lib/experience-v2-content'
import { NAVY, ON_DARK_SOFT, SALMON_ON_DARK, initials } from '@/components/site/ui'

type OfferGuide = {
  id:                string
  /** `guides.slug` — the profile URL; null for a guide that has none yet. */
  slug:              string | null
  fullName:          string
  avatarUrl:         string | null
  yearsExperience:   number | null
  association:       string | null
  responseTimeHours: number | null
  googleRating:      number | null
  googleReviewCount: number | null
  languages:         string[]
  bio:               string | null
  isPrimary:         boolean
}

export type OfferGuidesProps = {
  guides:    OfferGuide[]
  /** The page's gallery, in order — card `i` takes photo `i`. */
  photoUrls: string[]
  /** `experience_pages.response_sla_hours` — the promise the page makes in the hero. */
  responseSlaHours: number
}

const BIO_MAX_CHARS = 260

/** Cuts at a word boundary and adds an ellipsis; text that already fits is returned as is. */
function shorten(value: string, max: number): string {
  const text = value.trim()
  if (text.length <= max) return text
  const cut   = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

export default function OfferGuides({ guides, photoUrls, responseSlaHours }: OfferGuidesProps) {
  // The empty-field guard: no guide shown on this page, no section.
  if (guides.length === 0) return null

  return (
    <OfferSection
      section="S7"
      eyebrow="Who takes you out"
      title={guides.length === 1 ? 'Your guide' : 'Your guides'}
      accordion={{ defaultOpen: true }}
    >
      <div className="flex flex-col gap-4">
        {guides.map((guide, i) => (
          <GuideCard key={guide.id} guide={guide} photoUrl={guide.avatarUrl ?? photoUrls[i] ?? null} responseSlaHours={responseSlaHours} />
        ))}
      </div>
    </OfferSection>
  )
}

function GuideCard({ guide, photoUrl, responseSlaHours }: { guide: OfferGuide; photoUrl: string | null; responseSlaHours: number }) {
  const facts = [
    guide.googleRating != null
      ? `★ ${guide.googleRating.toFixed(1)}${guide.googleReviewCount != null ? ` · ${guide.googleReviewCount} Google reviews` : ' on Google'}`
      : null,
    guide.yearsExperience != null
      ? `${guide.yearsExperience} ${guide.yearsExperience === 1 ? 'year' : 'years'} of experience`
      : null,
    guide.association,
    guide.languages.length > 0 ? `Speaks ${languageNames(guide.languages).join(', ')}` : null,
    guide.responseTimeHours != null ? `usually replies within ${guide.responseTimeHours} h` : null,
  ].filter((fact): fact is string => fact != null && fact.trim() !== '')

  const linked = guide.slug != null

  const body = (
    <div className="flex h-full flex-wrap items-center gap-5 rounded-[20px] p-6" style={{ background: NAVY }}>
      {photoUrl != null ? (
        <Image
          src={photoUrl}
          alt={guide.fullName}
          width={132}
          height={132}
          className="h-[104px] w-[104px] flex-none rounded-2xl object-cover sm:h-[132px] sm:w-[132px]"
        />
      ) : (
        <div
          aria-hidden
          className="f-display flex h-[104px] w-[104px] flex-none items-center justify-center rounded-2xl text-[34px] font-bold text-white sm:h-[132px] sm:w-[132px]"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          {initials(guide.fullName)}
        </div>
      )}

      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
        <h3 className="f-display text-[22px] font-bold leading-tight text-white sm:text-[24px]">{guide.fullName}</h3>
        {facts.length > 0 && (
          <p className="text-[15px]" style={{ color: ON_DARK_SOFT }}>{facts.join(' · ')}</p>
        )}
        {guide.bio != null && guide.bio.trim() !== '' && (
          <p className="text-[15px] leading-relaxed" style={{ color: ON_DARK_SOFT }}>{shorten(guide.bio, BIO_MAX_CHARS)}</p>
        )}
        <p className="mt-1 text-[14.5px]" style={{ color: SALMON_ON_DARK }}>Answers within {responseSlaHours} h</p>
      </div>

      {/* The whole block is the link; this is how it reads as one, not a second link. */}
      {linked && (
        <span
          aria-hidden
          className="inline-flex min-h-[46px] flex-none items-center justify-center whitespace-nowrap rounded-[10px] px-5 text-[14.5px] font-bold text-white"
          style={{ border: '1.5px solid rgba(255,255,255,.7)' }}
        >
          View profile
        </span>
      )}
    </div>
  )

  if (!linked) return <div data-testid="guide-card">{body}</div>

  return (
    <Link
      href={`/guides/${guide.slug}`}
      data-testid="guide-card"
      className="block h-full rounded-[20px] outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--fa-navy)] focus-visible:ring-offset-2"
    >
      {body}
    </Link>
  )
}
