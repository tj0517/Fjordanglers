/**
 * PayPal Commerce Platform adapter — PayPal Orders v2 API.
 * SERVER-ONLY.
 *
 * createCheckout → POST /v2/checkout/orders
 * voidCheckout   → no-op (PayPal orders expire automatically after 3h)
 * refund         → POST /v2/payments/captures/{id}/refund
 */

import { paypalFetch } from './paypal-client'
import type {
  IPaymentProvider,
  GuidePaymentProfile,
  CreateCheckoutInput,
  CheckoutResult,
  RefundInput,
  RefundResult,
} from './types'

class PayPalAdapter implements IPaymentProvider {
  readonly name = 'paypal' as const

  isReady(guide: GuidePaymentProfile): boolean {
    return guide.paypal_onboarding_status === 'active' && guide.paypal_merchant_id != null
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const {
      bookingId,
      inquiryId,
      paymentType,
      amountEur,
      platformFeeEur,
      anglerEmail,
      description,
      successUrl,
      cancelUrl,
      idempotencyKey,
    } = input

    const customId = bookingId ?? inquiryId ?? ''

    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id:   customId,
          description: description,
          amount: {
            currency_code: 'EUR',
            value:         amountEur.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: 'EUR',
                value:         amountEur.toFixed(2),
              },
            },
          },
          items: [
            {
              name:     description,
              quantity: '1',
              unit_amount: {
                currency_code: 'EUR',
                value:         amountEur.toFixed(2),
              },
            },
          ],
          // Platform fee via PayPal Marketplace / Commerce Platform
          payment_instruction: {
            disbursement_mode: 'INSTANT',
            platform_fees: [
              {
                amount: {
                  currency_code: 'EUR',
                  value:         platformFeeEur.toFixed(2),
                },
              },
            ],
          },
        },
      ],
      application_context: {
        return_url:          successUrl,
        cancel_url:          cancelUrl,
        brand_name:          'FjordAnglers',
        shipping_preference: 'NO_SHIPPING',
        user_action:         'PAY_NOW',
        ...(anglerEmail ? { payer: { email_address: anglerEmail } } : {}),
      },
    }

    try {
      const res = await paypalFetch('/v2/checkout/orders', {
        method:          'POST',
        body:            JSON.stringify(body),
        idempotencyKey:  idempotencyKey,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        console.error('[paypal-adapter] createCheckout error:', res.status, text)
        return { error: `PayPal order creation failed (${res.status})` }
      }

      const data = await res.json() as {
        id: string
        links: Array<{ rel: string; href: string }>
      }

      const approveLink = data.links.find(l => l.rel === 'approve')
      if (!approveLink) {
        return { error: 'PayPal did not return an approval URL' }
      }

      return { url: approveLink.href, externalId: data.id }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PayPal checkout failed'
      console.error('[paypal-adapter] createCheckout error:', err)
      return { error: msg }
    }
  }

  async voidCheckout(_externalId: string): Promise<void> {
    // PayPal orders expire automatically after 3 hours — no action needed
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const { paypalCaptureId } = input

    if (!paypalCaptureId) {
      return { error: 'No PayPal capture ID for refund' }
    }

    try {
      const res = await paypalFetch(`/v2/payments/captures/${paypalCaptureId}/refund`, {
        method: 'POST',
        body:   JSON.stringify({}),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        console.error('[paypal-adapter] refund error:', res.status, text)
        return { error: `PayPal refund failed (${res.status})` }
      }

      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PayPal refund failed'
      console.error('[paypal-adapter] refund error:', err)
      return { error: msg }
    }
  }
}

export const paypalAdapter: IPaymentProvider = new PayPalAdapter()
