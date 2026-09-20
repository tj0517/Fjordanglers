/**
 * Stripe webhook endpoint — verifies the signature and acknowledges. Does nothing else.
 *
 * Why it is empty: this route only ever handled `account.updated` (Stripe Connect,
 * syncing guide payout flags). FjordAnglers has no Connect (ADR-0001), so that branch
 * was removed in FA-1.07. The route itself stays because the live Stripe endpoint
 * `brilliant-glow` (events from connected accounts) still points at it; deleting the
 * route would answer 404 on an active endpoint.
 *
 * Remove this route and STRIPE_CONNECT_WEBHOOK_SECRET (src/lib/env.ts) once that endpoint
 * is disabled in the Stripe dashboard — see docs/deferred-tasks.md (api/stripe/webhook).
 *
 * Deposit payments are handled by /api/webhooks/stripe-deposit.
 * Always answers 200 for a valid signature to prevent infinite Stripe retries.
 */

import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const rawBody   = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  const connectSecret = env.STRIPE_CONNECT_WEBHOOK_SECRET ?? env.STRIPE_WEBHOOK_SECRET
  try {
    stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    try {
      stripe.webhooks.constructEvent(rawBody, signature, connectSecret)
    } catch (err) {
      console.error('[webhook] Invalid signature:', err)
      return new Response('Invalid signature', { status: 400 })
    }
  }

  return new Response('OK', { status: 200 })
}
