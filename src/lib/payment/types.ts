/**
 * Payment provider abstraction — shared types.
 * SERVER-ONLY.
 */

export type PaymentProviderName = 'stripe' | 'paypal'

export type GuidePaymentProfile = {
  id: string
  payment_provider: PaymentProviderName
  stripe_account_id: string | null
  stripe_payouts_enabled: boolean
  paypal_merchant_id: string | null
  paypal_onboarding_status: 'pending' | 'active' | 'suspended' | null
  commission_rate: number
}

export type CreateCheckoutInput = {
  bookingId?: string
  inquiryId?: string
  paymentType: 'deposit' | 'balance' | 'full'
  amountEur: number
  platformFeeEur: number
  anglerEmail: string | null
  description: string
  successUrl: string
  cancelUrl: string
  idempotencyKey: string
}

export type CheckoutResult =
  | { url: string; externalId: string }
  | { error: string }

export type RefundInput = {
  stripePaymentIntentId?: string | null
  paypalCaptureId?: string | null
}

export type RefundResult = { success: true } | { error: string }

export interface IPaymentProvider {
  readonly name: PaymentProviderName
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>
  voidCheckout(externalId: string): Promise<void>
  refund(input: RefundInput): Promise<RefundResult>
  isReady(guide: GuidePaymentProfile): boolean
}
