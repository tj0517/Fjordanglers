'use server'

/**
 * Stripe Connect onboarding actions.
 *
 * startStripeOnboarding — Express account flow (current):
 *  1. Guide clicks "Connect with Stripe" on /dashboard/account
 *  2. We create an Express account pre-filled with known data (email, name, country)
 *  3. Guide is redirected to Stripe's hosted onboarding form
 *  4. After completing, guide returns to /dashboard/account?stripe_done=1
 *  5. Stripe fires account.updated webhook → syncs payouts_enabled to DB
 *
 * setupPayoutAccount — Custom account flow (legacy, kept for existing guides).
 *
 * SERVER-ONLY.
 */

import { z } from 'zod'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { getAppUrl } from '@/lib/app-url'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'


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
          // Manual — FjordAnglers triggers payout after the trip is completed.
          // This prevents paying out the guide before the trip happens (cancellation risk).
          schedule:               { interval: 'manual' },
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

// ─── Express onboarding (current) ──────────────────────────────────────────────

/**
 * Normalizes a country value to a 2-letter ISO code.
 * The DB may store the full name ("Iceland") from older profile edits.
 * Falls back to 'NO' (most common guide country) if not recognized.
 */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  Norway: 'NO', Sweden: 'SE', Finland: 'FI', Denmark: 'DK',
  Estonia: 'EE', Latvia: 'LV', Lithuania: 'LT', Poland: 'PL', Germany: 'DE',
  Austria: 'AT', Switzerland: 'CH', Netherlands: 'NL', Belgium: 'BE',
  France: 'FR', Spain: 'ES', Portugal: 'PT', Italy: 'IT',
  Slovenia: 'SI', Slovakia: 'SK', 'Czech Republic': 'CZ', Hungary: 'HU',
  Romania: 'RO', Bulgaria: 'BG', Greece: 'GR', 'United Kingdom': 'GB',
  Ireland: 'IE',
}

// Countries not yet supported by Stripe Connect (as of 2026)
const STRIPE_UNSUPPORTED: Set<string> = new Set(['IS', 'HR'])

function toCountryCode(country: string | null): string | null {
  if (!country) return null
  const trimmed = country.trim()
  // Already a 2-letter code
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed
  // Uppercase first letter and look up
  const upperFirst = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return COUNTRY_NAME_TO_CODE[upperFirst] ?? COUNTRY_NAME_TO_CODE[trimmed] ?? null
}

/**
 * Creates (or resumes) a Stripe Express account for the authenticated guide,
 * pre-filled with their known data, and returns a one-time hosted onboarding URL.
 *
 * Called from the client — result URL is used for window.location.href redirect.
 * The link expires after ~10 minutes; use refresh_url to regenerate.
 */
export async function startStripeOnboarding(): Promise<
  { url: string } | { error: string }
> {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }
  if (!user.email) return { error: 'Email required for payout setup' }

  // 2. Fetch guide
  const service = createServiceClient()
  const { data: guide } = await service
    .from('guides')
    .select('id, stripe_account_id, full_name, country')
    .eq('user_id', user.id)
    .single()

  if (!guide) return { error: 'Guide profile not found' }

  let accountId = guide.stripe_account_id

  // 3. Create Express account if none exists (pre-fill with known data)
  if (!accountId) {
    const nameParts = guide.full_name.trim().split(/\s+/)
    const firstName = nameParts[0] ?? ''
    const lastName  = nameParts.slice(1).join(' ') || undefined

    // Normalize country — DB may store full name ("Iceland") or ISO code ("IS")
    const countryCode = toCountryCode(guide.country)

    if (!countryCode) {
      return { error: `Unrecognised country "${guide.country}" — please contact support@fjordanglers.com` }
    }
    if (STRIPE_UNSUPPORTED.has(countryCode)) {
      return { error: `Stripe payouts are not yet available in your country (${guide.country}). Please contact support@fjordanglers.com to arrange manual payouts.` }
    }

    try {
      // Stripe requires a public URL — skip for local dev
      const appUrl = await getAppUrl()
      const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1')

      const account = await stripe.accounts.create({
        type:          'express',
        email:         user.email,
        country:       countryCode,
        capabilities:  {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
        business_type: 'individual',
        business_profile: {
          // MCC 7999 — Recreation Services (fishing guides / outdoor activities)
          mcc: '7999',
          ...(!isLocalhost && { url: appUrl }),
        },
        individual: {
          email:      user.email,
          ...(firstName && { first_name: firstName }),
          ...(lastName  && { last_name:  lastName  }),
        },
        settings: {
          payouts: {
            // Manual — FjordAnglers triggers payout after the trip is completed.
            schedule:               { interval: 'manual' },
            debit_negative_balances: true,
          },
        },
      })
      accountId = account.id

      const { error: dbErr } = await service
        .from('guides')
        .update({ stripe_account_id: accountId })
        .eq('id', guide.id)

      if (dbErr) {
        // Account created but DB save failed — clean up to stay consistent
        await stripe.accounts.del(accountId).catch(() => {})
        console.error('[stripe-connect] DB update error after Express account create:', dbErr)
        return { error: 'Failed to save account — please try again' }
      }
    } catch (err) {
      const msg = err instanceof Stripe.errors.StripeError
        ? err.message
        : 'Failed to create Stripe account — please try again'
      console.error('[stripe-connect] Express accounts.create error:', err)
      return { error: msg }
    }
  }

  // 4. Patch business_profile on existing accounts (mcc + url may be missing)
  //    Safe to call even if already set — Stripe ignores no-op updates.
  //    Skip url on localhost — Stripe requires a public URL.
  const appUrl      = await getAppUrl()
  const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1')
  await stripe.accounts.update(accountId, {
    business_profile: {
      mcc: '7999',
      ...(!isLocalhost && { url: appUrl }),
    },
  }).catch(err => {
    // Non-fatal — log and continue; the guide can still complete onboarding
    console.warn('[stripe-connect] accounts.update business_profile warning:', err)
  })

  // 5. Generate a one-time account link (expires ~10 min)
  const baseUrl = await getAppUrl()
  try {
    const link = await stripe.accountLinks.create({
      account:     accountId,
      return_url:  `${baseUrl}/dashboard/account?stripe_done=1`,
      refresh_url: `${baseUrl}/dashboard/account?stripe_refresh=1`,
      type:        'account_onboarding',
    })
    return { url: link.url }
  } catch (err) {
    const msg = err instanceof Stripe.errors.StripeError
      ? err.message
      : 'Failed to generate onboarding link — please try again'
    console.error('[stripe-connect] accountLinks.create error:', err)
    return { error: msg }
  }
}

// ─── syncStripeAccountStatus ────────────────────────────────────────────────────
//
// Manually pulls the current account status from Stripe and writes it to DB.
// Useful when the account.updated webhook was missed (wrong secret, cold start, etc.)

export async function syncStripeAccountStatus(): Promise<
  { success: true; payoutsEnabled: boolean } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const service = createServiceClient()
  const { data: guide } = await service
    .from('guides')
    .select('id, stripe_account_id')
    .eq('user_id', user.id)
    .single()

  if (!guide) return { error: 'Guide profile not found' }
  if (!guide.stripe_account_id) return { error: 'No Stripe account linked yet — complete onboarding first' }

  let account: Stripe.Account
  try {
    account = await stripe.accounts.retrieve(guide.stripe_account_id)
  } catch (err) {
    console.error('[syncStripeAccountStatus] retrieve error:', err)
    return { error: 'Could not reach Stripe — please try again' }
  }

  const { error: dbErr } = await service
    .from('guides')
    .update({
      stripe_charges_enabled: account.charges_enabled ?? false,
      stripe_payouts_enabled: account.payouts_enabled ?? false,
    })
    .eq('id', guide.id)

  if (dbErr) {
    console.error('[syncStripeAccountStatus] DB error:', dbErr)
    return { error: 'Failed to save status — please try again' }
  }

  revalidatePath('/dashboard/account')
  return { success: true, payoutsEnabled: account.payouts_enabled ?? false }
}
