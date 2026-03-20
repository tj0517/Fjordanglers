'use client'

/**
 * NavigationShortcuts — invisible component that binds ← / → arrow keys
 * to guide prev/next navigation between inquiries.
 *
 * Usage: mount in a Server Component, pass prevHref / nextHref.
 * Skips the shortcut when focus is on an input / textarea / select.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  prevHref: string | null
  nextHref: string | null
}

export default function NavigationShortcuts({ prevHref, nextHref }: Props) {
  const router = useRouter()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't fire when the guide is typing in a form
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return

      if (e.key === 'ArrowLeft'  && prevHref != null) router.push(prevHref)
      if (e.key === 'ArrowRight' && nextHref != null) router.push(nextHref)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [prevHref, nextHref, router])

  return null
}
