'use client'

import { useEffect } from 'react'
import { storeGclid } from '@/lib/gclid'
import { storeUtm } from '@/lib/utm'

/**
 * Captures `gclid` and `utm_*` params from the URL on first page load and
 * persists them to localStorage for 90 days so they can be attached to
 * inquiry submissions for ad-spend attribution.
 *
 * Renders nothing — place once in the root layout.
 */
export function GclidCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gclid  = params.get('gclid')
    if (gclid) storeGclid(gclid)
    storeUtm(params)
  }, [])

  return null
}
