/**
 * Article body → what the page renders (FA-1.83, decisions D1 and O-49 a).
 *
 * The body is Markdown (GFM tables) plus named blocks, written with the directive syntax:
 *
 *     :::warning            a callout — text inside is Markdown
 *     text
 *     :::
 *
 *     :::info               the same, calmer
 *     text
 *     :::
 *
 *     :::stat{value="15 kg" label="marine fish per person"}
 *     The note under the number.
 *     :::
 *
 *     ::photo{src="/fish_catalog/cod.png" alt="Atlantic cod" caption="Optional caption."}
 *
 *     :::summary            the "In short" box — a bullet list as Markdown (FA-1.97)
 *     - one line per point
 *     :::
 *
 *     ::quote{text="Words of the guide." guide="Name" region="Where"}     (FA-1.97)
 *
 * An FAQ section is not a block but a convention: a top-level `##` heading that starts with "FAQ"
 * or "Frequently Asked Questions", with a `###` per question (FA-1.97). The plugin cuts the section
 * out of the body and leaves one marker where it stood; the page draws it as the FAQ block and the
 * same questions go to the `FAQPage` JSON-LD (`extractArticleFaq`).
 *
 * Nothing here produces HTML. The plugin only marks nodes (`data-block`, ids); the page maps them
 * to React components. `react-markdown` is used without `rehype-raw`, so a `<script>` typed into
 * the body is dropped, not rendered. Text pasted from Notion must work as it is: any directive the
 * plugin does not know — `Note:this`, `:::foo` — goes back to plain text instead of vanishing.
 *
 * The table of contents and the rendered headings share this one plugin, so an id in the contents
 * is always an id on the page.
 */

import { unified, type Plugin, type PluggableList } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import type { Heading, Parents, Root, RootContent, Strong } from 'mdast'

type ContainerDirective = Extract<RootContent, { type: 'containerDirective' }>

export interface ArticleSection {
  id: string
  label: string
}

export interface ArticleFaq {
  /** The id of the FAQ heading — the table of contents links to it, the section carries it. */
  id: string
  /** The heading without its leading "FAQ –"; "Frequently Asked Questions" when nothing is left. */
  title: string
  /** Markdown between the heading and the first question; null when there is none. */
  intro: string | null
  entries: { question: string; answerMd: string; answerText: string }[]
}

/** What the plugin cut out of the body, before the plain-text answers are worked out. */
interface RawFaq {
  id: string
  title: string
  intro: string | null
  entries: { question: string; answerMd: string }[]
}

/** The FAQ the plugin cut out, by the marker it left in its place — `extractArticleFaq` reads it back. */
const faqByMarker = new WeakMap<object, RawFaq>()

/** A top-level `##` that starts with "FAQ" or "Frequently Asked Questions" opens the FAQ section. */
const FAQ_HEADING = /^(faqs?|frequently asked questions)\b/i
/** "FAQ – Frequently Asked Questions (2026)" → the part after the dash is the block's title. */
const FAQ_PREFIX = /^faqs?\s*[-–—:]\s*/i
const FAQ_FALLBACK_TITLE = 'Frequently Asked Questions'

/** A site path ('/fish_catalog/x.png') or an https URL — never `javascript:`, `data:` or '//host'. */
export function isSafeImageSrc(src: string): boolean {
  if (/^\/(?!\/)/.test(src)) return true
  try {
    return new URL(src).protocol === 'https:'
  } catch {
    return false
  }
}

function textOf(node: RootContent | Root): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if ('children' in node) return node.children.map(textOf).join('')
  return ''
}

function slugifyHeading(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug === '' ? 'section' : slug
}

type Attributes = Record<string, string | null | undefined> | null | undefined

function attr(attributes: Attributes, name: string): string {
  return (attributes?.[name] ?? '').trim()
}

function range(node: RootContent): { start: number; end: number } | null {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  return start != null && end != null ? { start, end } : null
}

function isSectionBreak(node: RootContent): boolean {
  return node.type === 'heading' && node.depth <= 2
}

interface FaqSection extends RawFaqBody {
  /** Index range of the section's nodes in `tree.children`: heading included, next section excluded. */
  from: number
  to: number
}
type RawFaqBody = Omit<RawFaq, 'id'>

/**
 * The FAQ section of a body: the first top-level `##` that opens with "FAQ" and has at least one `###`
 * question. Question = the `###` text; answer = the source between that heading and the next question
 * (or the end of the section), kept as Markdown. Without a single question it is an ordinary section.
 */
function findFaqSection(tree: Root, source: string): FaqSection | null {
  const nodes = tree.children

  for (let from = 0; from < nodes.length; from++) {
    const head = nodes[from]
    if (head.type !== 'heading' || head.depth !== 2 || !FAQ_HEADING.test(textOf(head).trim())) continue

    let to = from + 1
    while (to < nodes.length && !isSectionBreak(nodes[to])) to++

    const questions = nodes.slice(from + 1, to).filter((n): n is Heading => n.type === 'heading' && n.depth === 3)
    const headRange = range(head)
    const ranges = questions.map(range)
    if (questions.length === 0 || headRange == null) continue

    const sectionEnd = (to < nodes.length ? range(nodes[to])?.start : undefined) ?? source.length
    const entries: FaqSection['entries'] = []
    for (let q = 0; q < questions.length; q++) {
      const here = ranges[q]
      if (here == null) break
      const nextStart = ranges[q + 1]?.start ?? sectionEnd
      entries.push({ question: textOf(questions[q]).trim(), answerMd: source.slice(here.end, nextStart).trim() })
    }
    const first = ranges[0]
    if (first == null || entries.length !== questions.length) continue

    const intro = source.slice(headRange.end, first.start).trim()
    const stripped = textOf(head).trim().replace(FAQ_PREFIX, '').trim()
    const title = stripped === '' || /^faqs?$/i.test(stripped) ? FAQ_FALLBACK_TITLE : stripped
    return { from, to, title, intro: intro === '' ? null : intro, entries }
  }

  return null
}

interface ArticleBlocksOptions {
  /**
   * The text is one FAQ answer (or an FAQ intro), rendered on its own: no lead paragraph, no heading
   * ids (they would repeat the page's) and no FAQ cutting of its own.
   */
  answer?: boolean
}

/**
 * Marks directives and headings. Runs on the parsed tree, before it becomes HTML-shaped data.
 *  - warning / info / stat / photo / summary / quote → a `div` carrying `dataBlock` (+ its values) for the page's component;
 *  - every other directive — and a stat without value or label, a quote without text — → plain text, as typed;
 *  - headings get a stable id; a `#` is rendered as `h2` (the page's title is the only `h1`);
 *  - the FAQ section is replaced by one marker (`dataBlock: 'faq'`) — its headings still take their ids,
 *    in order, so the ids of everything after it are what they were before the FAQ was cut out;
 *  - the first paragraph of the article is the lead.
 */
const remarkArticleBlocks: Plugin<[ArticleBlocksOptions?], Root> = (options = {}) => (tree, file) => {
  const source = String(file)
  const answerMode = options.answer === true
  const used = new Map<string, number>()

  const asSource = (node: RootContent): string => {
    const at = range(node)
    return at != null ? source.slice(at.start, at.end) : textOf(node)
  }

  const uniqueId = (text: string): string => {
    const base = slugifyHeading(text)
    const n = (used.get(base) ?? 0) + 1
    used.set(base, n)
    return n === 1 ? base : `${base}-${n}`
  }

  /** "Important. " / "Good to know. " in front of the first paragraph — the callout's label. */
  const addLabel = (block: ContainerDirective, kind: 'warning' | 'info'): void => {
    const label: Strong = {
      type: 'strong',
      children: [{ type: 'text', value: kind === 'warning' ? 'Important. ' : 'Good to know. ' }],
    }
    const first = block.children[0]
    if (first?.type === 'paragraph') first.children.unshift(label)
    else block.children.unshift({ type: 'paragraph', children: [label] })
  }

  const found = answerMode ? null : findFaqSection(tree, source)

  const visit = (parent: Parents): void => {
    const next: RootContent[] = []
    const children: RootContent[] = parent.children

    for (let i = 0; i < children.length; i++) {
      const child = children[i]

      if (parent === tree && found != null && i === found.from) {
        // Walk the section as before so its headings use up their ids, then leave one marker.
        const heading = children[found.from]
        visit({ type: 'root', children: children.slice(found.from, found.to) })
        const id = (heading.data?.hProperties as { id?: string } | undefined)?.id ?? slugifyHeading(textOf(heading))
        const marker: RootContent = { type: 'paragraph', children: [], data: { hName: 'div', hProperties: { dataBlock: 'faq', id } } }
        faqByMarker.set(marker, { id, title: found.title, intro: found.intro, entries: found.entries })
        next.push(marker)
        i = found.to - 1
        continue
      }

      switch (child.type) {
        case 'heading': {
          child.data = {
            ...child.data,
            ...(child.depth === 1 ? { hName: 'h2' } : {}),
            ...(answerMode ? {} : { hProperties: { id: uniqueId(textOf(child)) } }),
          }
          visit(child)
          next.push(child)
          break
        }

        case 'textDirective': {
          next.push({ type: 'text', value: asSource(child) })
          break
        }

        case 'leafDirective': {
          const src = attr(child.attributes, 'src')
          const alt = attr(child.attributes, 'alt')
          const quote = attr(child.attributes, 'text')
          if (child.name === 'photo' && src !== '' && alt !== '' && isSafeImageSrc(src)) {
            child.data = {
              hName: 'div',
              hProperties: { dataBlock: 'photo', dataSrc: src, dataAlt: alt, dataCaption: attr(child.attributes, 'caption') },
            }
            child.children = []
            next.push(child)
          } else if (child.name === 'quote' && quote !== '') {
            child.data = {
              hName: 'div',
              hProperties: {
                dataBlock: 'quote', dataText: quote,
                dataGuide: attr(child.attributes, 'guide'), dataRegion: attr(child.attributes, 'region'),
              },
            }
            child.children = []
            next.push(child)
          } else {
            next.push({ type: 'paragraph', children: [{ type: 'text', value: asSource(child) }] })
          }
          break
        }

        case 'containerDirective': {
          const value = attr(child.attributes, 'value')
          const label = attr(child.attributes, 'label')

          visit(child)
          const known =
            child.name === 'warning' || child.name === 'info' ||
            (child.name === 'stat' && value !== '' && label !== '') ||
            (child.name === 'summary' && child.children.length > 0)

          if (known) {
            if (child.name === 'warning' || child.name === 'info') addLabel(child, child.name)
            child.data = {
              hName: 'div',
              hProperties: {
                dataBlock: child.name,
                ...(child.name === 'stat' ? { dataValue: value, dataLabel: label } : {}),
                ...(child.name === 'summary' && !answerMode ? { id: uniqueId('In short') } : {}),
              },
            }
            next.push(child)
          } else {
            // Not ours: keep what was written between the fences, drop the fences.
            next.push(...child.children)
          }
          break
        }

        default: {
          if ('children' in child) visit(child)
          next.push(child)
        }
      }
    }

    parent.children = next as typeof parent.children
  }

  visit(tree)

  const first = tree.children[0]
  if (!answerMode && first?.type === 'paragraph' && first.data?.hName == null) first.data = { ...first.data, hProperties: { dataLead: 'true' } }
}

/** The plugin list the page's `<ReactMarkdown>` uses — one place, so contents and body agree. */
export const articleRemarkPlugins: PluggableList = [remarkGfm, remarkDirective, remarkArticleBlocks]

/** The same, for text that sits inside the FAQ block: one answer, or the section's intro. */
export const answerRemarkPlugins: PluggableList = [remarkGfm, remarkDirective, [remarkArticleBlocks, { answer: true }]]

function runPlugins(markdown: string, plugins: PluggableList): Root {
  const processor = unified().use(remarkParse).use(plugins)
  // `parse` always yields a Root; `runSync` is typed as the wider `Node` because plugins may swap the tree.
  return processor.runSync(processor.parse(markdown), { value: markdown }) as Root
}

/**
 * Table of contents: every `#` / `##` heading, with the id the rendered page gives it; the "In short"
 * box and the FAQ block sit in the list where they stand in the body.
 */
export function extractSections(markdown: string): ArticleSection[] {
  const tree = runPlugins(markdown, articleRemarkPlugins)

  const sections: ArticleSection[] = []
  const walk = (node: Root | RootContent): void => {
    if (node.type === 'heading' && node.depth <= 2) {
      const id = (node.data?.hProperties as { id?: string } | undefined)?.id
      if (id != null) sections.push({ id, label: textOf(node) })
    }

    const faq = faqByMarker.get(node)
    if (faq != null) sections.push({ id: faq.id, label: 'FAQ' })

    const props = node.data?.hProperties as { dataBlock?: string; id?: string } | undefined
    if (props?.dataBlock === 'summary' && props.id != null) sections.push({ id: props.id, label: 'In short' })

    if ('children' in node) node.children.forEach(walk)
  }
  walk(tree)
  return sections
}

/** Block nodes of an already-processed answer, one string per line: a paragraph, a list item, a table row. */
function linesOf(node: Root | RootContent): string[] {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return [inlineText(node)]
    case 'code':
      return [node.value]
    case 'tableRow':
      return [node.children.map(inlineText).join(' | ')]
    case 'thematicBreak':
    case 'html':
    case 'definition':
      return []
    default:
      return 'children' in node ? node.children.flatMap(linesOf) : 'value' in node ? [String(node.value)] : []
  }
}

function inlineText(node: Root | RootContent): string {
  if (node.type === 'break') return '\n'
  if (node.type === 'image') return node.alt ?? ''
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  return 'children' in node ? node.children.map(inlineText).join('') : ''
}

/** An answer as the plain text a `FAQPage` wants: no Markdown marks, each list item on its own line. */
function markdownToPlainText(markdown: string): string {
  return linesOf(runPlugins(markdown, answerRemarkPlugins))
    .join('\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .join('\n')
}

/**
 * The FAQ section of an article, or null when it has none (no `## FAQ…`, or no `###` question under
 * it). Same plugin as the page, so what the page draws and what the `FAQPage` says cannot differ.
 */
export function extractArticleFaq(markdown: string): ArticleFaq | null {
  const tree = runPlugins(markdown, articleRemarkPlugins)

  for (const node of tree.children) {
    const raw = faqByMarker.get(node)
    if (raw != null) {
      return { ...raw, entries: raw.entries.map(entry => ({ ...entry, answerText: markdownToPlainText(entry.answerMd) })) }
    }
  }
  return null
}
