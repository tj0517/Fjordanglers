'use server'

/**
 * Stripe Connect Custom account onboarding.
 *
 * Flow:
 *  1. Guide fills in personal info + IBAN on /dashboard/account
 *  2. createStripeCustomAccount() creates a Custom Stripe account + attaches the bank account
 *  3. stripe_account_id is saved to guides table (status: pending verification)
 *  4. Stripe verifies asynchronously → account.updated webhook fires
 *  5. Webhook sets stripe_payouts_enabled = true when ready
 *
 * The guide never leaves FjordAnglers — no Stripe-hosted pages.
 *
 * SERVER-ONLY.
 */

import { z } from 'zod'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

// ─── Types ─────────────────────────────────────────────────────────────────────

type ActionResult =
  | { success: true }
  | { success: false; error: string }

// ─── Validation ────────────────────────────────────────────────────────────────

// IBAN: 2-letter country code + 2 check digits + 11–30 alphanumeric BBAN
const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/

const setupPayoutSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50),

  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50),

  dobDay: z.coerce
    .number()
    .int()
    .min(1, 'Invalid day')
    .max(31, 'Invalid day'),

  dobMonth: z.coerce
    .number()
    .int()
    .min(1, 'Invalid month')
    .max(12, 'Invalid month'),

  dobYear: z.coerce
    .number()
    .int()
    .min(1900, 'Invalid year')
    .max(new Date().getFullYear() - 18, 'Must be at least 18 years old'),

  addressLine1: z
    .string()
    .min(1, 'Street address is required')
    .max(200),

  addressCity: z
    .string()
    .min(1, 'City is required')
    .max(50),

  addressPostalCode: z
    .string()
    .min(3, 'Postal code is required')
    .max(20),

  country: z
    .string()
    .length(2, 'Select your country'),

  iban: z
    .string()
    .transform(v => v.replace(/\s/g, '').toUpperCase())
    .refine(v => v.length >= 15 && v.length <= 34, 'IBAN must be 15–34 characters')
    .refine(v => ibanRegex.test(v), 'Invalid IBAN — should start with country code (e.g. NO94 8601 1117 947)'),
})

export type SetupPayoutInput = z.input<typeof setupPayoutSchema>

// ─── Action ────────────────────────────────────────────────────────────────────

export async function setupPayoutAccount(data: SetupPayoutInput): Promise<ActionResult> {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  if (!user.email) return { success: false, error: 'Email required for payout setup' }

  // 2. Validate input
  const parsed = setupPayoutSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const d = parsed.data

  // 3. Fetch guide — ensure no account is already linked (idempotency guard)
  const service = createServiceClient()
  const { data: guide } = await service
    .from('guides')
    .select('id, stripe_account_id')
    .eq('user_id', user.id)
    .single()

  if (!guide) return { success: false, error: 'Guide profile not found' }
  if (guide.stripe_account_id) return { success: false, error: 'Stripe account already connected' }

  // 4. Capture client IP for ToS acceptance (required by Stripe for Custom accounts)
  const hdrs = await headers()
  const forwarded = hdrs.get('x-forwarded-for')
  const clientIp  = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'

  // 5. Create Custom Stripe account
  //    service_agreement: 'recipient' — lighter KYC for payout-only accounts (no card acceptance)
  let account: Stripe.Account
  try {
    account = await stripe.accounts.create({
      type:          'custom',
      country:       d.country,
      email:         user.email,
      capabilities:  { transfers: { requested: true } },  // payout-only — no card_payments needed
      business_type: 'individual',
      individual: {
        first_name: d.firstName,
        last_name:  d.lastName,
        dob:        { day: d.dobDay, month: d.dobMonth, year: d.dobYear },
        address: {
          line1:       d.addressLine1,
          city:        d.addressCity,
          postal_code: d.addressPostalCode,
          country:     d.country,
        },
        email: user.email,
      },
      tos_acceptance: {
        date:              Math.floor(Date.now() / 1000),
        ip:                clientIp,
        service_agreement: 'full',
      },
      settings: {
        payouts: {
          schedule:               { interval: 'weekly', weekly_anchor: 'monday' },
          debit_negative_balances: true,
        },
      },
    })
  } catch (err) {
    const msg = err instanceof Stripe.errors.StripeError
      ? err.message
      : 'Failed to create Stripe account — please check your details'
    console.error('[stripe-connect] accounts.create error:', err)
    return { success: false, error: msg }
  }

  // 6. Add IBAN as external bank account (payout destination)
  try {
    await stripe.accounts.createExternalAccount(account.id, {
      external_account: {
        object:               'bank_account',
        account_number:       d.iban,
        currency:             'eur',
        country:              d.country,
        account_holder_name:  `${d.firstName} ${d.lastName}`,
        account_holder_type:  'individual',
      },
    })
  } catch (err) {
    // IBAN invalid — clean up orphaned Stripe account to stay consistent
    await stripe.accounts.del(account.id).catch(() => {})
    const msg = err instanceof Stripe.errors.StripeError
      ? err.message
      : 'Invalid IBAN — please double-check your bank account number'
    console.error('[stripe-connect] createExternalAccount error:', err)
    return { success: false, error: `Bank account error: ${msg}` }
  }

  // 7. Persist stripe_account_id + initial capability status to DB
  const { error: dbErr } = await service
    .from('guides')
    .update({
      stripe_account_id:      account.id,
      stripe_charges_enabled: account.charges_enabled ?? false,
      stripe_payouts_enabled: account.payouts_enabled ?? false,
    })
    .eq('id', guide.id)

  if (dbErr) {
    // Stripe account was created — admin can manually link if needed
    console.error('[stripe-connect] DB update error:', dbErr)
    return { success: false, error: 'Account created but could not be saved — contact support@fjordanglers.com' }
  }

  return { success: true }
}
