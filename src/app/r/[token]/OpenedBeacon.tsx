'use client'

import { useEffect } from 'react'
import { markRequestOpened } from './actions'

/**
 * Records the opening once the page has rendered in a browser (tj D1 a). A link preview fetch
 * reads the HTML but runs no effects, so it never counts as an opening.
 */
export function OpenedBeacon({ token }: { token: string }) {
  useEffect(() => {
    markRequestOpened(token).catch(() => {
      // Not the guide's problem: the page works without it; the server logged the cause.
    })
  }, [token])
  return null
}
