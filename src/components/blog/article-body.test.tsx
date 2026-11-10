import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArticleBody } from './article-body'
import { extractSections } from '@/lib/blog/article-markdown'

/**
 * FA-1.83 — the article body is Markdown plus four named blocks, rendered by components.
 * The security promise is the first describe: nothing typed into a body becomes HTML.
 */

const html = (markdown: string) => renderToStaticMarkup(<ArticleBody markdown={markdown} />)

describe('article body — no raw HTML from the database (XSS)', () => {
  it('a <script> in the body does not appear in the HTML', () => {
    const out = html('Before\n\n<script>alert("xss")</script>\n\nAfter')
    expect(out).not.toMatch(/<script/i)
    expect(out).not.toContain('alert("xss")')
    expect(out).toContain('Before')
    expect(out).toContain('After')
  })

  it('raw HTML is removed, not echoed: onerror handlers, iframes, style, event attributes', () => {
    const out = html(
      'a <img src=x onerror="alert(1)"> b <iframe src="https://evil.example"></iframe> c <a href="/" onclick="alert(2)">d</a> <style>body{display:none}</style>',
    )
    expect(out).not.toMatch(/onerror|onclick|<iframe|evil\.example/i)
    expect(out).not.toMatch(/<style>body|&lt;/)
  })

  it('a javascript: link and a javascript: image never reach an href / src', () => {
    const out = html('[click](javascript:alert(1)) and ![x](javascript:alert(2))')
    expect(out).not.toMatch(/javascript:/i)
  })

  it('a ::photo block with an unsafe src is shown as the text that was typed, not as an image', () => {
    for (const src of ['javascript:alert(1)', 'data:text/html;base64,AAAA', '//evil.example/x.png', 'http://insecure.example/x.png']) {
      const out = html(`::photo{src="${src}" alt="x"}`)
      expect(out, src).not.toMatch(/<img|<figure/)
    }
  })

  it('attribute values of a block are text, never markup', () => {
    const out = html(':::stat{value="<script>alert(1)</script>" label="x\\"><b>"}\nnote\n:::')
    expect(out).not.toMatch(/<script|<b>/i)
  })
})

describe('article body — the four named blocks (D1)', () => {
  it(':::warning and :::info keep their labels and Markdown inside', () => {
    const warning = html(':::warning\nCheck **every** river.\n:::')
    expect(warning).toContain('Important: ')
    expect(warning).toContain('<strong>every</strong>')
    expect(warning).toContain('#E67E50') // the warning accent

    const info = html(':::info\nStay clear of fish farms.\n:::')
    expect(info).toContain('Note: ')
    expect(info).toContain('Stay clear of fish farms.')
    expect(info).toContain('#1B4F72')
  })

  it(':::stat shows the number, its label and the note', () => {
    const out = html(':::stat{value="15 kg" label="marine fish per person"}\nMaximum twice per year.\n:::')
    expect(out).toContain('15 kg')
    expect(out).toContain('marine fish per person')
    expect(out).toContain('Maximum twice per year.')
    expect(out).toContain('clamp(40px')
  })

  it('a stat without a value or label is not a stat — its text stays', () => {
    const out = html('Intro.\n\n:::stat\nonly the note\n:::')
    expect(out).toContain('only the note')
    expect(out).not.toContain('clamp(40px') // the stat's big number
  })

  it('::photo draws a figure with alt text and caption', () => {
    const out = html('::photo{src="/fish_catalog/cod.png" alt="Atlantic cod" caption="Cod, halibut and saithe."}')
    expect(out).toContain('<figure')
    expect(out).toContain('alt="Atlantic cod"')
    expect(out).toContain('Cod, halibut and saithe.')
  })

  it('a ::photo without alt text is not a photo (an image needs its alt)', () => {
    expect(html('::photo{src="/fish_catalog/cod.png"}')).not.toContain('<figure')
  })
})

describe('article body — text pasted from Notion works as it is', () => {
  it('a colon that looks like a directive stays text', () => {
    const out = html('Note:this is fine, and so is "Time:10:30" and :wave:')
    expect(out).toContain('Note:this is fine')
    expect(out).toContain('Time:10:30')
    expect(out).toContain(':wave:')
  })

  it('an unknown container keeps what is between the fences', () => {
    const out = html(':::callout\nkeep me\n:::')
    expect(out).toContain('keep me')
  })

  it('GFM tables render as a table with a header row', () => {
    const out = html('| A | B |\n|---|---|\n| 1 | 2 |')
    expect(out).toMatch(/<table[\s\S]*<thead[\s\S]*<th[^>]*>A<\/th>[\s\S]*<td[^>]*>1<\/td>/)
  })

  it('numbered and bullet lists render', () => {
    const out = html('1. one\n2. two\n\n- a\n- b')
    expect(out).toMatch(/<ol[\s\S]*<li[^>]*>one<\/li>/)
    expect(out).toMatch(/<ul[\s\S]*<li[^>]*>a<\/li>/)
  })

  it('external links open safely; site links stay in the app', () => {
    const out = html('[out](https://example.com/x) and [in](/trips)')
    expect(out).toMatch(/<a href="https:\/\/example\.com\/x"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/)
    const site = out.match(/<a [^>]*href="\/trips"[^>]*>/)?.[0]
    expect(site).toBeDefined()
    expect(site).not.toContain('target=')
  })
})

describe('article body — headings and the table of contents', () => {
  const md = '# Title as h1\n\nLead.\n\n## Sea angling\n\n### Do you need a licence?\n\n## Sea angling\n\n## Fjordy & café'

  it('a # heading is rendered as h2 — the page title is the only h1', () => {
    expect(html(md)).not.toMatch(/<h1/)
  })

  it('every # and ## heading is in the contents, with the id the page gives it; ### is not', () => {
    const sections = extractSections(md)
    expect(sections.map(s => s.label)).toEqual(['Title as h1', 'Sea angling', 'Sea angling', 'Fjordy & café'])
    expect(sections.map(s => s.id)).toEqual(['title-as-h1', 'sea-angling', 'sea-angling-2', 'fjordy-cafe'])

    const out = html(md)
    for (const s of sections) expect(out, s.id).toContain(`id="${s.id}"`)
  })

  it('a body with no headings has no contents', () => {
    expect(extractSections('just text')).toEqual([])
  })

  it('the first paragraph is the lead', () => {
    const out = html('First paragraph.\n\nSecond.')
    expect(out).toMatch(/<p style="[^"]*font-size:20px[^"]*">First paragraph\./)
    expect(out).not.toMatch(/font-size:20px[^>]*>Second/)
  })
})
