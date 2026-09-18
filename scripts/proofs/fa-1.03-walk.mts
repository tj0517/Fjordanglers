/**
 * FA-1.03 acceptance criterion 5 — walk one inquiry
 *   new → qualifying → waiting_guide → offer_presented → awaiting_payment → paid
 * through the application's own entry points (never SQL) and show the events.
 *
 * Entry points used:
 *   new              POST /api/inquiries        (route handler, real NextRequest)
 *   qualifying       updateInquiryStatus()      (server action behind StatusChanger)
 *   waiting_guide    updateInquiryStatus()
 *   offer_presented  updateInquiryStatus()
 *   awaiting_payment updateInquiryStatus()
 *   paid             POST /api/webhooks/stripe-deposit (signed test event)
 *
 * Local stack only — the guard below refuses anything that is not 127.0.0.1.
 */

import { NextRequest } from 'next/server'
import { createClient as createSsrClient, createServiceClient } from '@/lib/supabase/server'
import { createClient as createPlainClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { stripe } from '@/lib/stripe/client'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  throw new Error('SAFETY FUSE: this proof only runs against the local stack')
}

const ADMIN_EMAIL    = 'fa103-proof@local.test'
const ADMIN_PASSWORD = 'fa103-proof-password'
const ANGLER_EMAIL   = `fa103-walk-${Date.now()}@fa103-seed.test`

function step(n: number, label: string) {
  console.log(`\n── ${n}. ${label} ${'─'.repeat(Math.max(0, 50 - label.length))}`)
}

// ── sign in as admin so requireAdmin() passes on a real session ───────────────

step(0, 'sign in as admin')
const plain = createPlainClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const { data: signIn, error: signInError } =
  await plain.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
if (signInError != null || signIn.session == null) {
  throw new Error(`sign-in failed: ${signInError?.message ?? 'no session'}`)
}
const ssr = await createSsrClient()
await ssr.auth.setSession({
  access_token:  signIn.session.access_token,
  refresh_token: signIn.session.refresh_token,
})
console.log('   session set for', signIn.user?.email)

const svc = createServiceClient()

// ── new: the public widget's route handler ───────────────────────────────────

step(1, 'POST /api/inquiries  → new')
const { data: page } = await svc
  .from('experience_pages')
  .select('id, experience_name')
  .eq('status', 'active')
  .limit(1)
  .single()
if (page == null) throw new Error('no active experience_page in the local database')

const { POST: createInquiryRoute } = await import('@/app/api/inquiries/route')
const createResponse = await createInquiryRoute(new NextRequest('http://localhost:3000/api/inquiries', {
  method:  'POST',
  headers: { 'content-type': 'application/json' },
  body:    JSON.stringify({
    experience_page_id: page.id,
    angler_name:        'FA-1.03 Walk',
    angler_email:       ANGLER_EMAIL,
    party_size:         2,
    requested_dates:    ['2026-10-12'],
    message:            'Proof of the state machine walk',
  }),
}))
const created = await createResponse.json() as { id?: string; status?: string; error?: string }
if (createResponse.status !== 201 || created.id == null) {
  throw new Error(`route returned ${createResponse.status}: ${JSON.stringify(created)}`)
}
const inquiryId = created.id
console.log(`   ${createResponse.status} — inquiry ${inquiryId} status=${created.status}`)

// ── the middle of the process: the admin's StatusChanger action ──────────────

const { updateInquiryStatus } = await import('@/actions/inquiries')

for (const [n, status] of [
  [2, 'qualifying'], [3, 'waiting_guide'], [4, 'offer_presented'], [5, 'awaiting_payment'],
] as const) {
  step(n, `updateInquiryStatus → ${status}`)
  const res = await updateInquiryStatus(inquiryId, status)
  if (!res.success) throw new Error(`${status}: ${res.error}`)
  console.log(`   ok → ${status}`)
}

// ── a rejected move, to show the machine is the one deciding ─────────────────

step(6, 'updateInquiryStatus → qualifying (backwards from awaiting_payment: allowed)')
console.log('   skipped on purpose — the walk continues to paid')

step(6, 'updateInquiryStatus → completed (not reachable from awaiting_payment)')
const rejected = await updateInquiryStatus(inquiryId, 'completed')
console.log(`   success=${rejected.success}  error=${'error' in rejected ? rejected.error : '—'}`)

// ── paid: the Stripe webhook, signed like Stripe signs it ────────────────────

step(7, 'POST /api/webhooks/stripe-deposit → paid')
const eventBody = JSON.stringify({
  id: 'evt_fa103_proof', object: 'event', type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_fa103_proof', object: 'checkout.session', payment_status: 'paid',
      metadata: { payment_type: 'inquiry_deposit', inquiry_id: inquiryId },
    },
  },
})
const webhookSecret = env.STRIPE_WEBHOOK_SECRET_DEPOSIT ?? env.STRIPE_WEBHOOK_SECRET
const signature = stripe.webhooks.generateTestHeaderString({ payload: eventBody, secret: webhookSecret })

// The handler reads the signature through next/headers, and the stub serves it from
// globalThis so it does not matter which module instance the app got.
;(globalThis as { __FA_PROOF_HEADERS__?: Record<string, string> }).__FA_PROOF_HEADERS__ = {
  'content-type':     'application/json',
  'stripe-signature': signature,
}

const { POST: stripeWebhook } = await import('@/app/api/webhooks/stripe-deposit/route')
const webhookResponse = await stripeWebhook(new NextRequest('http://localhost:3000/api/webhooks/stripe-deposit', {
  method:  'POST',
  headers: { 'content-type': 'application/json', 'stripe-signature': signature },
  body:    eventBody,
}))
console.log(`   ${webhookResponse.status} ${await webhookResponse.text()}`)

// ── what the database ended up with ──────────────────────────────────────────

step(8, 'result')
const { data: finalRow } = await svc
  .from('inquiries').select('status, stage_reached, deposit_paid_at').eq('id', inquiryId).single()
console.log('   inquiry:', finalRow)

const { data: events } = await svc
  .from('inquiry_events')
  .select('type, from_status, to_status, actor_kind, actor_id, channel, source, occurred_at')
  .eq('inquiry_id', inquiryId)
  .order('occurred_at', { ascending: true })

console.table((events ?? []).map(e => ({
  type: e.type, from: e.from_status, to: e.to_status,
  actor: `${e.actor_kind}${e.actor_id != null ? ':' + e.actor_id.slice(0, 8) : ''}`,
  channel: e.channel, source: e.source,
})))

const statusChanged = (events ?? []).filter(e => e.type === 'status.changed')
console.log(`\n   status.changed count: ${statusChanged.length}`)
console.log(`   path: ${statusChanged.map(e => e.to_status).join(' → ')}`)
console.log(`\nINQUIRY_ID=${inquiryId}`)
