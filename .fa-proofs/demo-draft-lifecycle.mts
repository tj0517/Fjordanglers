/**
 * FA-1.14 round-2 lifecycle demo.
 *
 * Demonstrates:
 *  1. First draftReply → INSERT draft row
 *  2. Second draftReply (same inquiry) → UPDATE same row (upsert, no duplicate)
 *  3. sendMessage with draftId → promotes draft to sent
 *
 * Run with local Supabase stack:
 *   eval "$(supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
 *   NEXT_PUBLIC_SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
 *     pnpm dlx tsx --tsconfig tsconfig.json --env-file=.env.local .fa-proofs/demo-draft-lifecycle.mts
 */

if (process.env.RESEND_DEV_FAKE !== '1') {
  console.error('STOP: set RESEND_DEV_FAKE=1 before running this proof script')
  process.exit(1)
}

import { createClient } from '@supabase/supabase-js'
import { draftReply }   from '../src/lib/ai/draft-reply.js'
import { sendMessage }  from '../src/lib/messages/send.js'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anthropicKey = process.env.ANTHROPIC_API_KEY!

if (!supabaseUrl || !serviceKey || !anthropicKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY')
  process.exit(1)
}

const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

const INQUIRY_ID = '22222222-2222-2222-2222-222222222222'
const KNOWLEDGE_DIR = path.resolve(process.cwd(), 'docs/knowledge')

async function sqlRows() {
  const { data } = await client
    .from('messages')
    .select('id, direction, channel, status, drafted_by, left(body, 60)')
    .eq('inquiry_id', INQUIRY_ID)
    .order('occurred_at')
  return data
}

// ─── Step 1: First draftReply ─────────────────────────────────────────────────
console.log('\n=== STEP 1: First draftReply (should INSERT a draft row) ===')
const r1 = await draftReply({ inquiryId: INQUIRY_ID, counterpart: 'angler', channel: 'email', knowledgeDir: KNOWLEDGE_DIR })
console.log('draftId :', r1.draftId)
console.log('usedFiles:', r1.usedFiles)
console.log('text excerpt:', r1.text.slice(0, 80))
console.log('\nSQL after step 1:')
console.table(await sqlRows())

// ─── Step 2: Second draftReply (should UPDATE, not insert) ───────────────────
console.log('\n=== STEP 2: Second draftReply (should UPDATE same row) ===')
const r2 = await draftReply({ inquiryId: INQUIRY_ID, counterpart: 'angler', channel: 'email', knowledgeDir: KNOWLEDGE_DIR })
console.log('draftId :', r2.draftId, '(should match step 1 id:', r1.draftId, ')')
const isSameId = r2.draftId === r1.draftId
console.log('Same row?', isSameId ? '✓ YES' : '✗ NO — BUG!')
console.log('\nSQL after step 2 (should still be same number of draft rows):')
console.table(await sqlRows())

// ─── Step 3: sendMessage with draftId ────────────────────────────────────────
console.log('\n=== STEP 3: sendMessage with draftId (should promote draft → sent) ===')
// Note: emailAdapter uses RESEND_DEV_FAKE if set in .env.local
// If RESEND_DEV_FAKE is not set and RESEND_API_KEY is fake, send may fail
// but the test for row count is still valid
try {
  const result = await sendMessage(client as never, {
    inquiryId: INQUIRY_ID,
    channel: 'email',
    counterpart: 'angler',
    to: 'piotr@example.invalid',
    body: r2.text,
    draftedBy: 'agent',
    draftId: r2.draftId,
    actor: { kind: 'admin', id: '00000000-0000-0000-0000-000000000099' },
  })
  console.log('messageId:', result.messageId, '(should equal draftId:', r2.draftId, ')')
  console.log('Same row?', result.messageId === r2.draftId ? '✓ YES' : '✗ NO — BUG!')
} catch (err) {
  console.log('sendMessage threw (possibly RESEND failure):', (err as Error).message)
}
console.log('\nSQL after step 3 (draft row should now be status=sent or failed):')
console.table(await sqlRows())

// ─── Count draft rows (should be 0 after step 3) ─────────────────────────────
const { count } = await client
  .from('messages')
  .select('id', { count: 'exact', head: true })
  .eq('inquiry_id', INQUIRY_ID)
  .eq('status', 'draft')
console.log(`\nDraft rows remaining: ${count} (expected: 0)`)
