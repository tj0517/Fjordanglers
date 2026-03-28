/**
 * PayPal REST API v2 — shared client helpers.
 * SERVER-ONLY.
 *
 * Provides:
 *   paypalBase()           — base URL (sandbox vs live)
 *   getPayPalAccessToken() — OAuth2 client_credentials, cached per process
 *   paypalFetch()          — authenticated fetch helper
 */

import { env } from '@/lib/env'

// ── OAuth2 token cache (per-process, PayPal tokens are valid for ~9h) ─────────

type TokenCache = {
  accessToken: string
  expiresAt: number  // unix ms
}

let tokenCache: TokenCache | null = null

export function paypalBase(): string {
  return env.PAYPAL_SANDBOX
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'
}

export async function getPayPalAccessToken(): Promise<string> {
  const now = Date.now()

  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken
  }

  const clientId     = env.PAYPAL_CLIENT_ID
  const clientSecret = env.PAYPAL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`PayPal OAuth2 failed (${res.status}): ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt:   now + data.expires_in * 1000,
  }

  return tokenCache.accessToken
}

export async function paypalFetch(
  path: string,
  options: RequestInit & { idempotencyKey?: string } = {},
): Promise<Response> {
  const token = await getPayPalAccessToken()

  const { idempotencyKey, headers: extraHeaders, ...rest } = options

  const headers: HeadersInit = {
    'Authorization': `Bearer ${token}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
    ...(idempotencyKey ? { 'PayPal-Request-Id': idempotencyKey } : {}),
    ...(extraHeaders as Record<string, string> ?? {}),
  }

  return fetch(`${paypalBase()}${path}`, { headers, ...rest })
}
