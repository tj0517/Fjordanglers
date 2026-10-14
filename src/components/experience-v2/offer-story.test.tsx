// @vitest-environment jsdom
/**
 * "About this trip" — feedback round 1 (2026-10-13): the environment line and the content
 * blocks get their own eyebrows ("Waters", "Programs"), Waters sits right above Programs and
 * outside the story column, and a block with two or more photos opens them in a lightbox.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import type { StoryBlock } from '@/lib/experience-v2-content'
import OfferStory, { type OfferStoryProps } from './offer-story'

afterEach(cleanup)

const story = (over: Partial<OfferStoryProps> = {}) => render(
  <OfferStory
    storyText={'First paragraph.\n\nSecond paragraph.'}
    contentBlocks={[]}
    speciesDetails={[]}
    catchesText={null}
    environment={[]}
    {...over}
  />,
)

const block = (over: Partial<StoryBlock> = {}): StoryBlock => ({ headline: 'Spring Creeks', text: 'Clear, slow water.', imageUrls: [], ...over })

/** The section body — the section's own header (eyebrow, accordion button) is not what is tested. */
const body = (container: HTMLElement) => container.querySelector('#offer-story-body') as HTMLElement

const eyebrows = (container: HTMLElement) =>
  [...body(container).querySelectorAll('p.uppercase')].map(el => el.textContent)

describe('OfferStory — Waters and Programs', () => {
  it('labels the environment "Waters" and the blocks "Programs", Waters directly above Programs', () => {
    const { container, getByTestId } = story({ environment: ['River', 'Lake', 'National Park'], contentBlocks: [block()] })

    expect(eyebrows(container)).toEqual(['Waters', 'Programs'])
    expect(getByTestId('offer-waters').textContent).toBe('WatersRiver · Lake · National Park')
    // Order in the section: story paragraphs, then Waters, then Programs.
    const order = [...container.querySelectorAll('[data-testid]')].map(el => el.getAttribute('data-testid'))
    expect(order.indexOf('offer-story')).toBeLessThan(order.indexOf('offer-waters'))
    expect(order.indexOf('offer-waters') + 1).toBe(order.indexOf('offer-programs'))
    // Not inside the narrow story column any more.
    expect(getByTestId('offer-story').contains(getByTestId('offer-waters'))).toBe(false)
  })

  it('draws each eyebrow only over content', () => {
    expect(eyebrows(story({ environment: ['River'] }).container)).toEqual(['Waters'])
    cleanup()
    expect(eyebrows(story({ contentBlocks: [block()] }).container)).toEqual(['Programs'])
    cleanup()
    const { container } = story()
    expect([...container.querySelectorAll('p.uppercase')].map(el => el.textContent)).not.toContain('Waters')
    expect(container.querySelector('[data-testid="offer-waters"]')).toBeNull()
    expect(container.querySelector('[data-testid="offer-programs"]')).toBeNull()
  })
})

describe('OfferStory — content block gallery', () => {
  const photos = ['/creek-1.jpg', '/creek-2.jpg', '/creek-3.jpg']

  it('a block with 0 or 1 photo is not clickable and has no badge', () => {
    const { container } = story({ contentBlocks: [block({ imageUrls: ['/only.jpg'] }), block({ headline: 'Lake', imageUrls: [] })] })
    expect(container.querySelector('[data-testid="story-block-gallery"]')).toBeNull()
    expect(body(container).querySelector('button')).toBeNull()
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  it('a block with 3 photos shows the cover and "+2 photos"', () => {
    const { getByTestId, container } = story({ contentBlocks: [block({ imageUrls: photos })] })
    expect(getByTestId('story-block-gallery').textContent).toBe('+2 photos')
    expect(getByTestId('story-block-gallery').getAttribute('aria-label')).toBe('Open 3 photos of Spring Creeks')
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })

  it('opens a lightbox: counter, next / prev and the arrow keys wrap around, Esc closes and focus returns', async () => {
    const { getByTestId } = story({ contentBlocks: [block({ imageUrls: photos })] })
    const trigger = getByTestId('story-block-gallery')
    trigger.focus()
    fireEvent.click(trigger)

    const box = await waitFor(() => {
      const el = document.querySelector('[data-testid="story-lightbox"]') as HTMLElement | null
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    const counter = () => within(box).getByTestId('story-lightbox-counter').textContent
    expect(within(box).getByRole('heading').textContent).toBe('Spring Creeks')
    expect(counter()).toBe('1 / 3')

    fireEvent.click(within(box).getByRole('button', { name: 'Next photo' }))
    expect(counter()).toBe('2 / 3')
    fireEvent.keyDown(box, { key: 'ArrowRight' })
    expect(counter()).toBe('3 / 3')
    fireEvent.keyDown(box, { key: 'ArrowRight' })
    expect(counter()).toBe('1 / 3')
    fireEvent.click(within(box).getByRole('button', { name: 'Previous photo' }))
    expect(counter()).toBe('3 / 3')
    expect(within(box).getByRole('img').getAttribute('alt')).toBe('Spring Creeks — photo 3 of 3')

    fireEvent.keyDown(box, { key: 'Escape' })
    await waitFor(() => expect(document.querySelector('[data-testid="story-lightbox"]')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
