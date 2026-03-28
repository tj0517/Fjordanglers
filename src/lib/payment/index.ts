/**
 * Payment provider factory.
 * SERVER-ONLY.
 *
 * Add country codes to PAYPAL_COUNTRIES when a new country
 * cannot use Stripe Connect (IS = Iceland, HR = Croatia, etc.)
 */

import { stripeAdapter } from './stripe-adapter'
import { paypalAdapter } from './paypal-adapter'
import type { IPaymentProvider, PaymentProviderName } from './types'

export * from './types'

// Countries that must use PayPal (not supported by Stripe Connect)
const PAYPAL_COUNTRIES = new Set(['IS'])

export function resolveProviderForCountry(code: string): PaymentProviderName {
  return PAYPAL_COUNTRIES.has(code.toUpperCase()) ? 'paypal' : 'stripe'
}

export function getProvider(name: PaymentProviderName): IPaymentProvider {
  return name === 'paypal' ? paypalAdapter : stripeAdapter
}
