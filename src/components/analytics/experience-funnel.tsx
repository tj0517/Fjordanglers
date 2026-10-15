'use client'

/**
 * The experience-page funnel in GA4 (FA-1.60): one provider per rendered page, both templates.
 *
 *   experience_view → section_view (pricing / faq / fit) → form_open → form_step … → SUBMIT_LEAD_FORM
 *
 * Every event carries `page_version` (the template rendered — v2 also on ?preview=v2) and
 * `page_slug`, so v1 and v2 are read with the same measure. Each event fires at most once
 * per page load: the guard is a ref on this provider, so it survives re-renders, the forms
 * mounting and unmounting (the v1 modal remounts on every open), and React's dev-mode
 * double effects — and it starts empty again when the visitor lands on another page.
 *
 * The forms reach it through `useExperienceFunnel()`, which returns null outside the
 * provider: `InquiryWidget` is also rendered where there is no experience page, and there
 * it keeps doing exactly what it did before.
 */

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  trackExperienceView,
  trackFormOpen,
  trackFormStep,
  trackSectionView,
  FUNNEL_SECTIONS,
  type FunnelPage,
  type FunnelSection,
  type FunnelStep,
} from '@/lib/gtag'

export interface ExperienceFunnel {
  page:     FunnelPage
  /** The same two facts as `page`, in the shape `POST /api/inquiries` stores on the inquiry. */
  inquiryFields: { page_version: 1 | 2; page_slug: string }
  /** First open of / first interaction with the inquiry form on this page load. */
  formOpen: () => void
  /** Entering a step of the form; each step index counts once per page load. */
  formStep: (step: FunnelStep) => void
}

const FunnelContext = createContext<ExperienceFunnel | null>(null)

export function useExperienceFunnel(): ExperienceFunnel | null {
  return useContext(FunnelContext)
}

/**
 * A key fires once; the same key again is a no-op. Exported for the guard's own test,
 * which is also the red proof: without it every remount of a form sends its events again.
 */
export function createOnceGuard(): (key: string, fire: () => void) => void {
  const fired = new Set<string>()
  return (key, fire) => {
    if (fired.has(key)) return
    fired.add(key)
    fire()
  }
}

/** A section counts as seen when half of it is on screen — or, when it is taller than two
 *  screens, when it fills half the screen. */
const SECTION_THRESHOLDS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]

function isHalfSeen(entry: IntersectionObserverEntry): boolean {
  if (!entry.isIntersecting) return false
  if (entry.intersectionRatio >= 0.5) return true
  const viewport = entry.rootBounds?.height ?? window.innerHeight
  return entry.intersectionRect.height >= viewport * 0.5
}

export function ExperienceFunnelProvider({
  version,
  slug,
  sections,
  children,
}: {
  version:  1 | 2
  slug:     string
  /** CSS selector of each counted section in this template; a section not on the page is skipped. */
  sections: Partial<Record<FunnelSection, string>>
  children: ReactNode
}) {
  const onceRef = useRef<ReturnType<typeof createOnceGuard> | null>(null)
  onceRef.current ??= createOnceGuard()

  const page: FunnelPage = useMemo(
    () => ({ page_version: version === 2 ? '2' : '1', page_slug: slug }),
    [version, slug],
  )

  const funnel: ExperienceFunnel = useMemo(() => ({
    page,
    inquiryFields: { page_version: version, page_slug: slug },
    formOpen: () => onceRef.current?.('form_open', () => trackFormOpen(page)),
    formStep: step => onceRef.current?.(`form_step:${step.step_index}`, () => trackFormStep(page, step)),
  }), [page, version, slug])

  useEffect(() => {
    onceRef.current?.('experience_view', () => trackExperienceView(page))
  }, [page])

  // `sections` comes from a server component, so it is one object for the life of the page.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    const watched = new Map<Element, FunnelSection>()
    for (const section of FUNNEL_SECTIONS) {
      const selector = sections[section]
      const el = selector != null ? document.querySelector(selector) : null
      if (el != null) watched.set(el, section)
    }
    if (watched.size === 0) return

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const section = watched.get(entry.target)
        if (section == null || !isHalfSeen(entry)) continue
        onceRef.current?.(`section_view:${section}`, () => trackSectionView(page, section))
        observer.unobserve(entry.target)
      }
    }, { threshold: SECTION_THRESHOLDS })

    for (const el of watched.keys()) observer.observe(el)
    return () => observer.disconnect()
  }, [page, sections])

  return <FunnelContext.Provider value={funnel}>{children}</FunnelContext.Provider>
}
