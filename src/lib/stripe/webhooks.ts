/**
 * Stripe webhook signature verification + event type guards.
 *
 * Usage in Route Handler (src/app/api/webhooks/stripe/route.ts):
 *
 *   const event = constructWebhookEvent(body, sig)
 *   if (isPaymentIntentSucceeded(event)) { ... }
 *
 * SERVER-ONLY.
 */

import type Stripe from 'stripe'
import { stripe } from './client'
import { env } from '@/lib/env'

/**
 * Verify the Stripe-Signature header and construct a typed Event object.
 * Throws a Stripe.errors.StripeSignatureVerificationError on invalid signature.
 *
 * @param rawBody  Raw request body as a string (NOT parsed JSON)
 * @param signature  Value of the `Stripe-Signature` header
 */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
}

// ─── Event type guards ─────────────────────────────────────────────────────
// Narrow a generic Stripe.Event to a fully-typed event variant.

export function isPaymentIntentSucceeded(
  event: Stripe.Event,
): event is Stripe.PaymentIntentSucceededEvent {
  return event.type === 'payment_intent.succeeded'
}

export function isPaymentIntentFailed(
  event: Stripe.Event,
): event is Stripe.PaymentIntentPaymentFailedEvent {
  return event.type === 'payment_intent.payment_failed'
}

export function isAccountUpdated(
  event: Stripe.Event,
): event is Stripe.AccountUpdatedEvent {
  return event.type === 'account.updated'
}

export function isAccountDeauthorized(
  event: Stripe.Event,
): event is Stripe.AccountApplicationDeauthorizedEvent {
  return event.type === 'account.application.deauthorized'
}

export function isTransferCreated(
  event: Stripe.Event,
): event is Stripe.TransferCreatedEvent {
  return event.type === 'transfer.created'
}

export function isSubscriptionDeleted(
  event: Stripe.Event,
): event is Stripe.CustomerSubscriptionDeletedEvent {
  return event.type === 'customer.subscription.deleted'
}
