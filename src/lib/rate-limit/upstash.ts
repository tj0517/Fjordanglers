/**
 * Upstash Redis adapter (shared counters across all serverless instances, O-26).
 *
 * Fixed window, not sliding: the fixed-window script sets `PEXPIRE key window`
 * on the first request of a bucket, so a counter's TTL equals the window. The
 * sliding-window script keeps two buckets and sets a TTL of 2 x window + 1 s.
 *
 * `timeout`: if Redis is slow the library lets the request through
 * (`reason: 'timeout'`) — fail-open, O-29 a. We log that without any key.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { RateLimiter, RateLimitRule } from './types'

const REDIS_TIMEOUT_MS = 2000

export function createUpstashLimiter(url: string, token: string): RateLimiter {
  const redis    = new Redis({ url, token })
  const byRule   = new Map<string, Ratelimit>()

  function forRule(rule: RateLimitRule): Ratelimit {
    const id = `${rule.max}-${rule.windowSec}`
    let limiter = byRule.get(id)
    if (limiter == null) {
      limiter = new Ratelimit({
        redis,
        prefix:    `fa-rl-${id}`,
        limiter:   Ratelimit.fixedWindow(rule.max, `${rule.windowSec} s`),
        timeout:   REDIS_TIMEOUT_MS,
        analytics: false,
      })
      byRule.set(id, limiter)
    }
    return limiter
  }

  return {
    async limit(key, rule) {
      const res = await forRule(rule).limit(key)
      if (res.reason === 'timeout') {
        console.error('[rate-limit] limiter timed out, failing open')
      }
      return {
        allowed:       res.success,
        retryAfterSec: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
      }
    },
  }
}
