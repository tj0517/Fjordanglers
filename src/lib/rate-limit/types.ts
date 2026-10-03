/**
 * Small seam between the route and the counter store, so tests run on an
 * in-memory adapter and production runs on Upstash Redis.
 *
 * The adapter owns expiry: a counter for `key` must disappear `windowSec`
 * seconds after its first request in the window (TTL equal to the window).
 */

export interface RateLimitRule {
  /** Requests allowed per window. */
  max:       number
  /** Window length in seconds. */
  windowSec: number
}

interface RateLimitResult {
  allowed:       boolean
  /** Whole seconds until the counter resets; at least 1. */
  retryAfterSec: number
}

export interface RateLimiter {
  /** Counts one request for `key` and says whether it may proceed. */
  limit(key: string, rule: RateLimitRule): Promise<RateLimitResult>
}
