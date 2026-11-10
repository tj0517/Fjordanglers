/**
 * Article body → what the page renders (FA-1.83, decisions D1 and O-49 a).
 *
 * The body is Markdown (GFM tables) plus four named blocks, written with the directive syntax:
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
 * Nothing here produces HTML. The plugin only marks nodes (`data-block`, ids); the page maps them
 * to React components. `react-markdown` is used without `rehype-raw`, so a `<script>` typed into
 * the body is dropped, not rendered. Text pasted from Notion must work as it is: any directive the
 * plugin does not know — `Note:this`, `:::foo` — goes back to plain text instead of vanishing.
 *
 * The table of contents and the rendered headings share this one plugin, so an id in the contents
 * is always an id on the page.
 */

import { unified, type Plugin } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import type { Parents, Root, RootContent, Strong } from 'mdast'

type ContainerDirective = Extract<RootContent, { type: 'containerDirective' }>

export interface ArticleSection {
  id: string
  label: string
}

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

/**
 * Marks directives and headings. Runs on the parsed tree, before it becomes HTML-shaped data.
 *  - warning / info / stat / photo → a `div` carrying `dataBlock` (+ its values) for the page's component;
 *  - every other directive → plain text, as typed;
 *  - headings get a stable id; a `#` is rendered as `h2` (the page's title is the only `h1`);
 *  - the first paragraph of the article is the lead.
 */
const remarkArticleBlocks: Plugin<[], Root> = () => (tree, file) => {
  const source = String(file)
  const used = new Map<string, number>()

  const asSource = (node: RootContent): string => {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    return start != null && end != null ? source.slice(start, end) : textOf(node)
  }

  const uniqueId = (text: string): string => {
    const base = slugifyHeading(text)
    const n = (used.get(base) ?? 0) + 1
    used.set(base, n)
    return n === 1 ? base : `${base}-${n}`
  }

  /** "Important: " / "Note: " in front of the first paragraph, as the old JSX had it — marked so the page can colour it. */
  const addLabel = (block: ContainerDirective, kind: 'warning' | 'info'): void => {
    const label: Strong = {
      type: 'strong',
      data: { hProperties: { dataLabel: kind } },
      children: [{ type: 'text', value: kind === 'warning' ? 'Important: ' : 'Note: ' }],
    }
    const first = block.children[0]
    if (first?.type === 'paragraph') first.children.unshift(label)
    else block.children.unshift({ type: 'paragraph', children: [label] })
  }

  const visit = (parent: Parents): void => {
    const next: RootContent[] = []

    for (const child of parent.children) {
      switch (child.type) {
        case 'heading': {
          child.data = {
            ...child.data,
            ...(child.depth === 1 ? { hName: 'h2' } : {}),
            hProperties: { id: uniqueId(textOf(child)) },
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
          if (child.name === 'photo' && src !== '' && alt !== '' && isSafeImageSrc(src)) {
            child.data = {
              hName: 'div',
              hProperties: { dataBlock: 'photo', dataSrc: src, dataAlt: alt, dataCaption: attr(child.attributes, 'caption') },
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
          const known =
            child.name === 'warning' || child.name === 'info' || (child.name === 'stat' && value !== '' && label !== '')

          visit(child)
          if (known) {
            if (child.name === 'warning' || child.name === 'info') addLabel(child, child.name)
            child.data = {
              hName: 'div',
              hProperties: { dataBlock: child.name, ...(child.name === 'stat' ? { dataValue: value, dataLabel: label } : {}) },
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
  if (first?.type === 'paragraph') first.data = { ...first.data, hProperties: { dataLead: 'true' } }
}

/** The plugin list the page's `<ReactMarkdown>` uses — one place, so contents and body agree. */
export const articleRemarkPlugins = [remarkGfm, remarkDirective, remarkArticleBlocks]

/** Table of contents: every `#` / `##` heading, with the id the rendered page gives it. */
export function extractSections(markdown: string): ArticleSection[] {
  const processor = unified().use(remarkParse).use(articleRemarkPlugins)
  // `parse` always yields a Root; `runSync` is typed as the wider `Node` because plugins may swap the tree.
  const tree = processor.runSync(processor.parse(markdown), { value: markdown }) as Root

  const sections: ArticleSection[] = []
  const walk = (node: Root | RootContent): void => {
    if (node.type === 'heading' && node.depth <= 2) {
      const id = (node.data?.hProperties as { id?: string } | undefined)?.id
      if (id != null) sections.push({ id, label: textOf(node) })
    }
    if ('children' in node) node.children.forEach(walk)
  }
  walk(tree)
  return sections
}
