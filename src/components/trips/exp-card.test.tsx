// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ExpCard, type ExpCardPage } from './exp-card'

afterEach(cleanup)

/**
 * FA-1.65 — the one listing card, shared by `/trips` and the country hubs.
 */

const page = (over: Partial<ExpCardPage> = {}): ExpCardPage => ({
  slug: 'trip', experience_name: 'Fixture Trip', country: 'Iceland', region: 'South-West',
  price_from: 700, price_type: 'flat', currency: 'EUR',
  hero_image_url: null, gallery_image_urls: [], difficulty: 'Intermediate', non_angler_friendly: true,
  ...over,
})

describe('ExpCard', () => {
  it('FA-1.65: without priceText it prints the v1 price exactly as /trips always has', () => {
    const { getByTestId, container } = render(<ExpCard page={page()} />)
    expect(getByTestId('exp-card-price').textContent).toBe('from €700 per trip')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/experiences/trip')
    expect(container.textContent).toContain('Intermediate')
    expect(container.textContent).toContain('Family-friendly')
  })

  it('FA-1.65: priceText replaces the v1 line (the hub passes the offer page\'s own price)', () => {
    const { getByTestId } = render(<ExpCard page={page()} priceText="from NZ$1,320 · 1–2 anglers per guide" />)
    expect(getByTestId('exp-card-price').textContent).toBe('from NZ$1,320 · 1–2 anglers per guide')
  })

  it('FA-1.65: guideName adds the guide line; moreGuides adds "+N"', () => {
    const { getByTestId } = render(<ExpCard page={page()} guideName="Josh Fixture" moreGuides={2} />)
    expect(getByTestId('exp-card-guide').textContent).toBe('Jwith Josh Fixture +2')
  })

  it('FA-1.65: no guideName, no guide line — /trips cards stay as they were', () => {
    const { queryByTestId } = render(<ExpCard page={page()} />)
    expect(queryByTestId('exp-card-guide')).toBeNull()
  })
})
