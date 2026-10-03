/**
 * Picks the limiter for this process: Upstash when both variables are set and the
 * client can be created, otherwise none (local runs, tests, a malformed URL — the
 * route then behaves as without a limit, O-29 a).
 *
 * @upstash/redis throws UrlError at construction for a URL that is not `https://…`
 * (a `rediss://` connection string, a stray space) and its message embeds the URL,
 * credentials included. So a creation failure is logged as one fixed line — never
 * the error text — and the outcome is cached, so it neither throws out of the
 * route nor repeats on every request.
 */

import { env } from '@/lib/env'
import { createUpstashLimiter } from './upstash'
import type { RateLimiter } from './types'

let cached: RateLimiter | null | undefined

export function getRateLimiter(): RateLimiter | null {
  if (cached !== undefined) return cached

  const url   = env.UPSTASH_REDIS_REST_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    cached = null
    return cached
  }

  try {
    cached = createUpstashLimiter(url, token)
  } catch {
    console.error('[rate-limit] could not create limiter, running without a limit')
    cached = null
  }
  return cached
}
