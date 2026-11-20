// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'

const nav = vi.hoisted(() => ({ pathname: '/iceland' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))

import { SiteNav } from '../nav'

afterEach(() => {
  cleanup()
  nav.pathname = '/iceland'
})

/**
 * The site nav's mobile menu (tj, 2026-11-17): a button below `md` opens a menu with the three
 * links and "Plan your trip"; Escape, a link click and a new path close it.
 */

const button = () => screen.getByRole('button', { name: /menu/i })
const menu = () => screen.getByTestId('site-nav-menu')

describe('SiteNav — mobile menu', () => {
  it('the button says whether the menu is open and which element it controls', () => {
    render(<SiteNav />)
    expect(button().getAttribute('aria-expanded')).toBe('false')
    expect(button().getAttribute('aria-controls')).toBe(menu().id)
    expect(menu().hidden).toBe(true)

    fireEvent.click(button())
    expect(button().getAttribute('aria-expanded')).toBe('true')
    expect(button().getAttribute('aria-label')).toBe('Close menu')
    expect(menu().hidden).toBe(false)
  })

  it('holds Trips, Guides, Journal and Plan your trip → /trips', () => {
    render(<SiteNav />)
    fireEvent.click(button())
    const links = [...menu().querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')])
    expect(links).toEqual([['Trips', '/trips'], ['Guides', '/guides'], ['Journal', '/blog'], ['Plan your trip', '/trips']])
  })

  it('Escape closes it and puts focus back on the button', () => {
    render(<SiteNav />)
    fireEvent.click(button())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(button().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button())
  })

  it('a link click closes it', () => {
    render(<SiteNav />)
    fireEvent.click(button())
    fireEvent.click(menu().querySelector('a')!)
    expect(button().getAttribute('aria-expanded')).toBe('false')
  })

  it('navigation to another path closes it', () => {
    const { rerender } = render(<SiteNav />)
    fireEvent.click(button())
    expect(button().getAttribute('aria-expanded')).toBe('true')
    nav.pathname = '/trips'
    rerender(<SiteNav />)
    expect(button().getAttribute('aria-expanded')).toBe('false')
  })
})

/**
 * Sticky and shrinking (tj, 2026-11-20): the bar is pinned on every page; past the top of the page
 * it narrows and the links move into the menu button; back at the top they return.
 */
describe('SiteNav — on scroll', () => {
  const header = () => document.querySelector('header')!
  const links = () => screen.getByTestId('site-nav-links')
  const scrollTo = (y: number) => {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
    fireEvent.scroll(window)
  }

  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 0 })
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
  })
  afterEach(() => {
    vi.restoreAllMocks()
    scrollTo(0)
  })

  it('is pinned to the top on the home page as on the others', () => {
    render(<SiteNav />)
    expect(header().className).toContain('fixed')
  })

  it('past 64 px it shrinks and hides the links from the bar; below 24 px it grows back', () => {
    render(<SiteNav />)
    expect(header().dataset.compact).toBeUndefined()
    expect(links().getAttribute('aria-hidden')).toBeNull()

    scrollTo(200)
    expect(header().dataset.compact).toBe('true')
    expect(links().getAttribute('aria-hidden')).toBe('true')
    expect(button().className).not.toContain('md:invisible')
    // "Plan your trip" stays in the bar, outside the folded links (tj, 2026-11-20)
    const bar = [...header().querySelectorAll('a[href="/trips"]')].filter(a => !links().contains(a) && !menu().contains(a))
    expect(bar.map(a => a.textContent)).toEqual(['Plan your trip'])

    scrollTo(40) // between the two thresholds: stays small
    expect(header().dataset.compact).toBe('true')

    scrollTo(10)
    expect(header().dataset.compact).toBeUndefined()
    expect(button().className).toContain('md:invisible')
  })

  it('the menu opened on a small bar closes when a wide screen scrolls back to the top', () => {
    render(<SiteNav />)
    scrollTo(200)
    fireEvent.click(button())
    expect(menu().className).not.toContain('md:hidden')
    expect(button().getAttribute('aria-expanded')).toBe('true')
    scrollTo(0)
    expect(button().getAttribute('aria-expanded')).toBe('false')
  })
})
