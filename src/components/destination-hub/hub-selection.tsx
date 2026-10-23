'use client'

/**
 * The link between the hub's map and its cards (FA-1.66): a pin click selects an offer, the
 * cards scroll to it and highlight it. The selection clears itself after a few seconds, so
 * the highlight is a moment, not a state. `seq` makes a second click on the same pin count.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type HubSelected = { slug: string; seq: number }

type HubSelection = {
  selected: HubSelected | null
  select:   (slug: string) => void
}

const HIGHLIGHT_MS = 4000

const HubSelectionContext = createContext<HubSelection | null>(null)

export function useHubSelection(): HubSelection | null {
  return useContext(HubSelectionContext)
}

export function HubSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<HubSelected | null>(null)
  const seqRef = useRef(0)

  const select = useCallback((slug: string) => {
    seqRef.current += 1
    setSelected({ slug, seq: seqRef.current })
  }, [])

  useEffect(() => {
    if (selected == null) return
    const timer = setTimeout(() => setSelected(null), HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [selected])

  const value = useMemo(() => ({ selected, select }), [selected, select])

  return <HubSelectionContext.Provider value={value}>{children}</HubSelectionContext.Provider>
}
