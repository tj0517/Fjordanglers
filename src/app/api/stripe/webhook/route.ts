/**
 * Stripe webhook handler.
 *
 * Handles:
 *   account.updated → sync guide Stripe Connect account flags
 *
 * Deposit payments for FA inquiries are handled by /api/webhooks/stripe-deposit.
 * Always returns 200 to prevent infinite Stripe retries.
 */

import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const rawBody   = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  const connectSecret = env.STRIPE_CONNECT_WEBHOOK_SECRET ?? env.STRIPE_WEBHOOK_SECRET
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, connectSecret)
    } catch (err) {
      console.error('[webhook] Invalid signature:', err)
      return new Response('Invalid signature', { status: 400 })
    }
  }

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account)
        break
    }
  } catch (err) {
    console.error(`[webhook] Error processing ${event.type}:`, err)
  }

  return new Response('OK', { status: 200 })
}

// ─── account.updated ──────────────────────────────────────────────────────────

async function handleAccountUpdated(account: Stripe.Account) {
  const db = createServiceClient()

  const { data: guide } = await db
    .from('guides')
    .select('id, stripe_charges_enabled, stripe_payouts_enabled')
    .eq('stripe_account_id', account.id)
    .single()

  if (!guide) return

  const chargesChanged = guide.stripe_charges_enabled !== account.charges_enabled
  const payoutsChanged = guide.stripe_payouts_enabled !== account.payouts_enabled
  if (!chargesChanged && !payoutsChanged) return

  await db
    .from('guides')
    .update({
      stripe_charges_enabled: account.charges_enabled,
      stripe_payouts_enabled: account.payouts_enabled,
    })
    .eq('stripe_account_id', account.id)
}
