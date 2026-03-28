/**
 * Stripe payment provider adapter — wraps existing Stripe Checkout logic.
 * SERVER-ONLY.
 */

import { stripe } from '@/lib/stripe/client'
import { env } from '@/lib/env'
import type {
  IPaymentProvider,
  GuidePaymentProfile,
  CreateCheckoutInput,
  CheckoutResult,
  RefundInput,
  RefundResult,
} from './types'

class StripeAdapter implements IPaymentProvider {
  readonly name = 'stripe' as const

  isReady(guide: GuidePaymentProfile): boolean {
    return guide.stripe_payouts_enabled
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const {
      bookingId,
      inquiryId,
      paymentType,
      amountEur,
      anglerEmail,
      description,
      successUrl,
      cancelUrl,
      idempotencyKey,
    } = input

    const amountCents = Math.round(amountEur * 100)

    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode:                 'payment',
          payment_method_types: ['card'],
          customer_email:       anglerEmail ?? undefined,
          line_items: [
            {
              price_data: {
                currency:     'eur',
                product_data: { name: description },
                unit_amount:  amountCents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            ...(bookingId ? { bookingId } : {}),
            ...(inquiryId ? { inquiryId } : {}),
            ...(bookingId ? { guideId: '' } : {}),   // filled by caller when needed
            paymentType,
          },
          success_url: successUrl,
          cancel_url:  cancelUrl,
          payment_intent_data: {
            metadata: {
              ...(bookingId ? { bookingId } : {}),
              ...(inquiryId ? { inquiryId } : {}),
              paymentType,
            },
          },
        },
        { idempotencyKey },
      )

      return { url: session.url!, externalId: session.id }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stripe checkout failed'
      console.error('[stripe-adapter] createCheckout error:', err)
      return { error: msg }
    }
  }

  async voidCheckout(externalId: string): Promise<void> {
    try {
      await stripe.checkout.sessions.expire(externalId)
    } catch (err) {
      // May already be expired — non-fatal
      console.warn('[stripe-adapter] voidCheckout warning:', err)
    }
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const { stripePaymentIntentId } = input

    if (!stripePaymentIntentId) {
      return { error: 'No Stripe payment intent ID for refund' }
    }

    try {
      await stripe.refunds.create({
        payment_intent:   stripePaymentIntentId,
        reason:           'requested_by_customer',
        reverse_transfer: true,
      })
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stripe refund failed'
      console.error('[stripe-adapter] refund error:', err)
      return { error: msg }
    }
  }
}

export const stripeAdapter: IPaymentProvider = new StripeAdapter()
