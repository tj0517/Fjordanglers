'use client'

/**
 * <FbEvent> — fire a Meta Pixel standard event on mount from a Server Component.
 *
 * Usage:
 *   <FbEvent event="Lead" params={{ value: 299, currency: 'EUR' }} />
 *   <FbEvent event="Purchase" params={{ value: 65, currency: 'EUR' }} />
 *
 * Renders nothing visible. Fires exactly once when the component mounts.
 */

import { useEffect } from 'react'
import { fbqEvent } from '@/lib/fbq'

type Props = {
  event: string
  params?: Record<string, unknown>
}

export function FbEvent({ event, params }: Props) {
  useEffect(() => {
    fbqEvent(event, params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
