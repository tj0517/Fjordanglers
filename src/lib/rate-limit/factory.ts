/**
 * Picks the limiter for this process: Upstash when both variables are set,
 * otherwise none (local runs and tests — the route then behaves as without a limit).
 */

import { env } from '@/lib/env'
import { createUpstashLimiter } from './upstash'
import type { RateLimiter } from './types'

let cached: RateLimiter | null | undefined

export function getRateLimiter(): RateLimiter | null {
  if (cached !== undefined) return cached

  const url   = env.UPSTASH_REDIS_REST_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN
  cached = url && token ? createUpstashLimiter(url, token) : null
  return cached
}
