/**
 * "About this trip" — the written story of the page, and the photos that go with it.
 *
 * Every live page has a story (`story_text`), most have content blocks with a headline, a
 * paragraph and often a photo (`content_blocks`), all have species with descriptions and
 * photos (`species_details`), some a line on what anglers actually catch (`catches_text`).
 * The offer-centric template left all of it unread, and a page that is only chips and a
 * calculator has nothing to say about the water. This section says it, in that order:
 * the story, the waters (`environment`, under a "Waters" eyebrow), the blocks as photo cards
 * (under "Programs"; a block with several photos opens them in a lightbox — see
 * ./offer-story-block.tsx), the fish, the catches. Each eyebrow appears only over content.
 *
 * Nothing here is required — a page with only a story shows only the story. With none of
 * the four, the section is not drawn.
 */

import Image from 'next/image'
import OfferSection from './offer-section'
import OfferStoryBlock from './offer-story-block'
import { Box, mutedStyle } from './offer-box'
import type { SpeciesDetail, StoryBlock } from '@/lib/experience-v2-content'

export type OfferStoryProps = {
  storyText:      string | null
  contentBlocks:  StoryBlock[]
  speciesDetails: SpeciesDetail[]
  catchesText:    string | null
  /** `experience_pages.environment` — short words for the water and the land around it. */
  environment:    string[]
}

const SPECIES_MAX_CHARS = 150

/** The small label over a group — "Waters", "Programs", "What you fish for". */
function Eyebrow({ children }: { children: string }) {
  return <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em]" style={mutedStyle}>{children}</p>
}

function shorten(value: string, max: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  const cut = trimmed.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).trimEnd()}…`
}

export default function OfferStory({ storyText, contentBlocks, speciesDetails, catchesText, environment }: OfferStoryProps) {
  const paragraphs = (storyText ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(p => p !== '')

  if (paragraphs.length === 0 && contentBlocks.length === 0 && speciesDetails.length === 0 && catchesText == null) return null

  return (
    <OfferSection section="story" eyebrow="The trip" title="About this trip" accordion={{ defaultOpen: true }}>
      {paragraphs.length > 0 && (
        <div className="max-w-[66ch]" data-testid="offer-story">
          {paragraphs.map((para, i) => (
            <p
              key={i}
              className={i === 0 ? 'text-[18px] leading-relaxed md:text-[19px]' : 'mt-4 text-[16px] leading-relaxed'}
              style={{ color: i === 0 ? 'var(--fa-navy)' : 'rgba(10,46,77,0.78)' }}
            >
              {para}
            </p>
          ))}
        </div>
      )}

      {/* Waters sits right above Programs, outside the narrow story column. */}
      {environment.length > 0 && (
        <div className={paragraphs.length > 0 ? 'mt-8' : ''} data-testid="offer-waters">
          <Eyebrow>Waters</Eyebrow>
          <p className="text-[15px] font-medium">{environment.join(' · ')}</p>
        </div>
      )}

      {contentBlocks.length > 0 && (
        <div className={environment.length > 0 ? 'mt-6' : paragraphs.length > 0 ? 'mt-8' : ''} data-testid="offer-programs">
          <Eyebrow>Programs</Eyebrow>
          <div className={`grid grid-cols-1 gap-4 ${contentBlocks.length === 1 ? '' : 'sm:grid-cols-2'}`} data-testid="offer-story-blocks">
            {contentBlocks.map((block, i) => (
              <OfferStoryBlock key={`${i}-${block.headline ?? ''}`} block={block} single={contentBlocks.length === 1} />
            ))}
          </div>
        </div>
      )}

      {speciesDetails.length > 0 && (
        <div className={paragraphs.length > 0 || environment.length > 0 || contentBlocks.length > 0 ? 'mt-8' : ''} data-testid="offer-species">
          <Eyebrow>What you fish for</Eyebrow>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {speciesDetails.map(species => (
              <li key={species.name}>
                <Box className="flex h-full flex-col">
                  {species.imageUrl != null && (
                    <div className="relative -mx-5 -mt-5 mb-3.5 h-[150px] overflow-hidden rounded-t-2xl">
                      <Image src={species.imageUrl} alt={species.name} fill sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover" />
                    </div>
                  )}
                  <h3 className="f-display text-[19px] font-bold leading-tight">{species.name}</h3>
                  {species.description != null && (
                    <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: 'rgba(10,46,77,0.75)' }}>
                      {shorten(species.description, SPECIES_MAX_CHARS)}
                    </p>
                  )}
                </Box>
              </li>
            ))}
          </ul>
        </div>
      )}

      {catchesText != null && (
        <div className="mt-6">
          <Box accent>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={mutedStyle}>What anglers catch here</p>
            <p className="mt-1.5 text-[15px] leading-relaxed">{catchesText}</p>
          </Box>
        </div>
      )}
    </OfferSection>
  )
}
