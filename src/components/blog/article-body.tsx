import Link from 'next/link'
import ReactMarkdown, { type Components } from 'react-markdown'
import { articleRemarkPlugins, isSafeImageSrc } from '@/lib/blog/article-markdown'
import { BreakoutTable, InfoNote, PhotoBlock, StatCallout, WarningCard } from './article-blocks'

/**
 * Renders an article body (FA-1.83). `react-markdown` turns Markdown into React elements. There is
 * no `rehype-raw`, and `skipHtml` removes any HTML typed into a body altogether (without it the tag
 * would be shown as escaped text) — never injected, never echoed. The four named blocks arrive as a `div` marked by `article-markdown.ts` and are
 * replaced by their components here; nothing from the body is ever rendered through
 * `dangerouslySetInnerHTML`. Typography is the Norway article's, element by element.
 */

/** A `data-*` attribute the article plugin put on an element (hast `dataFoo` arrives here as `data-foo`). */
function dataAttr(props: object, name: string): string | undefined {
  const value = (props as Record<string, unknown>)[name]
  return typeof value === 'string' ? value : undefined
}

const liStyle: React.CSSProperties = { fontSize: '15px', lineHeight: 1.8, color: 'rgba(10,46,77,0.65)' }

const tdStyle: React.CSSProperties = {
  padding: '14px 20px', fontSize: '14px', lineHeight: 1.65,
  color: 'rgba(10,46,77,0.68)', verticalAlign: 'top',
  borderBottom: '1px solid rgba(10,46,77,0.07)',
}

const components: Components = {
  p: props => {
    if (dataAttr(props, 'data-lead') != null) {
      return (
        <p style={{ fontSize: '20px', lineHeight: 1.75, color: '#0A2E4D', marginBottom: '1.5rem', fontWeight: 400 }}>
          {props.children}
        </p>
      )
    }
    return (
      <p style={{
        fontSize: 'var(--article-p-size, 16px)',
        lineHeight: 'var(--article-p-lh, 1.85)',
        color: 'var(--article-p-color, rgba(10,46,77,0.65))',
        fontStyle: 'var(--article-p-style, normal)',
        marginBottom: 'var(--article-p-mb, 1.25rem)',
      }}>
        {props.children}
      </p>
    )
  },

  h2: props => (
    <h2 id={props.id} style={{
      fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, color: '#0A2E4D',
      lineHeight: 1.2, marginBottom: '1.25rem', marginTop: '3.5rem',
      scrollMarginTop: '6rem',
    }}>
      {props.children}
    </h2>
  ),

  h3: props => (
    <h3 id={props.id} style={{
      fontSize: '17px', fontWeight: 700, color: '#0A2E4D',
      lineHeight: 1.35, marginBottom: '0.75rem', marginTop: '2rem', scrollMarginTop: '6rem',
    }}>
      {props.children}
    </h3>
  ),

  h4: props => (
    <h4 id={props.id} style={{
      fontSize: '15px', fontWeight: 700, color: '#0A2E4D',
      lineHeight: 1.4, marginBottom: '0.5rem', marginTop: '1.5rem', scrollMarginTop: '6rem',
    }}>
      {props.children}
    </h4>
  ),

  ul: props => (
    <ul style={{ paddingLeft: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyleType: 'disc' }}>
      {props.children}
    </ul>
  ),

  ol: props => (
    <ol style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', listStyleType: 'decimal' }}>
      {props.children}
    </ol>
  ),

  li: props => <li style={{ ...liStyle, paddingLeft: '0.25rem' }}>{props.children}</li>,

  blockquote: props => (
    <blockquote style={{
      borderLeft: '3px solid rgba(10,46,77,0.2)', paddingLeft: '1.25rem', margin: '0 0 1.5rem',
      fontStyle: 'italic', color: 'rgba(10,46,77,0.65)',
    }}>
      {props.children}
    </blockquote>
  ),

  hr: () => <hr style={{ border: 0, borderTop: '1px solid rgba(10,46,77,0.1)', margin: '3rem 0' }} />,

  strong: props => {
    const label = dataAttr(props, 'data-label')
    if (label != null) {
      return <strong style={{ fontStyle: 'normal', color: label === 'warning' ? '#E67E50' : '#1B4F72' }}>{props.children}</strong>
    }
    return <strong>{props.children}</strong>
  },

  a: props => {
    const href = props.href ?? ''
    const style: React.CSSProperties = { color: '#1B4F72', textDecoration: 'underline', textUnderlineOffset: '3px' }
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
    <pre style={{ overflowX: 'auto', background: 'rgba(10,46,77,0.06)', padding: '1rem', borderRadius: '10px', marginBottom: '1.5rem', fontSize: '13px' }}>
      {props.children}
    </pre>
  ),

  img: props => {
    const src = typeof props.src === 'string' ? props.src : ''
    if (!isSafeImageSrc(src)) return null
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a Markdown image has no known size; photos with a frame use ::photo
      <img src={src} alt={props.alt ?? ''} loading="lazy" style={{ maxWidth: '100%', height: 'auto', borderRadius: '12px', margin: '1.5rem 0' }} />
    )
  },

  table: props => <BreakoutTable>{props.children}</BreakoutTable>,
  thead: props => <thead style={{ background: '#0A2E4D' }}>{props.children}</thead>,
  th: props => (
    <th style={{
      padding: '14px 20px', textAlign: 'left', color: '#fff',
      fontWeight: 600, fontSize: '13px', letterSpacing: '0.02em',
    }}>
      {props.children}
    </th>
  ),
  td: props => <td style={tdStyle}>{props.children}</td>,

  // The named blocks. Only the article plugin can produce a `div` — raw HTML is not parsed.
  div: props => {
    switch (dataAttr(props, 'data-block')) {
      case 'warning':
        return <WarningCard>{props.children}</WarningCard>
      case 'info':
        return <InfoNote>{props.children}</InfoNote>
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
      default:
        return null
    }
  },
}

// Alternate row shading — a fixed string, no data in it.
const TABLE_CSS = '.fa-article tbody tr:nth-child(odd){background:#FDFAF7}.fa-article tbody tr:nth-child(even){background:rgba(243,237,228,0.6)}'

export function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <article className="fa-article">
      <style>{TABLE_CSS}</style>
      <ReactMarkdown remarkPlugins={articleRemarkPlugins} components={components} skipHtml>
        {markdown}
      </ReactMarkdown>
    </article>
  )
}
