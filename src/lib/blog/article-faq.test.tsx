/**
 * FA-1.97 — the FAQ section of an article: cut out of the body, drawn as its own block, and the same
 * questions and answers for the `FAQPage` JSON-LD. Ids of every heading around it stay what they were.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArticleBody } from '@/components/blog/article-body'
import { buildFaqPageJsonLd } from '@/lib/seo/faq-jsonld'
import { extractArticleFaq, extractSections } from './article-markdown'

const NORWAY_LIKE = [
  '# Fishing in Norway', '',
  'Lead paragraph.', '',
  '## Sea angling', '',
  '### Do you need a licence for the sea?', '',
  'No.', '',
  '## FAQ – Frequently Asked Questions (2026)', '',
  '### Do I need a license for sea fishing?', '',
  'No. A **license** is *not* required from the shore or a boat.', '',
  '### What do I need for a salmon river?', '',
  'You need three things:', '',
  '- the national **fiskeravgift**', '- a local *fiskekort*', '- a [disinfection certificate](https://example.com/cert)', '',
  '### How much fish can I take home?', '',
  '15 kg of marine fish per person.', '',
  '## Useful Links (Official Resources)', '',
  '- [Fiskeridirektoratet](https://www.fiskeridir.no)', '',
].join('\n')

const html = (markdown: string, country: string | null = null) => renderToStaticMarkup(<ArticleBody markdown={markdown} country={country} />)

describe('extractArticleFaq', () => {
  it('returns one entry per ### in the FAQ section — not the ### of the sections before it', () => {
    const faq = extractArticleFaq(NORWAY_LIKE)
    expect(faq?.entries.map(e => e.question)).toEqual([
      'Do I need a license for sea fishing?',
      'What do I need for a salmon river?',
      'How much fish can I take home?',
    ])
    // As many entries as there are ### between the FAQ heading and the next ##.
    const section = NORWAY_LIKE.split('## FAQ')[1].split('\n## ')[0]
    expect(faq?.entries).toHaveLength((section.match(/^### /gm) ?? []).length)
  })

  it('title: the heading without its leading "FAQ –"; the fallback when nothing is left', () => {
    expect(extractArticleFaq(NORWAY_LIKE)?.title).toBe('Frequently Asked Questions (2026)')
    expect(extractArticleFaq('## FAQ\n\n### Q?\n\nA.')?.title).toBe('Frequently Asked Questions')
    expect(extractArticleFaq('## FAQ: Before you go\n\n### Q?\n\nA.')?.title).toBe('Before you go')
    expect(extractArticleFaq('## Frequently Asked Questions\n\n### Q?\n\nA.')?.title).toBe('Frequently Asked Questions')
  })

  it('intro: the Markdown between the heading and the first question, null when there is none', () => {
    expect(extractArticleFaq('## FAQ\n\nShort answers.\n\n### Q?\n\nA.')?.intro).toBe('Short answers.')
    expect(extractArticleFaq(NORWAY_LIKE)?.intro).toBeNull()
  })

  it('answer text is plain: no ** / * markup, a link is its text, list items are separate lines', () => {
    const [first, second] = extractArticleFaq(NORWAY_LIKE)?.entries ?? []
    expect(first?.answerText).toBe('No. A license is not required from the shore or a boat.')
    expect(second?.answerText).toBe(
      'You need three things:\nthe national fiskeravgift\na local fiskekort\na disinfection certificate',
    )
    for (const entry of extractArticleFaq(NORWAY_LIKE)?.entries ?? []) {
      expect(entry.answerText).not.toMatch(/\*|^- |\]\(/m)
    }
    expect(second?.answerMd).toContain('- the national **fiskeravgift**') // the Markdown stays for the page
  })

  it('a body without an FAQ section has none', () => {
    expect(extractArticleFaq('## Sea angling\n\nText.\n\n## Useful links\n\n- a')).toBeNull()
    expect(extractArticleFaq('just text')).toBeNull()
  })

  it('an FAQ heading with no ### question under it is not an FAQ', () => {
    expect(extractArticleFaq('## FAQ\n\nWrite to us.')).toBeNull()
  })

  it('only a top-level ## opens it — a ### FAQ inside another section does not', () => {
    expect(extractArticleFaq('## Rules\n\n### FAQ\n\n### Q?\n\nA.')).toBeNull()
  })
})

describe('the FAQPage built from it', () => {
  it('has as many questions as there are ### in the FAQ section', () => {
    const faq = extractArticleFaq(NORWAY_LIKE)
    const jsonLd = buildFaqPageJsonLd((faq?.entries ?? []).map(e => ({ question: e.question, answer: e.answerText })))
    expect(jsonLd?.['@type']).toBe('FAQPage')
    expect((jsonLd?.mainEntity as unknown[]).length).toBe(3)
  })

  it('a body without FAQ gives no FAQPage', () => {
    const faq = extractArticleFaq('## Sea angling\n\nText.')
    expect(faq).toBeNull()
    expect(buildFaqPageJsonLd((faq?.entries ?? []).map(e => ({ question: e.question, answer: e.answerText })))).toBeNull()
  })
})

describe('the FAQ in the rendered body', () => {
  it('is drawn once, as a block, and its questions are no longer <h3>', () => {
    const out = html(NORWAY_LIKE)
    expect(out.match(/data-block="article-faq"/g)).toHaveLength(1)
    expect(out).not.toMatch(/<h3[^>]*>Do I need a license for sea fishing/)
    // The ### of the section before the FAQ is untouched.
    expect(out).toMatch(/<h3[^>]*>Do you need a licence for the sea\?<\/h3>/)
    expect(out.match(/<details/g)).toHaveLength(3)
  })

  it('answers are Markdown: bold, italic and the list render as elements', () => {
    const out = html(NORWAY_LIKE)
    expect(out).toContain('<strong>license</strong>')
    expect(out).toContain('<em>not</em>')
    expect(out).toMatch(/<li[^>]*>the national <strong>fiskeravgift<\/strong><\/li>/)
  })

  it('an answer is not a lead paragraph — only the first paragraph of the article is', () => {
    const out = html('## FAQ\n\n### Q one?\n\nFirst answer.')
    expect(out).toContain('First answer.')
    expect(out).not.toMatch(/font-size:21px/)
  })

  it('the section carries the FAQ heading\'s id, and "FAQ" is in the contents at its place', () => {
    const out = html(NORWAY_LIKE)
    expect(out).toContain('id="faq-frequently-asked-questions-2026"')
    expect(extractSections(NORWAY_LIKE).map(s => s.label)).toEqual(['Fishing in Norway', 'Sea angling', 'FAQ', 'Useful Links (Official Resources)'])
  })

  it('title and intro: the heading\'s own words, then the intro Markdown, else the country line, else nothing', () => {
    const own = html('## FAQ\n\nWith **bold** intro.\n\n### Q?\n\nA.')
    expect(own).toContain('<strong>bold</strong> intro.')

    const country = html(NORWAY_LIKE, 'Norway')
    expect(country).toContain('Frequently Asked Questions (2026)')
    expect(country).toContain('Short answers to what anglers ask before a Norway trip.')

    const none = html(NORWAY_LIKE)
    expect(none).not.toContain('Short answers to what anglers ask')
  })

  it('a body without FAQ renders no block', () => {
    expect(html('## Sea angling\n\nText.')).not.toContain('article-faq')
  })
})

describe('heading ids around the FAQ do not move', () => {
  const md = [
    '# Title', '', 'Lead.', '',
    '## Seasons', '', '### Seasons', '',
    '## FAQ – Frequently Asked Questions (2026)', '', 'Intro text.', '',
    '### Do I need a licence?', '', 'No.', '', '### Seasons', '', '- a', '', '#### deep', '',
    '## Useful Links (Official Resources)', '',
    '## Seasons', '',
    '## Do I need a licence?', '',
  ].join('\n')

  it('the ids extractSections gave before the FAQ was cut out (taken from the old implementation) are the same', () => {
    expect(extractSections(md).map(s => s.id)).toEqual([
      'title', 'seasons', 'faq-frequently-asked-questions-2026', 'useful-links-official-resources', 'seasons-4', 'do-i-need-a-licence-2',
    ])
  })

  it('and the headings on the page carry them', () => {
    const out = html(md)
    for (const id of ['useful-links-official-resources', 'seasons-4', 'do-i-need-a-licence-2']) {
      expect(out, id).toContain(`id="${id}"`)
    }
  })
})
