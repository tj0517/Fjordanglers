'use server'

/**
 * PayPal Commerce Platform onboarding actions.
 *
 * startPayPalOnboarding — Partner Referrals API → hosted onboarding URL
 * syncPayPalMerchant    — Called from webhook after MERCHANT.ONBOARDING.COMPLETED
 *
 * SERVER-ONLY.
 */

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { paypalFetch } from '@/lib/payment/paypal-client'
import { env } from '@/lib/env'
import { revalidatePath } from 'next/cache'

// ─── startPayPalOnboarding ─────────────────────────────────────────────────────

export async function startPayPalOnboarding(): Promise<
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
    .select('id, full_name, paypal_merchant_id, paypal_onboarding_status')
    .eq('user_id', user.id)
    .single()

  if (!guide) return { error: 'Guide profile not found' }

  // 3. Create Partner Referral
  const baseUrl       = env.NEXT_PUBLIC_APP_URL
  const trackingId    = `guide-${guide.id}`

  try {
    const body = {
      individual_owners: [
        {
          names: [
            {
              given_name:  guide.full_name.split(' ')[0] ?? '',
              surname:     guide.full_name.split(' ').slice(1).join(' ') || undefined,
              type:        'LEGAL',
            },
          ],
          emails: [
            { email: user.email, primary: true },
          ],
          type: 'PRIMARY',
        },
      ],
      email: user.email,
      tracking_id: trackingId,
      partner_config_override: {
        return_url:         `${baseUrl}/dashboard/account?paypal_done=1`,
        return_url_description: 'Return to FjordAnglers dashboard',
      },
      operations: [
        { operation: 'API_INTEGRATION', api_integration_preference: { rest_api_integration: { integration_method: 'PAYPAL', integration_type: 'THIRD_PARTY', third_party_details: { features: ['PAYMENT', 'REFUND'] } } } },
      ],
      products: ['PPCP'],
      legal_consents: [
        { type: 'SHARE_DATA_CONSENT', granted: true },
      ],
    }

    const res = await paypalFetch('/v2/customer/partner-referrals', {
      method: 'POST',
      body:   JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      console.error('[startPayPalOnboarding] partner-referrals error:', res.status, text)
      return { error: 'Failed to start PayPal onboarding — please try again.' }
    }

    const data = await res.json() as {
      links: Array<{ rel: string; href: string }>
    }

    const actionUrl = data.links.find(l => l.rel === 'action_url')
    if (!actionUrl) {
      return { error: 'PayPal did not return an onboarding URL.' }
    }

    // 4. Mark as pending in DB
    await service
      .from('guides')
      .update({ paypal_onboarding_status: 'pending' })
      .eq('id', guide.id)

    return { url: actionUrl.href }
  } catch (err) {
    console.error('[startPayPalOnboarding] error:', err)
    return { error: 'Failed to start PayPal onboarding — please try again.' }
  }
}

// ─── syncPayPalMerchant ────────────────────────────────────────────────────────
//
// Called from the PayPal webhook handler after MERCHANT.ONBOARDING.COMPLETED.

export async function syncPayPalMerchant(
  guideId: string,
  merchantId: string,
  active: boolean,
): Promise<void> {
  const service = createServiceClient()

  const { error } = await service
    .from('guides')
    .update({
      paypal_merchant_id:       merchantId,
      paypal_onboarding_status: active ? 'active' : 'pending',
    })
    .eq('id', guideId)

  if (error) {
    console.error('[syncPayPalMerchant] DB error:', error)
  } else {
    revalidatePath('/dashboard/account')
  }
}
