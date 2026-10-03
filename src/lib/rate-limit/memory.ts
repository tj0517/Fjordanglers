/**
 * In-memory fixed-window adapter. Same semantics as the Upstash adapter
 * (fixed window, reset at the end of the bucket), with an injectable clock.
 * Used by tests; production never imports it.
 */

import type { RateLimiter } from './types'

export function createMemoryLimiter(now: () => number = Date.now): RateLimiter {
  const counts = new Map<string, number>()

  return {
    async limit(key, rule) {
      const windowMs = rule.windowSec * 1000
      const t        = now()
      const bucket   = Math.floor(t / windowMs)
      const id       = `${key}:${bucket}`

      const count = (counts.get(id) ?? 0) + 1
      counts.set(id, count)

      return {
        allowed:       count <= rule.max,
        retryAfterSec: Math.max(1, Math.ceil(((bucket + 1) * windowMs - t) / 1000)),
      }
    },
  }
}
