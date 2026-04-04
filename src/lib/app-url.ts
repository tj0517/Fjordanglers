import { headers } from 'next/headers'
import { env } from './env'

/**
 * Returns the correct base URL for the current request.
 *
 * Priority:
 * 1. `host` header from the current request (most accurate — reflects the
 *    exact origin the user is on, handles Vercel preview branch URLs correctly)
 * 2. `VERCEL_URL` env var (deployment-specific, set automatically by Vercel)
 * 3. `NEXT_PUBLIC_APP_URL` env var (production fallback)
 *
 * Why this matters for Stripe Checkout:
 *   `VERCEL_URL` is the deployment-specific URL
 *   (e.g., project-git-branch-abc123.vercel.app) but the user may be
 *   accessing via the stable branch URL (e.g., project-preview.vercel.app).
 *   These are different origins — cookies set on one are not sent to the other.
 *   If success_url uses the deployment URL but the user is on the branch URL,
 *   Stripe redirects them to a different origin, their session cookies are not
 *   present, and they appear logged out.
 *
 *   Reading the `host` header inside a Server Action always gives us the origin
 *   the browser is actually on, eliminating the mismatch entirely.
 */
export async function getAppUrl(): Promise<string> {
  try {
    const headersList = await headers()
    const host = headersList.get('host')
    if (host) {
      // localhost or host:port → http; everything else → https
      const proto = host.startsWith('localhost') || /:\d+$/.test(host) ? 'http' : 'https'
      return `${proto}://${host}`
    }
  } catch {
    // headers() unavailable outside request context (webhook handler, cron job, etc.)
  }

  // Fallback for contexts without request headers (webhooks, cron)
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return env.NEXT_PUBLIC_APP_URL
}
