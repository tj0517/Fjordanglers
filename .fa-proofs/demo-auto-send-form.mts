/**
 * FA-1.40 — auto-send replies to a first form inquiry (empty thread, text in inquiries.message).
 *
 * Creates a fresh inquiry in the LOCAL db (message set, no messages rows), runs autoSendReply,
 * prints the messages + inquiry_events rows. Case "nomessage" creates an inquiry with neither.
 * Real Anthropic calls (draft + judge); email goes through the fake adapter only.
 *
 * Runs under vitest (no tsx in the repo; gives the @/ alias). From the repo root:
 *   eval "$(supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
 *   NEXT_PUBLIC_SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
 *     RESEND_DEV_FAKE=1 PROOF_CASE=form|nomessage node --env-file=.env.local \
 *     node_modules/vitest/vitest.mjs run --config .fa-proofs/vitest.proof.config.mts
 */

if (process.env.RESEND_DEV_FAKE !== '1') {
  console.error('STOP: set RESEND_DEV_FAKE=1 before running this proof script')
  process.exit(1)
}

import { it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { autoSendReply } from '../src/lib/ai/auto-send.js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl ?? '')) {
  console.error('STOP: NEXT_PUBLIC_SUPABASE_URL is not the local stack:', supabaseUrl)
  process.exit(1)
}

it('FA-1.40 proof', async () => {
  const kase = process.env.PROOF_CASE ?? 'form'
  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const message = kase === 'nomessage'
    ? null
    : 'Hi! Two of us would like to fly-fish in Iceland in the second half of July, about 3 days. ' +
      'We have fished for trout in Scotland but never for Arctic char. Which river would you suggest?'

  const { data: inquiry, error } = await client
    .from('inquiries')
    .insert({
      angler_name:  'Proof Angler',
      angler_email: 'proof-angler@seed.test',
      trip_country: 'Iceland',
      party_size:   2,
      message,
      status:       'new',
    })
    .select('id')
    .single()
  if (error != null || inquiry == null) { console.error('insert failed:', error); throw new Error('insert failed') }
  console.log(`inquiry ${inquiry.id} (case=${kase}), messages rows: 0`)

  const result = await autoSendReply({ inquiryId: inquiry.id, counterpart: 'angler', channel: 'email' })
  console.log('\nautoSendReply →', JSON.stringify(result))

  const { data: msgs } = await client.from('messages')
    .select('direction, counterpart, status, drafted_by, body').eq('inquiry_id', inquiry.id)
  console.log('\nmessages:'); console.table(msgs)
  const { data: events } = await client.from('inquiry_events')
    .select('type, actor_kind, payload').eq('inquiry_id', inquiry.id).order('created_at')
  console.log('inquiry_events:'); console.log(JSON.stringify(events, null, 1))

}, 180_000)
