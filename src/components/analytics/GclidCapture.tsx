'use client'

import { useEffect } from 'react'
import { storeGclid } from '@/lib/gclid'

/**
 * Captures `gclid` from the URL on first page load and persists it to
 * localStorage for 90 days so it can be attached to inquiry submissions
 * for offline conversion import into Google Ads.
 *
 * Renders nothing — place once in the root layout.
 */
export function GclidCapture() {
  useEffect(() => {
    const gclid = new URLSearchParams(window.location.search).get('gclid')
    if (gclid) storeGclid(gclid)
  }, [])

  return null
}
