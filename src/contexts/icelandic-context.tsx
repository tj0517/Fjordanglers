'use client'

/**
 * IcelandicBookingContext — shared state for the Icelandic inquiry flow
 * on /trips/[id].
 *
 * The IcelandicBookingProvider wraps both the left-column calendar section
 * (IcelandicAvailabilitySection) and the right-column widget (IcelandicInquiryWidget)
 * so they share the same periods/guests state.
 *
 * MaybeIcelandicProvider is a convenience wrapper used by the page:
 * when enabled=true it provides the context; otherwise it renders children as-is.
 */

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'
import {
  type Period,
  buildBlockedSet,
  rangesOverlap,
} from '@/components/trips/icelandic-inquiry-widget'

// ─── Context type ─────────────────────────────────────────────────────────────

interface IcelandicBookingState {
  periods:          Period[]
  pendingFrom:      string | null
  hoverDate:        string | null
  guests:           number
  durationDays:     number
  blockedSet:       Set<string>
  maxGuests:        number
  handleDayClick:   (date: string) => void
  setHoverDate:     (date: string | null) => void
  setGuests:        (guests: number) => void
  setDurationDays:  (n: number) => void
  clearAll:         () => void
}

const Ctx = createContext<IcelandicBookingState | null>(null)

// ─── IcelandicBookingProvider ─────────────────────────────────────────────────

export function IcelandicBookingProvider({
  blockedRanges,
  maxGuests,
  children,
}: {
  blockedRanges: Array<{ date_start: string; date_end: string }>
  maxGuests:     number
  children:      ReactNode
}) {
  const blockedSet = useMemo(() => buildBlockedSet(blockedRanges), [blockedRanges])

  const [periods,      setPeriods]     = useState<Period[]>([])
  const [pendingFrom,  setPendingFrom] = useState<string | null>(null)
  const [hoverDate,    setHoverDate]   = useState<string | null>(null)
  const [guests,       setGuestsRaw]   = useState(1)
  const [durationDays, setDurationRaw] = useState(1)

  function handleDayClick(date: string) {
    if (pendingFrom === null) {
      // Click on a confirmed edge → remove that period
      const toRemove = periods.find(p => p.from === date || p.to === date)
      if (toRemove != null) {
        setPeriods(prev => prev.filter(p => p.key !== toRemove.key))
        return
      }
      // Click on an inner date → no-op
      if (periods.some(p => date > p.from && date < p.to)) return
      // Free date → begin selection
      setPendingFrom(date)
      setHoverDate(null)
    } else if (pendingFrom === date) {
      // Same date twice → single-day period
      const overlaps = periods.some(p => rangesOverlap(date, date, p.from, p.to))
      if (!overlaps) setPeriods(prev => [...prev, { key: crypto.randomUUID(), from: date, to: date }])
      setPendingFrom(null)
      setHoverDate(null)
    } else {
      // Different date → range period
      const from = pendingFrom <= date ? pendingFrom : date
      const to   = pendingFrom <= date ? date        : pendingFrom
      const overlaps = periods.some(p => rangesOverlap(from, to, p.from, p.to))
      if (!overlaps) setPeriods(prev => [...prev, { key: crypto.randomUUID(), from, to }])
      setPendingFrom(null)
      setHoverDate(null)
    }
  }

  function setGuests(n: number) {
    setGuestsRaw(Math.max(1, Math.min(n, maxGuests)))
  }

  function setDurationDays(n: number) {
    setDurationRaw(Math.max(1, Math.min(n, 30)))
  }

  function clearAll() {
    setPeriods([])
    setPendingFrom(null)
    setHoverDate(null)
  }

  return (
    <Ctx.Provider value={{
      periods, pendingFrom, hoverDate, guests, durationDays, blockedSet, maxGuests,
      handleDayClick, setHoverDate, setGuests, setDurationDays, clearAll,
    }}>
      {children}
    </Ctx.Provider>
  )
}

// ─── MaybeIcelandicProvider ───────────────────────────────────────────────────
// Conditionally wraps children with IcelandicBookingProvider.
// When enabled=false, renders children directly (no context overhead).

export function MaybeIcelandicProvider({
  enabled,
  blockedRanges,
  maxGuests,
  children,
}: {
  enabled:       boolean
  blockedRanges: Array<{ date_start: string; date_end: string }>
  maxGuests:     number
  children:      ReactNode
}) {
  if (!enabled) return <>{children}</>
  return (
    <IcelandicBookingProvider blockedRanges={blockedRanges} maxGuests={maxGuests}>
      {children}
    </IcelandicBookingProvider>
  )
}

// ─── useIcelandicBooking ──────────────────────────────────────────────────────

export function useIcelandicBooking(): IcelandicBookingState {
  const ctx = useContext(Ctx)
  if (ctx == null) throw new Error('useIcelandicBooking must be used within IcelandicBookingProvider')
  return ctx
}
