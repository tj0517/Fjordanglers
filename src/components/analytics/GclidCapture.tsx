'use client'

import { useEffect } from 'react'
import { storeGclid } from '@/lib/gclid'
import { storeUtm } from '@/lib/utm'
import { storeFirstTouchOnce } from '@/lib/first-touch'

/**
 * Captures `gclid` and `utm_*` params from the URL on first page load and
 * persists them to localStorage for 90 days so they can be attached to
 * inquiry submissions for ad-spend attribution.
 *
 * FA-1.87: also records the first touch (referrer host, landing path, time) once —
 * see src/lib/first-touch.ts. This runs on a full page load only, which is what a first
 * visit always is.
 *
 * Renders nothing — place once in the root layout.
 */
export function GclidCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gclid  = params.get('gclid')
    if (gclid) storeGclid(gclid)
    storeUtm(params)
    storeFirstTouchOnce(document.referrer, window.location)
  }, [])

  return null
}
