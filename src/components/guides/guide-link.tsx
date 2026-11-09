import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { guideProfilePath } from '@/lib/guide-url'

/**
 * A card that links to a guide's public profile. A guide without a slug gets the same card
 * as a plain block — never a link to a UUID, `/guides/null` or `/guides/undefined` (FA-1.86).
 */
export function GuideLink({
  slug,
  className,
  style,
  children,
}: {
  slug: string | null | undefined
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const href = guideProfilePath({ slug })
  if (href == null) {
    return <div className={className} style={style} data-guide-link="none">{children}</div>
  }
  return <Link href={href} className={className} style={style}>{children}</Link>
}
