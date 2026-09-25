/**
 * FA-1.12 acceptance criterion — messages thread walk
 *
 * Proves the full path from inquiry creation to handed_over:
 *   new → waiting_guide
 *   outbound email to angler       (simulates sendMessageFromThread → message.sent)
 *   outbound email to guide        (simulates sendMessageFromThread → message.sent + guide.contacted)
 *   inbound email from guide       (simulates email-inbound webhook → message.received)
 *   markAsGuideOffer               → guide.offer_received
 *   markOfferPresented             → offer.presented + status offer_presented
 *   inbound acceptance from angler (simulates email-inbound webhook → message.received)
 *   markClientAccepted             → offer.accepted + status offer_presented (FA-1.29 D1)
 *   setDepositAmount               → deposit.amount_set (required before createPaymentLink)
 *   createPaymentLink              → payment.link_sent + status awaiting_payment (Stripe test mode)
 *   Stripe deposit webhook         → paid
 *   markContactsExchanged          → contacts.exchanged + status handed_over
 *
 * Note on email sending: sendMessageFromThread calls Resend in production.
 * In this proof we insert the messages row + emit events directly (what
 * sendMessage does internally) to keep the proof runnable without live
 * Resend credentials. The server actions (mark*, create*) run as-is.
 *
 * Signed Stripe webhook uses stripe.webhooks.generateTestHeaderString so
 * signature verification passes without hitting the Stripe API.
 *
 * Local stack only — the fuse below refuses anything that is not 127.0.0.1.
 */

import { NextRequest } from 'next/server'
import { createClient as createSsrClient, createServiceClient } from '@/lib/supabase/server'
import { createClient as createPlainClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { stripe } from '@/lib/stripe/client'
import { emitEvent } from '@/lib/events/emit'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  throw new Error('SAFETY FUSE: this proof only runs against the local stack')
}

const ADMIN_EMAIL    = 'fa112-proof@local.test'
const ADMIN_PASSWORD = 'fa112-proof-password'

function step(n: number, label: string) {
  console.log(`\n── ${n}. ${label} ${'─'.repeat(Math.max(0, 50 - label.length))}`)
}

// ── 0. Setup: ensure admin user exists ───────────────────────────────────────

step(0, 'ensure admin user exists')
const svc  = createServiceClient()
const plain = createPlainClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

let adminUserId: string

const trySignIn = await plain.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
if (trySignIn.error) {
  // Create user
  const { data: created, error: createErr } =
    await svc.auth.admin.createUser({
      email:             ADMIN_EMAIL,
      password:          ADMIN_PASSWORD,
      email_confirm:     true,
    })
  if (createErr != null || created.user == null) {
    throw new Error(`create user failed: ${createErr?.message}`)
  }
  adminUserId = created.user.id
  await svc.from('profiles').upsert({ id: adminUserId, role: 'admin' })
  console.log('   created admin user', ADMIN_EMAIL)
} else {
  adminUserId = trySignIn.data.user!.id
  await svc.from('profiles').upsert({ id: adminUserId, role: 'admin' })
  console.log('   admin user exists', ADMIN_EMAIL)
}

// Sign in and store session in the cookie jar (shared via globalThis)
const { data: signIn, error: signInErr } = await plain.auth.signInWithPassword({
  email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
})
if (signInErr != null || signIn.session == null) {
  throw new Error(`sign-in failed: ${signInErr?.message ?? 'no session'}`)
}
const ssr = await createSsrClient()
await ssr.auth.setSession({
  access_token:  signIn.session.access_token,
  refresh_token: signIn.session.refresh_token,
})
console.log('   session set for', signIn.user?.email)

// ── 1. Create inquiry ─────────────────────────────────────────────────────────

step(1, 'POST /api/inquiries → new')

const { data: pages } = await svc
  .from('experience_pages')
  .select('id')
  .eq('status', 'active')
  .limit(20)
// Filter out seed UUIDs (version-0 third group) which Zod's uuid() rejects
const zodUuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const page = (pages as { id: string }[] | null)?.find(p => zodUuidRe.test(p.id)) ?? null
if (page == null) throw new Error('no active experience_page with valid UUID in local DB')
console.log('   experience_page id:', page.id)

const { POST: createInquiryRoute } = await import('@/app/api/inquiries/route')
const createResp = await createInquiryRoute(new NextRequest('http://localhost:3000/api/inquiries', {
  method:  'POST',
  headers: { 'content-type': 'application/json' },
  body:    JSON.stringify({
    experience_page_id: page.id,
    angler_name:        'FA-1.12 Walk',
    angler_email:       `fa112-walk-${Date.now()}@fa112-seed.test`,
    party_size:         2,
    requested_dates:    ['2026-11-01'],
    message:            'FA-1.12 acceptance walk',
  }),
}))
const created = await createResp.json() as { id?: string; status?: string; error?: string }
if (createResp.status !== 201 || created.id == null) {
  throw new Error(`route returned ${createResp.status}: ${JSON.stringify(created)}`)
}
const inquiryId = created.id
console.log(`   ${createResp.status} → inquiry ${inquiryId}`)

// ── 2. Advance to waiting_guide ───────────────────────────────────────────────

step(2, 'updateInquiryStatus → waiting_guide')
const { updateInquiryStatus } = await import('@/actions/inquiries')
for (const s of ['qualifying', 'waiting_guide'] as const) {
  const r = await updateInquiryStatus(inquiryId, s)
  if (!r.success) throw new Error(`${s}: ${r.error}`)
}
console.log('   ok → waiting_guide')

// ── 3. Find a guide ───────────────────────────────────────────────────────────

step(3, 'find guide with email')
const { data: guide } = await svc
  .from('guides')
  .select('id, invite_email')
  .not('invite_email', 'is', null)
  .limit(1)
  .single()
if (guide == null) throw new Error('no guide with invite_email in local DB')

await svc.from('inquiries').update({ assigned_guide_id: guide.id }).eq('id', inquiryId)
console.log(`   guide ${guide.id} assigned`)

// ── 4. Outbound to angler (simulate sendMessageFromThread) ────────────────────

step(4, 'outbound email → angler (simulates sendMessageFromThread)')
const { data: anglerMsg } = await svc.from('messages').insert({
  inquiry_id:  inquiryId,
  channel:     'email',
  direction:   'outbound',
  counterpart: 'angler',
  body:        'Hi, we have found a great guide for you!',
  subject:     'Your FjordAnglers inquiry',
  status:      'sent',
  drafted_by:  'admin',
  occurred_at: new Date().toISOString(),
}).select('id').single()

await emitEvent(svc, {
  inquiryId,
  type:      'message.sent',
  actor:     { kind: 'admin', id: adminUserId },
  source:    'app',
  channel:   'email',
  messageId: anglerMsg!.id,
})
console.log(`   message ${anglerMsg!.id} → message.sent`)

// ── 5. Outbound to guide (simulate sendMessageFromThread + guide.contacted) ───

step(5, 'outbound email → guide (simulates sendMessageFromThread + guide.contacted)')
const { data: guideOutMsg } = await svc.from('messages').insert({
  inquiry_id:    inquiryId,
  channel:       'email',
  direction:     'outbound',
  counterpart:   'guide',
  counterpart_id: guide.id,
  body:          'Hi, we have an inquiry for a 2-person Atlantic Salmon trip in November.',
  subject:       'New inquiry — FjordAnglers',
  status:        'sent',
  drafted_by:    'admin',
  occurred_at:   new Date(Date.now() + 1000).toISOString(),
}).select('id').single()

await emitEvent(svc, {
  inquiryId,
  type:      'message.sent',
  actor:     { kind: 'admin', id: adminUserId },
  source:    'app',
  channel:   'email',
  messageId: guideOutMsg!.id,
})
await emitEvent(svc, {
  inquiryId,
  type:      'guide.contacted',
  actor:     { kind: 'admin', id: adminUserId },
  source:    'app',
  channel:   'email',
  messageId: guideOutMsg!.id,
  payload:   { guide_id: guide.id },
})
console.log(`   message ${guideOutMsg!.id} → message.sent + guide.contacted`)

// ── 6. Inbound from guide (simulate email-inbound webhook) ───────────────────

step(6, 'inbound email from guide (simulates email-inbound webhook)')
const { data: guideInMsg } = await svc.from('messages').insert({
  inquiry_id:  inquiryId,
  channel:     'email',
  direction:   'inbound',
  counterpart: 'guide',
  body:        'I can offer 3 days salmon fishing, option A: €1800 total. Option B: €2200 with accommodation.',
  status:      'received',
  drafted_by:  null,
  occurred_at: new Date(Date.now() + 2000).toISOString(),
}).select('id').single()

await emitEvent(svc, {
  inquiryId,
  type:      'message.received',
  actor:     { kind: 'guide' },
  source:    'webhook',
  channel:   'email',
  messageId: guideInMsg!.id,
})
console.log(`   guide inbound message ${guideInMsg!.id} → message.received`)

// ── 7. Mark as guide offer ────────────────────────────────────────────────────

step(7, 'markAsGuideOffer → guide.offer_received')
const { markAsGuideOffer } = await import('@/actions/messages')
const offerResult = await markAsGuideOffer(guideInMsg!.id, {
  guideId: guide.id,
  options: [
    {
      label:      'Option A — 3 days salmon, no accommodation',
      priceCents: 180000,
      currency:   'eur',
      dateFrom:   '2026-11-10',
      dateTo:     '2026-11-12',
      partySize:  2,
    },
    {
      label:      'Option B — 3 days salmon + accommodation',
      priceCents: 220000,
      currency:   'eur',
      dateFrom:   '2026-11-10',
      dateTo:     '2026-11-12',
      partySize:  2,
    },
  ],
})
if (!offerResult.success) throw new Error(`markAsGuideOffer: ${offerResult.error}`)
const offerId = offerResult.offerId!
console.log(`   offer ${offerId} created → guide.offer_received`)

// ── 8. Outbound to angler presenting offer ────────────────────────────────────

step(8, 'outbound presenting offer message')
const { data: presentMsg } = await svc.from('messages').insert({
  inquiry_id:  inquiryId,
  channel:     'email',
  direction:   'outbound',
  counterpart: 'angler',
  body:        'We have 2 options from the guide. Option A: €1800. Option B: €2200 with accommodation.',
  subject:     'Guide offer for your FjordAnglers trip',
  status:      'sent',
  drafted_by:  'admin',
  occurred_at: new Date(Date.now() + 3000).toISOString(),
}).select('id').single()

// ── 9. Mark offer presented ───────────────────────────────────────────────────

step(9, 'markOfferPresented → offer.presented + offer_presented')
const { markOfferPresented } = await import('@/actions/messages')
const presentResult = await markOfferPresented(offerId, presentMsg!.id)
if (!presentResult.success) throw new Error(`markOfferPresented: ${presentResult.error}`)
console.log('   ok → offer.presented + offer_presented')

// ── 10. Inbound acceptance from angler ────────────────────────────────────────

step(10, 'inbound acceptance from angler')
const { data: acceptMsg } = await svc.from('messages').insert({
  inquiry_id:  inquiryId,
  channel:     'email',
  direction:   'inbound',
  counterpart: 'angler',
  body:        'We would like Option A please.',
  status:      'received',
  drafted_by:  null,
  occurred_at: new Date(Date.now() + 4000).toISOString(),
}).select('id').single()

await emitEvent(svc, {
  inquiryId,
  type:      'message.received',
  actor:     { kind: 'angler' },
  source:    'webhook',
  channel:   'email',
  messageId: acceptMsg!.id,
})
console.log(`   angler acceptance message ${acceptMsg!.id}`)

// ── 11. Mark client accepted ──────────────────────────────────────────────────

step(11, 'markClientAccepted → offer.accepted (stays offer_presented per FA-1.29 D1)')
const { data: options } = await svc
  .from('offer_options')
  .select('id')
  .eq('offer_id', offerId)
  .limit(1)
  .single()
if (options == null) throw new Error('no offer options found')

const { markClientAccepted } = await import('@/actions/messages')
const acceptResult = await markClientAccepted(offerId, options.id, acceptMsg!.id)
if (!acceptResult.success) throw new Error(`markClientAccepted: ${acceptResult.error}`)
console.log('   ok → offer.accepted (status stays offer_presented)')

// ── 11b. Set deposit amount (FA-1.29 D1: link is the only path to awaiting_payment) ──

step(12, 'setDepositAmount → deposit.amount_set (24000 EUR)')
const { setDepositAmount } = await import('@/actions/inquiries')
const amountResult = await setDepositAmount(inquiryId, 24000)
if (!amountResult.success) throw new Error(`setDepositAmount: ${amountResult.error}`)
console.log('   ok → deposit_amount_cents=24000, deposit_currency=EUR')

// ── 13. Create payment link (Stripe test mode) ────────────────────────────────

step(13, 'createPaymentLink → payment.link_sent + awaiting_payment (Stripe test)')
const { createPaymentLink } = await import('@/actions/messages')
const linkResult = await createPaymentLink(inquiryId)
if (!linkResult.success) throw new Error(`createPaymentLink: ${linkResult.error}`)
console.log(`   payment link: ${linkResult.url}`)

// ── 14. Stripe deposit webhook (signed) ───────────────────────────────────────

step(14, 'POST /api/webhooks/stripe-deposit → paid')
const eventBody = JSON.stringify({
  id: `evt_fa112_proof_${Date.now()}`, object: 'event', type: 'checkout.session.completed',
  data: {
    object: {
      id:             `cs_test_fa112_${Date.now()}`,
      object:         'checkout.session',
      payment_status: 'paid',
      metadata:       { payment_type: 'inquiry_deposit', inquiry_id: inquiryId },
    },
  },
})
const webhookSecret = env.STRIPE_WEBHOOK_SECRET_DEPOSIT ?? env.STRIPE_WEBHOOK_SECRET
const signature = stripe.webhooks.generateTestHeaderString({ payload: eventBody, secret: webhookSecret })
;(globalThis as { __FA_PROOF_HEADERS__?: Record<string, string> }).__FA_PROOF_HEADERS__ = {
  'content-type':     'application/json',
  'stripe-signature': signature,
}
const { POST: stripeWebhook } = await import('@/app/api/webhooks/stripe-deposit/route')
const webhookResp = await stripeWebhook(new NextRequest(
  'http://localhost:3000/api/webhooks/stripe-deposit',
  { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: eventBody },
))
console.log(`   ${webhookResp.status} ${await webhookResp.text()}`)

// ── 15. markContactsExchanged → handed_over ───────────────────────────────────

step(15, 'markContactsExchanged → contacts.exchanged + handed_over')
const { data: contactMsg } = await svc.from('messages').insert({
  inquiry_id:  inquiryId,
  channel:     'email',
  direction:   'outbound',
  counterpart: 'angler',
  body:        "Guide contact: info@guidespatagonia.com — here are the guide's details.",
  status:      'sent',
  drafted_by:  'admin',
  occurred_at: new Date(Date.now() + 5000).toISOString(),
}).select('id').single()

const { markContactsExchanged } = await import('@/actions/messages')
const contactResult = await markContactsExchanged(contactMsg!.id)
if (!contactResult.success) throw new Error(`markContactsExchanged: ${contactResult.error}`)
console.log('   ok → contacts.exchanged + handed_over')

// ── 16. Results ───────────────────────────────────────────────────────────────

step(16, 'result')
const { data: finalRow } = await svc
  .from('inquiries')
  .select('status, stage_reached, deposit_paid_at')
  .eq('id', inquiryId)
  .single()
console.log('   inquiry:', finalRow)

const { data: events } = await svc
  .from('inquiry_events')
  .select('type, channel, source, actor_kind, occurred_at')
  .eq('inquiry_id', inquiryId)
  .order('occurred_at', { ascending: true })

console.table((events ?? []).map((e: { type: string; channel: string | null; source: string; actor_kind: string }) => ({
  type: e.type, channel: e.channel, source: e.source, actor: e.actor_kind,
})))
console.log(`\n   total events: ${events?.length ?? 0}`)
console.log(`   final status: ${finalRow?.status}`)
console.log(`\nINQUIRY_ID=${inquiryId}`)
