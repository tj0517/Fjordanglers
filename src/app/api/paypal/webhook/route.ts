/**
 * PayPal Commerce Platform webhook handler.
 *
 * Handles:
 *   CHECKOUT.ORDER.APPROVED         → capture the order
 *   PAYMENT.CAPTURE.COMPLETED       → confirm booking / inquiry
 *   PAYMENT.CAPTURE.REFUNDED        → mark as refunded
 *   MERCHANT.ONBOARDING.COMPLETED   → sync guide PayPal merchant status
 *
 * Verifies webhook signature via PayPal's verify-webhook-signature API.
 * Always returns 200 to prevent PayPal retries for logic errors.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { paypalFetch } from '@/lib/payment/paypal-client'
import { createBookingFromInquiry } from '@/lib/create-booking-from-inquiry'
import { syncPayPalMerchant } from '@/actions/paypal-connect'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Webhook signature verification ───────────────────────────────────────────

async function verifyWebhookSignature(
  req: Request,
  rawBody: string,
): Promise<boolean> {
  const webhookId = env.PAYPAL_WEBHOOK_ID
  if (!webhookId) {
    // PAYPAL_WEBHOOK_ID not set — skip verification in dev/test
    console.warn('[paypal-webhook] PAYPAL_WEBHOOK_ID not set — skipping signature verification')
    return true
  }

  const headers = req.headers
  const payload = {
    auth_algo:         headers.get('paypal-auth-algo')         ?? '',
    cert_url:          headers.get('paypal-cert-url')          ?? '',
    transmission_id:   headers.get('paypal-transmission-id')   ?? '',
    transmission_sig:  headers.get('paypal-transmission-sig')  ?? '',
    transmission_time: headers.get('paypal-transmission-time') ?? '',
    webhook_id:        webhookId,
    webhook_event:     JSON.parse(rawBody),
  }

  try {
    const res = await paypalFetch('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body:   JSON.stringify(payload),
    })
    if (!res.ok) return false
    const data = await res.json() as { verification_status: string }
    return data.verification_status === 'SUCCESS'
  } catch (err) {
    console.error('[paypal-webhook] Signature verification error:', err)
    return false
  }
}

// ─── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text()

  const isValid = await verifyWebhookSignature(req, rawBody)
  if (!isValid) {
    console.error('[paypal-webhook] Invalid signature')
    return new Response('Invalid signature', { status: 400 })
  }

  let event: { event_type: string; resource: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  try {
    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
        await handleOrderApproved(event.resource)
        break
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handleCaptureCompleted(event.resource)
        break
      case 'PAYMENT.CAPTURE.REFUNDED':
        await handleCaptureRefunded(event.resource)
        break
      case 'MERCHANT.ONBOARDING.COMPLETED':
        await handleMerchantOnboarding(event.resource)
        break
      default:
        // Unknown — ignore
        break
    }
  } catch (err) {
    console.error(`[paypal-webhook] Error processing ${event.event_type}:`, err)
    // Return 200 anyway — PayPal should not retry logic errors
  }

  return new Response('OK', { status: 200 })
}

// ─── CHECKOUT.ORDER.APPROVED ───────────────────────────────────────────────────

async function handleOrderApproved(resource: Record<string, unknown>): Promise<void> {
  const orderId = resource.id as string
  if (!orderId) return

  // Capture the order
  const res = await paypalFetch(`/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    body:   JSON.stringify({}),
    idempotencyKey: `capture-${orderId}`,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    console.error(`[paypal-webhook] Failed to capture order ${orderId}:`, res.status, text)
  }
  // PAYMENT.CAPTURE.COMPLETED event will fire after successful capture
}

// ─── PAYMENT.CAPTURE.COMPLETED ────────────────────────────────────────────────

async function handleCaptureCompleted(resource: Record<string, unknown>): Promise<void> {
  const captureId   = resource.id as string
  const customId    = (resource.custom_id as string | undefined) ?? ''
  const amountObj   = resource.amount as { value: string } | undefined
  const amountEur   = amountObj ? parseFloat(amountObj.value) : 0

  if (!captureId || !customId) {
    console.error('[paypal-webhook] PAYMENT.CAPTURE.COMPLETED missing captureId or customId')
    return
  }

  const db = createServiceClient()

  // Determine if customId is a bookingId or inquiryId
  // Try booking first
  const { data: booking } = await db
    .from('bookings')
    .select('id, status, paypal_order_id')
    .eq('id', customId)
    .maybeSingle()

  if (booking) {
    // Update booking: confirmed + capture id
    const isDeposit = booking.status === 'accepted'

    if (isDeposit) {
      await db
        .from('bookings')
        .update({
          status:            'confirmed',
          confirmed_at:      new Date().toISOString(),
          paypal_capture_id: captureId,
        })
        .eq('id', customId)
    } else {
      // balance payment
      await db
        .from('bookings')
        .update({
          balance_paypal_capture_id: captureId,
          balance_paid_at:           new Date().toISOString(),
          status:                    'completed',
        })
        .eq('id', customId)
    }
    return
  }

  // Try inquiry
  const { data: inquiry } = await db
    .from('trip_inquiries')
    .select('id, status')
    .eq('id', customId)
    .maybeSingle()

  if (inquiry) {
    await db
      .from('trip_inquiries')
      .update({
        status:            'confirmed',
        paypal_capture_id: captureId,
      })
      .eq('id', customId)

    await createBookingFromInquiry(customId, db, null, captureId)
    return
  }

  console.error(`[paypal-webhook] PAYMENT.CAPTURE.COMPLETED: no booking or inquiry found for customId ${customId}`)
}

// ─── PAYMENT.CAPTURE.REFUNDED ─────────────────────────────────────────────────

async function handleCaptureRefunded(resource: Record<string, unknown>): Promise<void> {
  const captureId = (resource.id as string | undefined) ?? ''
  if (!captureId) return

  const db = createServiceClient()

  // Find booking by capture id
  const { data: booking } = await db
    .from('bookings')
    .select('id')
    .eq('paypal_capture_id', captureId)
    .maybeSingle()

  if (booking) {
    await db
      .from('bookings')
      .update({ status: 'refunded' })
      .eq('id', booking.id)
    return
  }

  // Try inquiry
  const { data: inquiry } = await db
    .from('trip_inquiries')
    .select('id')
    .eq('paypal_capture_id', captureId)
    .maybeSingle()

  if (inquiry) {
    await db
      .from('trip_inquiries')
      .update({ status: 'cancelled' })
      .eq('id', inquiry.id)
  }
}

// ─── MERCHANT.ONBOARDING.COMPLETED ────────────────────────────────────────────

async function handleMerchantOnboarding(resource: Record<string, unknown>): Promise<void> {
  const merchantId   = resource.merchant_id   as string | undefined
  const trackingId   = resource.tracking_id   as string | undefined   // "guide-{guideId}"
  const isActive     = (resource.payments_receivable as boolean | undefined) === true

  if (!merchantId || !trackingId) {
    console.error('[paypal-webhook] MERCHANT.ONBOARDING.COMPLETED missing merchant_id or tracking_id')
    return
  }

  // tracking_id format: "guide-{guideId}"
  const guideId = trackingId.replace(/^guide-/, '')
  if (!guideId) {
    console.error('[paypal-webhook] Could not extract guideId from tracking_id:', trackingId)
    return
  }

  await syncPayPalMerchant(guideId, merchantId, isActive)
}
