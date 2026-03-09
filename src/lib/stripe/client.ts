/**
 * Stripe server-side client — singleton.
 *
 * SERVER-ONLY. Never import in Client Components.
 * Use the NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY + @stripe/stripe-js on the client.
 */

import Stripe from 'stripe'
import { env } from '@/lib/env'

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  // Pinned to the version shipped with stripe@20.4.0
  apiVersion: '2026-02-25.clover',
  typescript: true,
  // Identify the platform in Stripe logs
  appInfo: {
    name: 'FjordAnglers',
    version: '0.1.0',
    url: 'https://fjordanglers.com',
  },
})
