// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

import { SiteFooter } from '../footer'

afterEach(cleanup)

/** The footer's Journal column opens the blog list filtered to each category (FA-1.97 reads `?category=`). */
describe('SiteFooter — Journal column', () => {
  it('links each topic to /blog?category=<topic>', () => {
    render(<SiteFooter />)
    const hrefs = ['Regulations', 'Seasons', 'Species', 'Planning'].map(label =>
      screen.getByRole('link', { name: label }).getAttribute('href'))
    expect(hrefs).toEqual([
      '/blog?category=regulations',
      '/blog?category=seasons',
      '/blog?category=species',
      '/blog?category=planning',
    ])
  })
})
