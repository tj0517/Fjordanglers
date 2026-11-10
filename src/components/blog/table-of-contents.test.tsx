import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TableOfContents } from './table-of-contents'

/** FA-1.83 (tj decision 1 → B): narrow sidebar, labels clamped to two lines, full text on hover. */

const sections = [
  { id: 'short', label: 'Short heading' },
  { id: 'long', label: 'A very long heading that is written as a whole sentence for the article' },
]

describe('table of contents sidebar', () => {
  const html = renderToStaticMarkup(<TableOfContents sections={sections} />)

  it('is 150px wide and sits left of the article column, not over it', () => {
    expect(html).toContain('width:150px')
    expect(html).toContain('left:max(1.5rem, calc(50% - 560px))')
  })

  it('clamps each label to two lines and keeps the full text in the title', () => {
    expect(html).toMatch(/-webkit-line-clamp:2/)
    expect(html).toContain(`title="${sections[1].label}"`)
  })
})
