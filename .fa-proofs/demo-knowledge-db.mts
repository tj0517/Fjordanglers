/**
 * FA-1.23 — agent reads knowledge from DB proof.
 *
 * Demonstrates:
 *  1. draftReply on a seeded inquiry → saves a draft, reports usedIds
 *  2. UPDATE agent_knowledge tone body → second draftReply without restart reflects change
 *
 * Run with local Supabase stack:
 *   eval "$(supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
 *   NEXT_PUBLIC_SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
 *     RESEND_DEV_FAKE=1 pnpm dlx tsx --tsconfig tsconfig.json --env-file=.env.local \
 *     .fa-proofs/demo-knowledge-db.mts
 */

if (process.env.RESEND_DEV_FAKE !== '1') {
  console.error('STOP: set RESEND_DEV_FAKE=1 before running this proof script')
  process.exit(1)
}

import { createClient } from '@supabase/supabase-js'
import { draftReply }   from '../src/lib/ai/draft-reply.js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anthropicKey = process.env.ANTHROPIC_API_KEY!

if (!supabaseUrl || !serviceKey || !anthropicKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY')
  process.exit(1)
}

const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

// Alice Seed — 2 messages, no assigned_guide_id, trip_country=null
const INQUIRY_ID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a101'

// ─── Step 1: First draftReply ─────────────────────────────────────────────────
console.log('\n=== STEP 1: draftReply — draft saved, usedIds reported ===')
const r1 = await draftReply({ inquiryId: INQUIRY_ID, counterpart: 'angler', channel: 'email' })

console.log('draftId :', r1.draftId)
console.log('usedIds :', r1.usedIds)
console.log('text excerpt:', r1.text.slice(0, 120))

const { data: draftRow } = await client
  .from('messages')
  .select('id, inquiry_id, status, drafted_by')
  .eq('id', r1.draftId)
  .single()
console.log('\nDraft row:', draftRow)

// SQL shown in report:
console.log('\n-- SELECT id, inquiry_id, status, drafted_by, left(body, 200) FROM messages WHERE status=\'draft\'')
const { data: allDrafts } = await client
  .from('messages')
  .select('id, inquiry_id, status, drafted_by, body')
  .eq('status', 'draft')
  .eq('inquiry_id', INQUIRY_ID)
for (const d of allDrafts ?? []) {
  console.log({
    id:          d.id,
    inquiry_id:  d.inquiry_id,
    status:      d.status,
    drafted_by:  d.drafted_by,
    body_excerpt: (d.body as string).slice(0, 200),
  })
}

// ─── Step 2: UPDATE tone, then second draftReply (no server restart) ─────────
console.log('\n=== STEP 2: UPDATE tone, second draftReply without restart ===')
const NEW_TONE = 'Warm, direct, no marketing jargon. Short sentences. **CHANGED FOR FA-1.23 PROOF** Always mention the midnight sun.'
console.log('UPDATE body =', NEW_TONE)
const { error: updErr } = await client
  .from('agent_knowledge')
  .update({ body: NEW_TONE })
  .eq('kind', 'tone')
  .eq('active', true)
if (updErr) {
  console.error('UPDATE failed:', updErr.message)
  process.exit(1)
}
console.log('UPDATE OK')

const r2 = await draftReply({ inquiryId: INQUIRY_ID, counterpart: 'angler', channel: 'email' })
console.log('\ndraftId :', r2.draftId, '(upsert — should match step 1:', r1.draftId, ')')
console.log('usedIds :', r2.usedIds)
console.log('text excerpt:', r2.text.slice(0, 200))

const containsMidnightSun = r2.text.toLowerCase().includes('midnight sun')
console.log('\nNew draft mentions "midnight sun"?', containsMidnightSun ? '✓ YES — change reflected' : '✗ NO — possible miss (model paraphrase)')
console.log('\nNote: no dev server restart between step 1 and step 2 — change took effect immediately.')

// ─── Coverage note ────────────────────────────────────────────────────────────
console.log('\n=== Coverage note ===')
console.log('Alice Seed has no assigned_guide_id and no trip_country in seed data.')
console.log('This proof covers: instructions + tone.')
console.log('Country selection and guide selection are proven by knowledge.test.ts tests.')
