// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
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
    const { rerender } = render(<SiteNav overlay />)
    fireEvent.click(button())
    expect(button().getAttribute('aria-expanded')).toBe('true')
    nav.pathname = '/trips'
    rerender(<SiteNav overlay />)
    expect(button().getAttribute('aria-expanded')).toBe('false')
  })
})
