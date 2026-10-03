/**
 * Rate limits for the public POST /api/inquiries (FA-1.41).
 *
 * Counter keys are HMAC-SHA256(RATE_LIMIT_SALT, kind + value): the client IP and
 * the e-mail address never reach Redis or a log line in clear. The adapter
 * expires each counter after the window.
 *
 * Fail-open (O-29 a): no limiter, no salt, a missing/invalid IP header or an
 * adapter error all mean "let the request through". Logs carry no IP or e-mail.
 */

import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { env } from '@/lib/env'
import { getRateLimiter } from './factory'
import type { RateLimiter, RateLimitRule } from './types'

/** Starting thresholds (tj, 2026-10-02). The only place they are defined. */
export const INQUIRY_LIMITS = {
  ip:    { max: 5, windowSec: 10 * 60 },
  email: { max: 3, windowSec: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>

export type RateLimitDecision =
  | { blocked: false }
  | { blocked: true; retryAfterSec: number }

const ALLOWED: RateLimitDecision = { blocked: false }

/**
 * Client IP as set by Cloudflare, which proxies fjordanglers.com. On Vercel,
 * x-forwarded-for and x-real-ip carry Cloudflare's edge address, so they are
 * not used. Null when the header is absent or is not a single IP address.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const raw = headers.get('cf-connecting-ip')?.trim()
  if (!raw || isIP(raw) === 0) return null
  return raw.toLowerCase()
}

function warnInProduction(message: string): void {
  if (process.env.NODE_ENV === 'production') console.warn(`[rate-limit] ${message}`)
}

/** The limiter plus its salt, or null when either is missing (never hash without a salt). */
function activeLimiter(): { limiter: RateLimiter; salt: string } | null {
  const limiter = getRateLimiter()
  const salt    = env.RATE_LIMIT_SALT
  if (limiter == null || !salt) {
    warnInProduction('not configured, requests are not limited')
    return null
  }
  return { limiter, salt }
}

async function check(
  kind: 'ip' | 'email',
  value: string,
  rule: RateLimitRule,
): Promise<RateLimitDecision> {
  const active = activeLimiter()
  if (active == null) return ALLOWED

  const digest = createHmac('sha256', active.salt).update(`${kind}:${value}`).digest('hex')

  try {
    const res = await active.limiter.limit(`inquiries:${kind}:${digest}`, rule)
    return res.allowed ? ALLOWED : { blocked: true, retryAfterSec: res.retryAfterSec }
  } catch (err) {
    console.error('[rate-limit] limiter unavailable, failing open:', err instanceof Error ? err.message : 'unknown error')
    return ALLOWED
  }
}

/** `ip` null (header missing) skips only this check; the e-mail check still applies. */
export async function checkIpLimit(ip: string | null): Promise<RateLimitDecision> {
  if (ip == null) {
    if (activeLimiter() != null) {
      warnInProduction('cf-connecting-ip header missing, per-address limit skipped')
    }
    return ALLOWED
  }
  return check('ip', ip, INQUIRY_LIMITS.ip)
}

export async function checkEmailLimit(email: string): Promise<RateLimitDecision> {
  return check('email', email.trim().toLowerCase(), INQUIRY_LIMITS.email)
}
