/**
 * "About this trip" — the written story of the page, and the photos that go with it.
 *
 * Every live page has a story (`story_text`), most have content blocks with a headline, a
 * paragraph and often a photo (`content_blocks`), all have species with descriptions and
 * photos (`species_details`), some a line on what anglers actually catch (`catches_text`).
 * The offer-centric template left all of it unread, and a page that is only chips and a
 * calculator has nothing to say about the water. This section says it, in that order:
 * the story, "Waters", "Programs", the fish, the catches. Each eyebrow appears only over
 * content.
 *
 * Waters and Programs are both lists of the same photo cards (a block with several photos
 * opens them in a lightbox — see ./offer-story-block.tsx), and so is the fish — its card,
 * ./offer-species-card.tsx, adds the season, the average size and a calendar icon (FA-1.62); a page block's `section` says
 * which list it is in, and a block without one is a program (FA-1.60). A page with no Waters
 * blocks keeps the one line it always had under Waters: `environment`, joined with " · ".
 *
 * Nothing here is required — a page with only a story shows only the story. With none of
 * story, blocks, fish or catches, the section is not drawn.
 */

import OfferSection from './offer-section'
import OfferStoryBlock from './offer-story-block'
import OfferSpeciesCard from './offer-species-card'
import { mutedStyle } from './offer-box'
import { INK, SALMON_ON_DARK } from '@/components/site/ui'
import grain from '@/components/site/grain.module.css'
import type { SpeciesDetail, StoryBlock } from '@/lib/experience-v2-content'

export type OfferStoryProps = {
  storyText:      string | null
  /** Every page block, Waters and Programs, in stored order; each one says its section. */
  contentBlocks:  StoryBlock[]
  speciesDetails: SpeciesDetail[]
  catchesText:    string | null
  /** `experience_pages.environment` — short words for the water and the land around it. */
  environment:    string[]
}

/** The small label over a group — "Waters", "Programs", "What you fish for". */
function Eyebrow({ children }: { children: string }) {
  return <p className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.12em]" style={mutedStyle}>{children}</p>
}

/**
 * Text-only blocks are the mockup's cream cards, one under the other. Photo cards keep their
 * grid: one column for a single block, two from `sm` up.
 */
function BlockGrid({ blocks, testId }: { blocks: StoryBlock[]; testId: string }) {
  const withPhotos = blocks.some(block => block.imageUrls.length > 0)
  return (
    <div
      className={withPhotos ? `grid grid-cols-1 gap-4 ${blocks.length === 1 ? '' : 'sm:grid-cols-2'}` : 'flex flex-col gap-3'}
      data-testid={testId}
    >
      {blocks.map((block, i) => (
        <OfferStoryBlock key={`${i}-${block.headline ?? ''}`} block={block} single={blocks.length === 1} />
      ))}
    </div>
  )
}

export default function OfferStory({ storyText, contentBlocks, speciesDetails, catchesText, environment }: OfferStoryProps) {
  const paragraphs = (storyText ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(p => p !== '')
  const waterBlocks   = contentBlocks.filter(block => block.section === 'waters')
  const programBlocks = contentBlocks.filter(block => block.section !== 'waters')
  const hasWaters     = waterBlocks.length > 0 || environment.length > 0

  if (paragraphs.length === 0 && contentBlocks.length === 0 && speciesDetails.length === 0 && catchesText == null) return null

  return (
    <OfferSection section="story" eyebrow="The trip" title="About this trip" accordion={{ defaultOpen: true }}>
      {paragraphs.length > 0 && (
        <div className="max-w-[66ch]" data-testid="offer-story">
          {paragraphs.map((para, i) => (
            <p key={i} className={`${i === 0 ? '' : 'mt-5'} text-[16.5px] leading-[1.7]`} style={{ color: INK }}>
              {para}
            </p>
          ))}
        </div>
      )}

      {/* Waters sits right above Programs, outside the narrow story column. */}
      {hasWaters && (
        <div className={paragraphs.length > 0 ? 'mt-8' : ''} data-testid="offer-waters">
          <Eyebrow>Waters</Eyebrow>
          {waterBlocks.length > 0
            ? <BlockGrid blocks={waterBlocks} testId="offer-water-blocks" />
            : <p className="text-[15.5px] font-semibold">{environment.join(' · ')}</p>}
        </div>
      )}

      {programBlocks.length > 0 && (
        <div className={hasWaters ? 'mt-6' : paragraphs.length > 0 ? 'mt-8' : ''} data-testid="offer-programs">
          <Eyebrow>Programs</Eyebrow>
          <BlockGrid blocks={programBlocks} testId="offer-story-blocks" />
        </div>
      )}

      {speciesDetails.length > 0 && (
        <div className={paragraphs.length > 0 || hasWaters || programBlocks.length > 0 ? 'mt-8' : ''} data-testid="offer-species">
          <Eyebrow>What you fish for</Eyebrow>
          <ul className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {speciesDetails.map(species => (
              <li key={species.name}>
                <OfferSpeciesCard species={species} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {catchesText != null && (
        <div className={`${grain.blur} ${grain.guide} mt-6 flex flex-col gap-2 rounded-[18px] px-6 py-6 sm:px-7`}>
          <p className="text-[11.5px] font-bold uppercase tracking-[0.12em]" style={{ color: SALMON_ON_DARK }}>What anglers catch here</p>
          <p className="f-display text-[18px] font-medium leading-normal text-white sm:text-[19px]">{catchesText}</p>
        </div>
      )}
    </OfferSection>
  )
}
