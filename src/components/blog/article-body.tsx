import type { CSSProperties } from 'react'
import Link from 'next/link'
import ReactMarkdown, { type Components } from 'react-markdown'
import {
  answerRemarkPlugins, articleRemarkPlugins, extractArticleFaq, isSafeImageSrc, type ArticleFaq as ArticleFaqData,
} from '@/lib/blog/article-markdown'
import { MUTED, NAVY, ON_DARK, SALMON } from '@/components/site/ui'
import {
  ArticleFaq, ArticleTable, GuideQuote, InfoNote, PhotoBlock, StatCallout, SummaryBox, WarningCard,
} from './article-blocks'
import a from './article.module.css'

/**
 * Renders an article body (FA-1.83; restyled after docs/design/blog-2026-11/article.dc.html in
 * FA-1.97). `react-markdown` turns Markdown into React elements. There is no `rehype-raw`, and
 * `skipHtml` removes any HTML typed into a body altogether (without it the tag would be shown as
 * escaped text) — never injected, never echoed. The named blocks and the FAQ section arrive as a
 * `div` marked by `article-markdown.ts` and are replaced by their components here; nothing from the
 * body is ever rendered through `dangerouslySetInnerHTML`.
 *
 * The FAQ's answers (and intro) are Markdown too, rendered by the same components in "answer" mode:
 * no lead paragraph, no FAQ cutting of their own.
 */

/** A `data-*` attribute the article plugin put on an element (hast `dataFoo` arrives here as `data-foo`). */
function dataAttr(props: object, name: string): string | undefined {
  const value = (props as Record<string, unknown>)[name]
  return typeof value === 'string' ? value : undefined
}

const paragraphStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--article-p-size, 18px)',
  lineHeight: 'var(--article-p-lh, 1.7)',
  color: 'var(--article-p-color, #33485C)',
}

const headingBase: CSSProperties = { color: NAVY, scrollMarginTop: '6rem' }

interface Context {
  /** The article's FAQ; null for text that is itself an FAQ answer. */
  faq: ArticleFaqData | null
  country: string | null
}

function buildComponents({ faq, country }: Context): Components {
  return {
    p: props => {
      if (dataAttr(props, 'data-lead') != null) {
        return <p style={{ margin: 0, fontSize: 21, lineHeight: 1.6, color: NAVY, fontWeight: 400 }}>{props.children}</p>
      }
      return <p style={paragraphStyle}>{props.children}</p>
    },

    h2: props => (
      <h2 id={props.id} className="f-display" style={{
        ...headingBase, margin: '24px 0 0', fontWeight: 700, fontSize: 32, lineHeight: 1.15, letterSpacing: '-.01em',
      }}>
        {props.children}
      </h2>
    ),

    h3: props => (
      <h3 id={props.id} style={{ ...headingBase, margin: '8px 0 0', fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>
        {props.children}
      </h3>
    ),

    h4: props => (
      <h4 id={props.id} style={{ ...headingBase, margin: '4px 0 0', fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>
        {props.children}
      </h4>
    ),

    blockquote: props => (
      <blockquote style={{
        borderLeft: '3px solid rgba(10,46,77,0.2)', paddingLeft: '1.25rem', margin: 0,
        fontStyle: 'italic', color: MUTED,
      }}>
        {props.children}
      </blockquote>
    ),

    hr: () => <hr style={{ border: 0, borderTop: '1px solid rgba(10,46,77,0.1)', margin: '24px 0' }} />,

    a: props => {
      const href = props.href ?? ''
      // Navy with the salmon underline (the mockup's `a`); a block on a dark ground sets `--article-link`.
      const style: CSSProperties = {
        color: 'var(--article-link, #0A2E4D)', textDecoration: 'underline', textDecorationColor: SALMON, textUnderlineOffset: '3px',
      }
      if (href.startsWith('/') && !href.startsWith('//')) {
        return <Link href={href} style={style}>{props.children}</Link>
      }
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return <a href={href} style={style}>{props.children}</a>
      }
      return <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{props.children}</a>
    },

    code: props => (
      <code style={{ fontSize: '0.9em', background: 'rgba(10,46,77,0.06)', padding: '0.1em 0.35em', borderRadius: '4px' }}>
        {props.children}
      </code>
    ),

    pre: props => (
      <pre style={{ overflowX: 'auto', background: 'rgba(10,46,77,0.06)', padding: '1rem', borderRadius: '10px', margin: 0, fontSize: '13px' }}>
        {props.children}
      </pre>
    ),

    img: props => {
      const src = typeof props.src === 'string' ? props.src : ''
      if (!isSafeImageSrc(src)) return null
      return (
        // eslint-disable-next-line @next/next/no-img-element -- a Markdown image has no known size; photos with a frame use ::photo
        <img src={src} alt={props.alt ?? ''} loading="lazy" style={{ maxWidth: '100%', height: 'auto', borderRadius: '12px' }} />
      )
    },

    table: props => <ArticleTable>{props.children}</ArticleTable>,

    // The named blocks. Only the article plugin can produce a `div` — raw HTML is not parsed.
    div: props => {
      switch (dataAttr(props, 'data-block')) {
        case 'warning':
          return <WarningCard>{props.children}</WarningCard>
        case 'info':
          return <InfoNote>{props.children}</InfoNote>
        case 'summary':
          return <SummaryBox id={props.id}>{props.children}</SummaryBox>
        case 'stat':
          return (
            <StatCallout value={dataAttr(props, 'data-value') ?? ''} label={dataAttr(props, 'data-label') ?? ''}>
              {props.children}
            </StatCallout>
          )
        case 'photo':
          return (
            <PhotoBlock
              src={dataAttr(props, 'data-src') ?? ''}
              alt={dataAttr(props, 'data-alt') ?? ''}
              caption={dataAttr(props, 'data-caption')}
            />
          )
        case 'quote':
          return (
            <GuideQuote
              text={dataAttr(props, 'data-text') ?? ''}
              guide={dataAttr(props, 'data-guide') ?? ''}
              region={dataAttr(props, 'data-region') ?? ''}
            />
          )
        case 'faq':
          return faq == null ? null : <FaqBlock id={props.id ?? faq.id} faq={faq} country={country} />
        default:
          return null
      }
    },
  }
}

/** Used for FAQ answers and the FAQ intro: the same elements, none of the document-level rules. */
const answerComponents = buildComponents({ faq: null, country: null })

const ANSWER_TONES = {
  // On the open (cream) question.
  light: { '--article-p-size': '16.5px', '--article-p-lh': '1.65', '--article-p-color': MUTED },
  // Under the FAQ's title, on the grain block.
  dark: { '--article-p-size': '16px', '--article-p-lh': '1.6', '--article-p-color': ON_DARK, '--article-link': '#FFFFFF' },
} as const

function AnswerMarkdown({ markdown, tone }: { markdown: string; tone: keyof typeof ANSWER_TONES }) {
  const style = { display: 'flex', flexDirection: 'column', gap: 10, ...ANSWER_TONES[tone] } as CSSProperties
  return (
    <div className={a.body} style={style}>
      <ReactMarkdown remarkPlugins={answerRemarkPlugins} components={answerComponents} skipHtml>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

/** The article's FAQ block: the section's intro, else one line about the country, else nothing. */
function FaqBlock({ id, faq, country }: { id: string; faq: ArticleFaqData; country: string | null }) {
  const place = country?.trim() ?? ''
  const intro = faq.intro != null
    ? <AnswerMarkdown markdown={faq.intro} tone="dark" />
    : place !== ''
      ? <p className="f-body" style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: ON_DARK }}>Short answers to what anglers ask before a {place} trip.</p>
      : null

  return (
    <ArticleFaq
      id={id}
      title={faq.title}
      intro={intro}
      entries={faq.entries.map(entry => ({
        question: entry.question,
        answer: entry.answerText,
        answerContent: entry.answerMd === '' ? undefined : <AnswerMarkdown markdown={entry.answerMd} tone="light" />,
      }))}
    />
  )
}

/** `country` (the post's) only words the FAQ block's fallback intro; the editor's preview may leave it out. */
export function ArticleBody({ markdown, country = null }: { markdown: string; country?: string | null }) {
  const components = buildComponents({ faq: extractArticleFaq(markdown), country })

  return (
    <div className={a.body}>
      <ReactMarkdown remarkPlugins={articleRemarkPlugins} components={components} skipHtml>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
