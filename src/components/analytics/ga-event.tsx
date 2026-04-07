'use client'

/**
 * <GaEvent> — fire a GA4 event on mount from a Server Component.
 *
 * Usage (inside any server page/layout):
 *   <GaEvent action="qualify_lead" params={{ value: 299, currency: 'EUR' }} />
 *
 * Renders nothing visible. Fires exactly once when the component mounts.
 */

import { useEffect } from 'react'
import { gtagEvent } from '@/lib/gtag'

type Props = {
  action: string
  params?: Record<string, unknown>
}

export function GaEvent({ action, params = {} }: Props) {
  useEffect(() => {
    gtagEvent(action, params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
