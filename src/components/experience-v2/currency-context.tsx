'use client'

/**
 * The visitor's chosen display currency, shared between the top bar (S0) that picks it
 * and the widget (S2) that prints "≈ USD · indicative rate" (FA-1.53).
 *
 * Rates arrive already computed, from the server — `fetchIndicativeRates()` in
 * src/lib/fx.ts turns frankfurter's EUR-only quotes into page-currency → X. Only
 * currencies whose rate actually came back are offered, so the picker can never
 * select something that would print nothing.
 *
 * This is display only. Nothing here is stored and nothing is charged from it: the
 * deposit goes through Stripe in EUR (ADR-0001).
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { fmtIndicative } from '@/lib/fx'

type CurrencyContextValue = {
  /** The page's own currency — what every real number on the page is in. */
  baseCurrency: string
  /** The currency the "≈" line is shown in; equal to `baseCurrency` means no line. */
  display:      string
  setDisplay:   (currency: string) => void
  /** Currencies with a usable rate, base first. */
  available:    string[]
  /** "≈ $890" for an amount in the page's currency, or null when there is nothing to add. */
  indicative:   (cents: number) => string | null
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({
  baseCurrency,
  rates,
  children,
}: {
  baseCurrency: string
  /** page currency → target currency, from `fetchIndicativeRates()`. */
  rates:        Record<string, number>
  children:     ReactNode
}) {
  const available = useMemo(() => {
    const others = Object.keys(rates).filter(c => c !== baseCurrency).sort()
    return [baseCurrency, ...others]
  }, [rates, baseCurrency])

  // Starts on the page's own currency: the exact number first, the courtesy second.
  const [display, setDisplay] = useState(baseCurrency)

  const value = useMemo<CurrencyContextValue>(() => ({
    baseCurrency,
    display,
    setDisplay,
    available,
    indicative: (cents: number) => {
      if (display === baseCurrency) return null
      const rate = rates[display]
      if (rate == null) return null
      return fmtIndicative(cents, rate, display)
    },
  }), [baseCurrency, display, available, rates])

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

/**
 * Throws when used outside the provider — a silent fallback here would mean a page that
 * quietly stops converting, which is exactly the bug nobody notices.
 */
export function useCurrency(): CurrencyContextValue {
  const value = useContext(CurrencyContext)
  if (value == null) throw new Error('useCurrency must be used inside <CurrencyProvider>')
  return value
}
