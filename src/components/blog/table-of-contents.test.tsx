import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TableOfContents } from './table-of-contents'

/**
 * FA-1.83 (tj decision 1 → B): labels clamped to two lines, full text on hover.
 * FA-1.97: the list is sticky inside a column as tall as the article — not `fixed` over the page.
 */

const sections = [
  { id: 'short', label: 'Short heading' },
  { id: 'long', label: 'A very long heading that is written as a whole sentence for the article' },
]

describe('table of contents column', () => {
  const html = renderToStaticMarkup(<TableOfContents sections={sections} />)

  it('is sticky inside its column and never fixed to the viewport (it must not hang over the hero or the footer)', () => {
    expect(html).toContain('position:sticky')
    expect(html).not.toContain('position:fixed')
  })

  it('clamps each label to two lines and keeps the full text in the title', () => {
    expect(html).toMatch(/-webkit-line-clamp:2/)
    expect(html).toContain(`title="${sections[1].label}"`)
  })
})
