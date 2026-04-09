'use client'

/**
 * BookingStateContext — shared state between the left-column interactive elements
 * (DurationCardsSelector, AvailabilityCalendarBanner) and the right-column BookingWidget.
 *
 * Wrap the two-column trip-detail layout with <BookingStateProvider> in page.tsx.
 * All client components in that subtree can call useBookingState() to read/write.
 */

import { createContext, useContext, useState } from 'react'
import type { DurationOptionPayload } from '@/actions/experiences'

// ─── Context value ────────────────────────────────────────────────────────────

export type BookingContextValue = {
  /** Sorted array of selected YYYY-MM-DD strings */
  selectedDates: string[]
  /** Toggle a single date in/out of selectedDates */
  toggleDate: (date: string) => void
  /** Replace all selected dates at once (used for multi-day range expansion) */
  selectDates: (dates: string[]) => void
  /** Clear all selected dates */
  clearDates: () => void
  /** Currently selected duration package (null = no packages on this trip) */
  selectedPkg: DurationOptionPayload | null
  /** Set selected package — also clears dates (date validity depends on package) */
  setSelectedPkg: (pkg: DurationOptionPayload | null) => void
}

const BookingContext = createContext<BookingContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BookingStateProvider({
  children,
  initialPkg,
}: {
  children: React.ReactNode
  /** First duration option from the experience (or null if none) */
  initialPkg: DurationOptionPayload | null
}) {
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [selectedPkg, _setSelectedPkg]    = useState<DurationOptionPayload | null>(initialPkg)

  function toggleDate(date: string) {
    setSelectedDates(prev =>
      prev.includes(date)
        ? prev.filter(d => d !== date)
        : [...prev, date].sort(),
    )
  }

  function selectDates(dates: string[]) {
    setSelectedDates([...dates].sort())
  }

  function clearDates() {
    setSelectedDates([])
  }

  function setSelectedPkg(pkg: DurationOptionPayload | null) {
    _setSelectedPkg(pkg)
    // Changing package invalidates any selected dates
    setSelectedDates([])
  }

  return (
    <BookingContext.Provider value={{ selectedDates, toggleDate, selectDates, clearDates, selectedPkg, setSelectedPkg }}>
      {children}
    </BookingContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBookingState(): BookingContextValue {
  const ctx = useContext(BookingContext)
  if (ctx == null) throw new Error('useBookingState must be used within <BookingStateProvider>')
  return ctx
}
