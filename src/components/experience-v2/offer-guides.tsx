/**
 * S7 "Your guides" (FA-1.54, O-34).
 *
 * One card for every guide the data layer returns — `getExperienceV2` already keeps only
 * `experience_guides` rows with `show_on_page` AND `status = 'active'`, so a paused or
 * hidden guide never reaches this component and no second filter lives here.
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

type OfferGuide = {
  id:                string
  fullName:          string
  avatarUrl:         string | null
  yearsExperience:   number | null
  association:       string | null
  responseTimeHours: number | null
  languages:         string[]
  bio:               string | null
}

export type OfferGuidesProps = { guides: OfferGuide[] }

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

export default function OfferGuides({ guides }: OfferGuidesProps) {
  // The empty-field guard: no guide shown on this page, no section.
  if (guides.length === 0) return null

  return (
    <OfferSection
      section="S7"
      title={guides.length === 1 ? 'Your guide' : 'Your guides'}
      accordion={{ defaultOpen: true }}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          {guides.map(guide => <GuideCard key={guide.id} guide={guide} />)}
        </div>
        <FaCard />
      </div>
    </OfferSection>
  )
}

function GuideCard({ guide }: { guide: OfferGuide }) {
  const facts = [
    guide.yearsExperience != null
      ? `${guide.yearsExperience} ${guide.yearsExperience === 1 ? 'year' : 'years'} of experience`
      : null,
    guide.association,
    guide.responseTimeHours != null ? `usually replies within ${guide.responseTimeHours} h` : null,
  ].filter((fact): fact is string => fact != null && fact.trim() !== '')

  return (
    <div data-testid="guide-card">
      <Box className="flex gap-4">
        {guide.avatarUrl != null ? (
          <Image
            src={guide.avatarUrl}
            alt={guide.fullName}
            width={72}
            height={72}
            className="h-[72px] w-[72px] flex-none rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-full text-xl font-semibold"
            style={{ background: 'rgba(10,46,77,0.08)' }}
          >
            {initials(guide.fullName)}
          </div>
        )}

        <div className="min-w-0">
          <h3 className="text-xl font-semibold leading-tight">{guide.fullName}</h3>
          {facts.length > 0 && (
            <p className="mt-1 text-sm" style={mutedStyle}>{facts.join(' · ')}</p>
          )}
          {guide.languages.length > 0 && (
            <p className="mt-1 text-sm" style={mutedStyle}>Speaks {guide.languages.join(', ')}</p>
          )}
          {guide.bio != null && guide.bio.trim() !== '' && (
            <p className="mt-2.5 text-[15px]">{shorten(guide.bio, BIO_MAX_CHARS)}</p>
          )}
        </div>
      </Box>
    </div>
  )
}

/** Static on purpose — the same card on every offer page, from the brand docs. */
function FaCard() {
  return (
    <div data-testid="fa-card">
      <Box>
        <h3 className="mb-1.5 text-lg font-semibold">Who we are — FjordAnglers</h3>
        <p className="text-[15px]">
          Tymon, Krzychu and Lukas — a group of students from Poland who love to travel the
          Nordic countries with a rod. We pick the guide and the water for your level, you pay
          us a deposit online, and the rest goes straight to your guide.
        </p>
      </Box>
    </div>
  )
}
