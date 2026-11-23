import Image from 'next/image'
import type { CSSProperties, ReactNode } from 'react'
import { FaqList, type FaqEntry } from '@/components/site/faq'
import { MUTED, NAVY, ON_DARK, SALMON_ON_DARK, SectionHeading } from '@/components/site/ui'
import g from '@/components/site/grain.module.css'
import a from './article.module.css'

/**
 * Presentational pieces of a blog article (FA-1.83, restyled FA-1.97 after docs/design/blog-2026-11/
 * article.dc.html): the named blocks of the article format (info, warning, stat, photo, summary,
 * quote), the table frame, the FAQ section and one image component. The article body is Markdown;
 * `article-body.tsx` maps the plugin's markers to these.
 */

// ─── Image ────────────────────────────────────────────────────────────────────

/** Sources `next/image` is configured for (next.config.ts): site paths, Unsplash, Supabase Storage. */
function canOptimise(src: string): boolean {
  if (src.startsWith('/')) return true
  try {
    const u = new URL(src)
    return (
      u.hostname === 'images.unsplash.com' ||
      (u.hostname.endsWith('.supabase.co') && /^\/storage\/v1\/(object|render\/image)\/public\//.test(u.pathname))
    )
  } catch {
    return false
  }
}

interface BlogImageProps {
  src: string
  alt: string
  priority?: boolean
  /** 'high' on the page's LCP image only. Next 16's `priority` preloads but sends no fetchpriority (FA-1.92). */
  fetchPriority?: 'high'
  /** What the browser should pick from the srcset; without it `next/image` assumes the full viewport width. */
  sizes?: string
  className?: string
  style?: CSSProperties
}

/** Fills its (positioned) parent. An https host `next/image` does not know falls back to a plain <img>, never a crash. */
export function BlogImage({ src, alt, priority, fetchPriority, sizes, className, style }: BlogImageProps) {
  if (canOptimise(src)) {
    return <Image src={src} alt={alt} fill priority={priority} fetchPriority={fetchPriority} sizes={sizes} className={className} style={style} />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- host is not in next.config images.remotePatterns
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={fetchPriority}
      className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', ...style }}
    />
  )
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

/**
 * The article's paragraphs and list items read `--article-p-*` (see article.module.css and
 * article-body.tsx), so a block restyles what it contains without the Markdown knowing about the
 * block: its own size and colour, tight spacing between its paragraphs.
 */
function blockText(o: { size: string; lineHeight: number; color: string }): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    minWidth: 0,
    '--article-p-size': o.size,
    '--article-p-lh': String(o.lineHeight),
    '--article-p-color': o.color,
  } as CSSProperties
}

const calloutBox: CSSProperties = { display: 'flex', gap: 16, padding: '22px 24px', borderRadius: 16 }
const calloutIcon: CSSProperties = { flex: 'none', marginTop: 2 }

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <aside style={{ ...calloutBox, background: '#E9EEF0', border: '1px solid #CBD6DD' }}>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2" strokeLinecap="round" style={calloutIcon}>
        <circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.5v.5" />
      </svg>
      <div style={blockText({ size: '16.5px', lineHeight: 1.6, color: NAVY })}>{children}</div>
    </aside>
  )
}

export function WarningCard({ children }: { children: ReactNode }) {
  return (
    <aside style={{ ...calloutBox, background: '#FBE9DF', border: '1px solid #F2B99D' }}>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C4561F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={calloutIcon}>
        <path d="M12 3 2.5 20h19L12 3z" /><path d="M12 10v5" /><path d="M12 17.5v.5" />
      </svg>
      <div style={blockText({ size: '16.5px', lineHeight: 1.6, color: NAVY })}>{children}</div>
    </aside>
  )
}

export function StatCallout({ value, label, children }: { value: string; label: string; children?: ReactNode }) {
  return (
    <aside
      className={`${g.blur} ${g.fjord}`}
      style={{ borderRadius: 20, padding: '36px clamp(24px, 4vw, 44px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px 40px' }}
    >
      <p style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="f-display" style={{ fontWeight: 400, fontSize: 'clamp(48px, 7vw, 68px)', lineHeight: 1, letterSpacing: '-.02em', color: '#FFFFFF' }}>
          {value}
        </span>
        <span className="f-body" style={{ fontSize: 14, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: SALMON_ON_DARK }}>
          {label}
        </span>
      </p>
      <div style={{ flex: '1 1 260px', ...blockText({ size: '17px', lineHeight: 1.6, color: ON_DARK }) }}>{children}</div>
    </aside>
  )
}

export function PhotoBlock({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure style={{ margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ position: 'relative', aspectRatio: '16 / 10', borderRadius: 16, overflow: 'hidden', background: NAVY }}>
        <BlogImage src={src} alt={alt} sizes="(min-width: 1024px) 760px, 100vw" className="object-cover" />
      </div>
      {caption != null && caption !== '' && (
        <figcaption className="f-body" style={{ fontSize: 14, color: MUTED }}>{caption}</figcaption>
      )}
    </figure>
  )
}

/** The "In short" box: the Markdown inside (a bullet list) is drawn by `article.module.css`. */
export function SummaryBox({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <aside id={id} aria-label="In short" className={a.summary} style={{ scrollMarginTop: '6rem' }}>
      <p className="f-body" style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#E67E50' }}>
        In short
      </p>
      {children}
    </aside>
  )
}

/** A guide's own words, on the guide photo's grain block. Name and region are optional; both empty = no caption. */
export function GuideQuote({ text, guide, region }: { text: string; guide: string; region: string }) {
  const who = [guide, region].filter(part => part !== '').join(', ')
  return (
    <figure
      className={`${g.blur} ${g.guide}`}
      style={{ margin: 0, borderRadius: 20, padding: '44px clamp(24px, 4vw, 48px)', display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <blockquote
        className="f-display"
        style={{ margin: 0, fontWeight: 400, fontStyle: 'italic', fontSize: 'clamp(24px, 3vw, 30px)', lineHeight: 1.3, color: '#FFFFFF' }}
      >
        {text}
      </blockquote>
      {who !== '' && (
        <figcaption className="f-body" style={{ fontSize: 15, fontWeight: 600, color: SALMON_ON_DARK }}>{who}</figcaption>
      )}
    </figure>
  )
}

export function ArticleTable({ children }: { children: ReactNode }) {
  return (
    <div className={a.tableWrap}>
      <table>{children}</table>
    </div>
  )
}

/**
 * The FAQ section the body's `## FAQ…` becomes: grain block, the title and intro on the left, the
 * questions as the site's FAQ list on the right. `id` is the heading's, so the table of contents
 * link lands here. The answers arrive rendered (`answerContent`), the intro too.
 */
export function ArticleFaq({ id, title, intro, entries }: { id: string; title: string; intro: ReactNode; entries: readonly FaqEntry[] }) {
  return (
    <section
      id={id}
      data-block="article-faq"
      className={`${g.blur} ${g.iceland} flex scroll-mt-24 flex-wrap items-start gap-x-12 gap-y-7`}
      style={{ borderRadius: 24, padding: 'clamp(20px, 4vw, 48px)', marginTop: 24 }}
    >
      <div className="flex max-w-[360px] flex-[1_1_240px] flex-col gap-[14px] pt-2">
        <SectionHeading eyebrow="FAQ" title={title} dark size={38}>{intro}</SectionHeading>
      </div>
      <FaqList entries={entries} />
    </section>
  )
}
