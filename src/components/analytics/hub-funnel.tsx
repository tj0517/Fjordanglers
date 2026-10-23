'use client'

/**
 * The country hub in GA4 (FA-1.66): one provider per hub page.
 *
 *   hub_view → section_view (season / trips / faq / reviews) → hub_card_click → experience_view …
 *
 * Every event carries the hub's `page_slug` and goes to GA4 (`send_to`), like the
 * experience-page funnel (./experience-funnel.tsx), whose guard and "half seen" rule it uses.
 * `hub_view` and each `section_view` fire at most once per page load. The guard is the only
 * thing that stops a repeat — the observer keeps watching a section after it was counted — so
 * taking the guard out sends a `section_view` again every time the visitor comes back to it.
 * A card click is counted every time: it leaves the page.
 *
 * The cards reach it through `useHubFunnel()`, which returns null outside the provider.
 */

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  trackHubCardClick,
  trackHubSectionView,
  trackHubView,
  HUB_SECTIONS,
  type HubPage,
  type HubSection,
} from '@/lib/gtag'
import { createOnceGuard, isHalfSeen, SECTION_THRESHOLDS } from './experience-funnel'

export interface HubFunnel {
  /** A click on an offer card; `position` is its 1-based slot among the cards shown. */
  cardClick: (experienceSlug: string, position: number) => void
}

const HubFunnelContext = createContext<HubFunnel | null>(null)

export function useHubFunnel(): HubFunnel | null {
  return useContext(HubFunnelContext)
}

export function HubFunnelProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const onceRef = useRef<ReturnType<typeof createOnceGuard> | null>(null)
  onceRef.current ??= createOnceGuard()

  const page: HubPage = useMemo(() => ({ page_slug: slug }), [slug])

  const funnel: HubFunnel = useMemo(() => ({
    cardClick: (experienceSlug, position) =>
      trackHubCardClick(page, { experience_slug: experienceSlug, position }),
  }), [page])

  useEffect(() => {
    onceRef.current?.('hub_view', () => trackHubView(page))
  }, [page])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    const watched = new Map<Element, HubSection>()
    for (const section of HUB_SECTIONS) {
      const el = document.querySelector(`[data-section="${section}"]`)
      if (el != null) watched.set(el, section)
    }
    if (watched.size === 0) return

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const section = watched.get(entry.target)
        if (section == null || !isHalfSeen(entry)) continue
        onceRef.current?.(`section_view:${section}`, () => trackHubSectionView(page, section))
      }
    }, { threshold: SECTION_THRESHOLDS })

    for (const el of watched.keys()) observer.observe(el)
    return () => observer.disconnect()
  }, [page])

  return <HubFunnelContext.Provider value={funnel}>{children}</HubFunnelContext.Provider>
}
