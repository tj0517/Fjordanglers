/**
 * "About this trip" — the written story of the page, and the photos that go with it.
 *
 * Every live page has a story (`story_text`), most have content blocks with a headline, a
 * paragraph and often a photo (`content_blocks`), all have species with descriptions and
 * photos (`species_details`), some a line on what anglers actually catch (`catches_text`).
 * The offer-centric template left all of it unread, and a page that is only chips and a
 * calculator has nothing to say about the water. This section says it, in that order:
 * the story, the blocks as photo cards, the fish, the catches.
 *
 * Nothing here is required — a page with only a story shows only the story. With none of
 * the four, the section is not drawn.
 */

import Image from 'next/image'
import OfferSection from './offer-section'
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
          {environment.length > 0 && (
            <p className="mt-4 text-[13px] uppercase tracking-[0.12em]" style={mutedStyle}>
              {environment.join(' · ')}
            </p>
          )}
        </div>
      )}

      {contentBlocks.length > 0 && (
        <div className={`${paragraphs.length > 0 ? 'mt-8' : ''} grid grid-cols-1 gap-4 ${contentBlocks.length === 1 ? '' : 'sm:grid-cols-2'}`} data-testid="offer-story-blocks">
          {contentBlocks.map((block, i) => (
            <Box key={`${i}-${block.headline ?? ''}`} className={contentBlocks.length === 1 ? 'flex flex-col gap-5 sm:flex-row' : 'flex flex-col'}>
              {block.imageUrl != null && (
                <div
                  className={contentBlocks.length === 1
                    ? 'relative -mx-5 -mt-5 h-[220px] flex-none overflow-hidden rounded-t-2xl sm:-my-5 sm:ml-[-20px] sm:mr-0 sm:h-auto sm:w-[320px] sm:rounded-l-2xl sm:rounded-tr-none'
                    : 'relative -mx-5 -mt-5 mb-4 h-[200px] overflow-hidden rounded-t-2xl'}
                >
                  <Image src={block.imageUrl} alt={block.headline ?? ''} fill sizes="(min-width: 640px) 45vw, 100vw" className="object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {block.headline != null && <h3 className="f-display text-[21px] font-bold leading-tight">{block.headline}</h3>}
                {block.text != null && <p className={`${block.headline != null ? 'mt-2' : ''} text-[15px] leading-relaxed`} style={{ color: 'rgba(10,46,77,0.78)' }}>{block.text}</p>}
              </div>
            </Box>
          ))}
        </div>
      )}

      {speciesDetails.length > 0 && (
        <div className={paragraphs.length > 0 || contentBlocks.length > 0 ? 'mt-8' : ''} data-testid="offer-species">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em]" style={mutedStyle}>What you fish for</p>
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
