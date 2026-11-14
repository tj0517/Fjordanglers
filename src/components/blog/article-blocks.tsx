import Image from 'next/image'

/**
 * Presentational pieces of a blog article (FA-1.83): the four named blocks of the article format
 * (warning, info, stat, photo), the breakout table and one image component. They were inline in the
 * Norway article's JSX; the article body is Markdown now and `article-body.tsx` maps to these.
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
  className?: string
  style?: React.CSSProperties
}

/** Fills its (positioned) parent. An https host `next/image` does not know falls back to a plain <img>, never a crash. */
export function BlogImage({ src, alt, priority, fetchPriority, className, style }: BlogImageProps) {
  if (canOptimise(src)) {
    return <Image src={src} alt={alt} fill priority={priority} fetchPriority={fetchPriority} className={className} style={style} />
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
 * The article's paragraphs read `--article-p-*` (see article-body.tsx), so a block restyles the
 * paragraphs it contains without the Markdown knowing about the block: smaller text, no bottom margin.
 */
function blockText(o: { size: string; lineHeight: number; color: string; fontStyle?: string }): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    '--article-p-size': o.size,
    '--article-p-lh': String(o.lineHeight),
    '--article-p-color': o.color,
    '--article-p-mb': '0',
    '--article-p-style': o.fontStyle ?? 'normal',
  } as React.CSSProperties
}

export function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(27,79,114,0.06)',
      border: '1px solid rgba(27,79,114,0.15)',
      borderLeft: '3px solid #1B4F72',
      borderRadius: '0 10px 10px 0',
      padding: '1rem 1.25rem',
      marginBottom: '1.5rem',
    }}>
      <div style={blockText({ size: '14px', lineHeight: 1.7, color: 'rgba(10,46,77,0.7)', fontStyle: 'italic' })}>
        {children}
      </div>
    </div>
  )
}

export function WarningCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(230,126,80,0.08)',
      border: '1px solid rgba(230,126,80,0.25)',
      borderLeft: '3px solid #E67E50',
      borderRadius: '0 10px 10px 0',
      padding: '1.25rem 1.5rem',
      marginBottom: '2rem',
      marginTop: '1rem',
    }}>
      <div style={blockText({ size: '14px', lineHeight: 1.75, color: 'rgba(10,46,77,0.7)' })}>
        {children}
      </div>
    </div>
  )
}

export function StatCallout({ value, label, children }: { value: string; label: string; children?: React.ReactNode }) {
  return (
    <div style={{
      background: '#0A2E4D',
      borderRadius: '16px',
      padding: '2rem 2.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '2rem',
      marginTop: '0.5rem',
      marginBottom: '2rem',
      flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontSize: 'clamp(40px, 6vw, 56px)', fontWeight: 800, color: '#E67E50', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>{label}</div>
      </div>
      <div style={{ flex: 1, minWidth: '200px', ...blockText({ size: '14px', lineHeight: 1.75, color: 'rgba(255,255,255,0.65)' }) }}>
        {children}
      </div>
    </div>
  )
}

export function PhotoBlock({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure style={{ margin: '2.5rem -2rem' }}>
      <div style={{
        position: 'relative',
        height: 'clamp(220px, 35vw, 400px)',
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#0A2E4D',
      }}>
        <BlogImage src={src} alt={alt} className="object-cover" style={{ opacity: 0.85 }} />
      </div>
      {caption != null && caption !== '' && (
        <figcaption style={{
          fontSize: '12px',
          color: 'rgba(10,46,77,0.4)',
          textAlign: 'center',
          marginTop: '0.75rem',
          fontStyle: 'italic',
          lineHeight: 1.6,
          padding: '0 1rem',
        }}>
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

export function BreakoutTable({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: '0 -2rem 2.5rem', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '16px', overflow: 'hidden', fontSize: '14px' }}>
        {children}
      </table>
    </div>
  )
}
