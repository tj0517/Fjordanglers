// @vitest-environment jsdom
/**
 * "About this trip" — feedback round 1 (2026-10-13): the environment line and the content
 * blocks get their own eyebrows ("Waters", "Programs"), Waters sits right above Programs and
 * outside the story column, and a block with two or more photos opens them in a lightbox.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import type { SpeciesDetail, StoryBlock } from '@/lib/experience-v2-content'
import OfferStory, { type OfferStoryProps } from './offer-story'
import { INQUIRY_ANCHOR } from './inquiry-anchor'

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

const block = (over: Partial<StoryBlock> = {}): StoryBlock => ({ headline: 'Spring Creeks', text: 'Clear, slow water.', imageUrls: [], section: 'programs', ...over })
const water = (over: Partial<StoryBlock> = {}): StoryBlock => block({ headline: 'Tongariro River', section: 'waters', ...over })

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

describe('OfferStory — Waters blocks (FA-1.60)', () => {
  const headlines = (el: HTMLElement) => [...el.querySelectorAll('h3')].map(h => h.textContent)

  it('(a) Waters blocks are photo cards under Waters, in place of the environment line', () => {
    const { getByTestId } = story({
      environment:   ['River', 'Lake'],
      contentBlocks: [water({ imageUrls: ['/t-1.jpg', '/t-2.jpg'] }), water({ headline: 'Lake Otamangakau' })],
    })
    const waters = getByTestId('offer-waters')
    expect(headlines(waters)).toEqual(['Tongariro River', 'Lake Otamangakau'])
    expect(within(waters).getByTestId('offer-water-blocks').className).toContain('sm:grid-cols-2')
    expect(within(waters).getByTestId('story-block-gallery').textContent).toBe('+1 photos')
    expect(waters.textContent).not.toContain('River · Lake')
  })

  it('(b) no Waters blocks and an environment: the line, exactly as before', () => {
    const { getByTestId } = story({ environment: ['River', 'Lake'], contentBlocks: [block()] })
    expect(getByTestId('offer-waters').textContent).toBe('WatersRiver · Lake')
    expect(getByTestId('offer-waters').querySelector('[data-testid="offer-water-blocks"]')).toBeNull()
  })

  it('(c) Waters blocks are not in Programs; programs keep their stored order', () => {
    const { getByTestId, container } = story({
      contentBlocks: [block({ headline: 'Day 1' }), water(), block({ headline: 'Day 2' })],
    })
    expect(headlines(getByTestId('offer-programs'))).toEqual(['Day 1', 'Day 2'])
    expect(headlines(getByTestId('offer-waters'))).toEqual(['Tongariro River'])
    expect(eyebrows(container)).toEqual(['Waters', 'Programs'])
  })

  it('only Waters blocks: no Programs eyebrow, the section is still drawn', () => {
    const { getByTestId, container } = story({ storyText: null, contentBlocks: [water()] })
    expect(getByTestId('offer-waters')).toBeTruthy()
    expect(container.querySelector('[data-testid="offer-programs"]')).toBeNull()
    expect(getByTestId('offer-waters').className).toBe('')
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

describe('OfferStory — species cards (FA-1.62)', () => {
  const fish = (over: Partial<SpeciesDetail> = {}): SpeciesDetail => ({
    name: 'Brown Trout', description: 'Big, wary fish.', imageUrls: ['/trout-1.jpg'], seasonMonths: [], avgSizeText: null, ...over,
  })
  const card = (container: HTMLElement) => container.querySelector('[data-testid="offer-species"] li') as HTMLElement

  it('prints the full description — no 150-character cut, no ellipsis', () => {
    const description = 'A long description of a wary fish. '.repeat(12).trim()
    const { container } = story({ speciesDetails: [fish({ description })] })
    expect(card(container).textContent).toContain(description)
    expect(card(container).textContent).not.toContain('…')
  })

  it('a species with 3 photos is a gallery: cover, "+2 photos", and the lightbox opens on its name', async () => {
    const { container, getByTestId } = story({ speciesDetails: [fish({ imageUrls: ['/t1.jpg', '/t2.jpg', '/t3.jpg'] })] })
    expect(card(container).querySelectorAll('img')).toHaveLength(1)
    const trigger = getByTestId('species-gallery')
    expect(trigger.textContent).toBe('+2 photos')
    expect(trigger.getAttribute('aria-label')).toBe('Open 3 photos of Brown Trout')

    fireEvent.click(trigger)
    const box = await waitFor(() => {
      const el = document.querySelector('[data-testid="story-lightbox"]') as HTMLElement | null
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    expect(within(box).getByRole('heading').textContent).toBe('Brown Trout')
    expect(within(box).getByTestId('story-lightbox-counter').textContent).toBe('1 / 3')
  })

  it('one photo or none: no gallery button', () => {
    const { container } = story({ speciesDetails: [fish(), fish({ name: 'Grayling', imageUrls: [] })] })
    expect(container.querySelector('[data-testid="species-gallery"]')).toBeNull()
    expect(container.querySelectorAll('[data-testid="offer-species"] img')).toHaveLength(1)
  })

  it('prints the season like the season chip and the average size under the description', () => {
    const { container } = story({ speciesDetails: [fish({ seasonMonths: [10, 11, 12, 1, 2, 3, 4], avgSizeText: '2–4 kg' })] })
    const facts = card(container).querySelector('[data-testid="species-facts"]')!
    expect([...facts.children].map(row => row.textContent)).toEqual(['Season: Oct–Apr', 'Average size: 2–4 kg'])
  })

  it('no season and no average size: neither line, no facts block, no calendar icon', () => {
    const { container } = story({ speciesDetails: [fish()] })
    expect(card(container).querySelector('[data-testid="species-facts"]')).toBeNull()
    expect(card(container).textContent).not.toContain('Average size')
    expect(card(container).querySelector('[data-testid="species-calendar"]')).toBeNull()
  })

  it('the calendar icon points at the inquiry form and scrolls there — no modal', () => {
    const form = document.createElement('section')
    form.id = INQUIRY_ANCHOR.slice(1)
    const scrollIntoView = vi.fn()
    form.scrollIntoView = scrollIntoView
    document.body.appendChild(form)

    const { getByTestId } = story({ speciesDetails: [fish({ seasonMonths: [6, 7, 8], imageUrls: ['/t1.jpg', '/t2.jpg'] })] })
    const icon = getByTestId('species-calendar')
    expect(icon.getAttribute('href')).toBe(INQUIRY_ANCHOR)
    expect(icon.getAttribute('aria-label')).toBe('Brown Trout season: Jun–Aug — ask about your dates')

    fireEvent.click(icon)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.instances[0]).toBe(form)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    // A click on the icon is not a click on the gallery under it.
    expect(document.querySelector('[data-testid="story-lightbox"]')).toBeNull()
    expect(document.querySelector('[role="dialog"]')).toBeNull()

    form.remove()
  })

  it('without a photo the icon sits next to the name', () => {
    const { container } = story({ speciesDetails: [fish({ imageUrls: [], seasonMonths: [6] })] })
    const icon = card(container).querySelector('[data-testid="species-calendar"]')!
    expect(icon.nextElementSibling?.tagName).toBe('H3')
  })
})
