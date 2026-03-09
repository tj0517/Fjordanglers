/**
 * Stripe Connect helpers for guide onboarding.
 *
 * Flow:
 *  1. createExpressAccount(email, country) — creates a Stripe Express account
 *  2. createAccountLink(accountId, returnUrl, refreshUrl) — returns the onboarding URL
 *  3. Guide completes KYC on Stripe's hosted page
 *  4. Stripe fires account.updated webhook → isAccountReady() check
 *  5. If ready → set guide.stripe_charges_enabled = true
 *
 * SERVER-ONLY.
 */

import type Stripe from 'stripe'
import { stripe } from './client'

/**
 * Create a Stripe Express account for a new guide.
 *
 * @param email  Guide's email address
 * @param country  ISO-3166-1 alpha-2 country code (e.g. 'NO', 'SE', 'PL')
 * @returns The newly created Stripe Account object
 */
export async function createExpressAccount(
  email: string,
  country: string,
): Promise<Stripe.Account> {
  return stripe.accounts.create({
    type: 'express',
    email,
    country,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
    settings: {
      payouts: {
        // Guides receive weekly payouts; adjustable per account later
        schedule: { interval: 'weekly', weekly_anchor: 'monday' },
        debit_negative_balances: true,
      },
    },
  })
}

/**
 * Generate a Stripe Connect onboarding link.
 * Links expire after ~10 minutes; use refreshUrl to re-generate.
 *
 * @param accountId  Stripe account ID (acct_...)
 * @param returnUrl  URL to redirect to after successful onboarding
 * @param refreshUrl  URL to redirect to if the link has expired
 * @returns AccountLink object containing the one-time `url`
 */
export async function createAccountLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<Stripe.AccountLink> {
  return stripe.accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: 'account_onboarding',
  })
}

/**
 * Fetch a Stripe Account by ID.
 * Use after the webhook fires to check the latest account state.
 */
export async function getAccount(accountId: string): Promise<Stripe.Account> {
  return stripe.accounts.retrieve(accountId)
}

/**
 * Check whether a Connect account has completed onboarding and can
 * accept payments and receive payouts.
 *
 * @param account  Stripe Account object (from getAccount or webhook payload)
 * @returns true only when both charges AND payouts are fully enabled
 */
export function isAccountReady(account: Stripe.Account): boolean {
  return account.charges_enabled === true && account.payouts_enabled === true
}

/**
 * Generate a Stripe dashboard login link for a guide.
 * Only works for Express accounts (not Custom).
 */
export async function createLoginLink(accountId: string): Promise<Stripe.LoginLink> {
  return stripe.accounts.createLoginLink(accountId)
}
