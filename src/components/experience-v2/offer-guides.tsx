/**
 * S7 "Your guides" (FA-1.54, O-34).
 *
 * One card for every guide the data layer returns — `getExperienceV2` already keeps only
 * `experience_guides` rows with `show_on_page` AND `status = 'active'`, so a paused or
 * hidden guide never reaches this component and no second filter lives here.
 *
 * Above the cards, the numbers that say why this guide: Google rating, review count, years
 * on the water, reply time — all real fields, nothing invented. Each card carries a photo
 * from the page's gallery, because a face next to a landscape is what the reference pages
 * have and a bordered paragraph does not.
 *
 * Next to them, a static card on who FA is. Its copy comes from docs/brand/01-brand-overview.md
 * ("Origin Story") and the founders' names in CLAUDE.md; nothing the brand docs do not
 * say (time zones, a weather "plan B") is claimed for us here.
 *
 * There is no "quote" field on `guides` or `experience_guides`, so a guide card has none.
 */

import Image from 'next/image'
import OfferSection from './offer-section'
import { Box, mutedStyle } from './offer-box'
import { languageNames } from '@/lib/experience-v2-content'

type OfferGuide = {
  id:                string
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
  /** The page's gallery, in order — card `i` takes photo `i`, the FA card the next one. */
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

function initials(fullName: string): string {
  return fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('')
}

export default function OfferGuides({ guides, photoUrls, responseSlaHours }: OfferGuidesProps) {
  // The empty-field guard: no guide shown on this page, no section.
  if (guides.length === 0) return null

  const primary = guides.find(g => g.isPrimary) ?? guides[0]!

  const stats = [
    primary.googleRating != null
      ? { value: `★ ${primary.googleRating.toFixed(1)}`, label: primary.googleReviewCount != null ? `${primary.googleReviewCount} Google reviews` : 'on Google' }
      : null,
    primary.yearsExperience != null
      ? { value: `${primary.yearsExperience}`, label: primary.yearsExperience === 1 ? 'year guiding' : 'years guiding' }
      : null,
    { value: `${responseSlaHours} h`, label: 'to our first reply' },
  ].filter((s): s is { value: string; label: string } => s != null)

  return (
    <OfferSection
      section="S7"
      eyebrow="Who takes you out"
      title={guides.length === 1 ? 'Your guide' : 'Your guides'}
      accordion={{ defaultOpen: true }}
    >
      {stats.length > 1 && (
        <dl className="mb-6 flex flex-wrap gap-x-10 gap-y-4" data-testid="guide-stats">
          {stats.map(stat => (
            <div key={stat.label} className="min-w-[96px]">
              <dd className="f-display text-[34px] font-bold leading-none tracking-[-0.01em]">{stat.value}</dd>
              <dt className="mt-1.5 text-[13px]" style={mutedStyle}>{stat.label}</dt>
            </div>
          ))}
        </dl>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {guides.map((guide, i) => (
          <GuideCard key={guide.id} guide={guide} photoUrl={photoUrls[i] ?? null} />
        ))}
        <FaCard photoUrl={photoUrls[guides.length] ?? null} />
      </div>
    </OfferSection>
  )
}

function Cover({ url, alt }: { url: string; alt: string }) {
  return (
    <div className="relative -mx-5 -mt-5 mb-4 h-[200px] overflow-hidden rounded-t-2xl">
      <Image src={url} alt={alt} fill sizes="(min-width: 640px) 40vw, 100vw" className="object-cover" />
    </div>
  )
}

function GuideCard({ guide, photoUrl }: { guide: OfferGuide; photoUrl: string | null }) {
  const facts = [
    guide.yearsExperience != null
      ? `${guide.yearsExperience} ${guide.yearsExperience === 1 ? 'year' : 'years'} of experience`
      : null,
    guide.association,
    guide.responseTimeHours != null ? `usually replies within ${guide.responseTimeHours} h` : null,
  ].filter((fact): fact is string => fact != null && fact.trim() !== '')

  return (
    <div data-testid="guide-card">
      <Box className="flex h-full flex-col">
        {photoUrl != null && <Cover url={photoUrl} alt="" />}

        <div className="flex items-center gap-3.5">
          {guide.avatarUrl != null ? (
            <Image
              src={guide.avatarUrl}
              alt={guide.fullName}
              width={56}
              height={56}
              className="h-14 w-14 flex-none rounded-full object-cover"
              style={{ boxShadow: '0 0 0 3px #fff, 0 2px 8px rgba(10,46,77,0.18)' }}
            />
          ) : (
            <div
              aria-hidden
              className="flex h-14 w-14 flex-none items-center justify-center rounded-full text-lg font-semibold"
              style={{ background: 'rgba(10,46,77,0.08)' }}
            >
              {initials(guide.fullName)}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="f-display text-[22px] font-bold leading-tight">{guide.fullName}</h3>
            {guide.languages.length > 0 && (
              <p className="mt-0.5 text-[13px]" style={mutedStyle}>Speaks {languageNames(guide.languages).join(', ')}</p>
            )}
          </div>
        </div>

        {facts.length > 0 && (
          <p className="mt-3 text-sm" style={mutedStyle}>{facts.join(' · ')}</p>
        )}
        {guide.bio != null && guide.bio.trim() !== '' && (
          <p className="mt-2.5 text-[15px] leading-relaxed">{shorten(guide.bio, BIO_MAX_CHARS)}</p>
        )}
      </Box>
    </div>
  )
}

/** Static on purpose — the same card on every offer page, from the brand docs. */
function FaCard({ photoUrl }: { photoUrl: string | null }) {
  return (
    <div data-testid="fa-card">
      <Box className="flex h-full flex-col">
        {photoUrl != null && <Cover url={photoUrl} alt="" />}
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={mutedStyle}>Who we are</p>
        <h3 className="f-display mt-1 text-[22px] font-bold leading-tight">FjordAnglers</h3>
        <p className="mt-2.5 text-[15px] leading-relaxed">
          Tymon, Krzychu and Lukas — a group of students from Poland who love to travel the
          Nordic countries with a rod. We pick the guide and the water for your level, you pay
          us a deposit online, and the rest goes straight to your guide.
        </p>
      </Box>
    </div>
  )
}
