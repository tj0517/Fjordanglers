/**
 * FA-1.42 supplement — the two guard queries through the real PostgREST (LOCAL stack only).
 *
 * Calls the real `hasRecentInquiryFromEmail` and `countAutoSendsSince` from
 * src/lib/supabase/queries.ts with a real service client. Synthetic data only
 * (@example.com); every inserted inquiry is deleted at the end (its events go with it:
 * inquiry_events.inquiry_id is ON DELETE CASCADE). Sends nothing — no e-mail, no AI call.
 *
 * From the repo root:
 *   eval "$(supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
 *   NEXT_PUBLIC_SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY \
 *     node_modules/vitest/vitest.mjs run --config .fa-proofs/fa-1.42/vitest.proof.config.mts
 */

import { it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/supabase/database.types'
import { hasRecentInquiryFromEmail, countAutoSendsSince } from '../../src/lib/supabase/queries'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl) || serviceKey === '') {
  throw new Error(`STOP: not the local stack (NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl})`)
}

const HOUR  = 60 * 60 * 1000
const DAY   = 24 * HOUR
const since = () => new Date(Date.now() - DAY)

it('FA-1.42 guard queries through PostgREST', async () => {
  const client = createClient<Database>(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const ids: string[] = []

  async function insertInquiry(email: string, createdAt?: Date): Promise<string> {
    const { data, error } = await client
      .from('inquiries')
      .insert({
        angler_name:  'Proof Angler',
        angler_email: email,
        party_size:   1,
        status:       'new',
        ...(createdAt != null ? { created_at: createdAt.toISOString() } : {}),
      })
      .select('id')
      .single()
    if (error != null || data == null) throw new Error(`insert ${email} failed: ${error?.message}`)
    ids.push(data.id)
    return data.id
  }

  const mine = [
    'Jan_Kowalski@Example.com', 'janXkowalski@example.com', 'janzzzz@example.com',
    'old.angler@example.com', 'only.one@example.com',
  ]

  try {
    // Pre-clean leftovers of an aborted earlier run (exact addresses only).
    await client.from('inquiries').delete().in('angler_email', mine)

    const r1 = await insertInquiry('Jan_Kowalski@Example.com')
    const r2 = await insertInquiry('janXkowalski@example.com')
    await insertInquiry('janzzzz@example.com')
    await insertInquiry('old.angler@example.com', new Date(Date.now() - 25 * HOUR))
    const r5 = await insertInquiry('only.one@example.com')
    const nobody = randomUUID()

    console.log('\n=== hasRecentInquiryFromEmail (real function, real PostgREST) ===')
    const cases: Array<[string, boolean, () => Promise<boolean>]> = [
      ['stored "Jan_Kowalski@Example.com", looked up as " jan_kowalski@example.com " (mixed case + underscore + spaces)', true,
        () => hasRecentInquiryFromEmail(client, { email: ' jan_kowalski@example.com ', excludeInquiryId: nobody, since: since() })],
      ['stored "janXkowalski@example.com" ALONE (the Jan_Kowalski row is excluded) vs "jan_kowalski@example.com"', false,
        () => hasRecentInquiryFromEmail(client, { email: 'jan_kowalski@example.com', excludeInquiryId: r1, since: since() })],
      ['address with "%" ("jan%@example.com") while "janzzzz@example.com" and others exist', false,
        () => hasRecentInquiryFromEmail(client, { email: 'jan%@example.com', excludeInquiryId: nobody, since: since() })],
      ['address with "*" ("jan*kowalski@example.com") — PostgREST reads * as a wildcard; "janXkowalski" exists', false,
        () => hasRecentInquiryFromEmail(client, { email: 'jan*kowalski@example.com', excludeInquiryId: nobody, since: since() })],
      ['stored row is 25 h old ("old.angler@example.com")', false,
        () => hasRecentInquiryFromEmail(client, { email: 'old.angler@example.com', excludeInquiryId: nobody, since: since() })],
      ['only matching row excluded by id ("only.one@example.com", excludeInquiryId = that row)', false,
        () => hasRecentInquiryFromEmail(client, { email: 'only.one@example.com', excludeInquiryId: r5, since: since() })],
      ['control: same address, nothing excluded', true,
        () => hasRecentInquiryFromEmail(client, { email: 'only.one@example.com', excludeInquiryId: nobody, since: since() })],
    ]
    const results: boolean[] = []
    for (const [label, expected, run] of cases) {
      const got = await run()
      results.push(got)
      console.log(`${got === expected ? 'OK  ' : 'FAIL'} expected ${String(expected).padEnd(5)} got ${String(got).padEnd(5)} — ${label}`)
    }

    console.log('\n=== red proof for the escape: what the database returns for the UNESCAPED pattern ===')
    const raw = async (pattern: string) => {
      const { data, error } = await client
        .from('inquiries').select('angler_email').ilike('angler_email', pattern).in('angler_email', mine).order('angler_email')
      if (error != null) throw new Error(error.message)
      return (data ?? []).map(r => r.angler_email)
    }
    const unescapedUnderscore = await raw('jan_kowalski@example.com')
    const escapedUnderscore   = await raw('jan\\_kowalski@example.com')
    const unescapedPercent    = await raw('jan%@example.com')
    const escapedPercent      = await raw('jan\\%@example.com')
    const starPattern         = await raw('jan\\_kowalski@example.com'.replace('\\_', '*'))
    console.log('ilike jan_kowalski@example.com   (unescaped) →', JSON.stringify(unescapedUnderscore))
    console.log('ilike jan\\_kowalski@example.com  (escaped)   →', JSON.stringify(escapedUnderscore))
    console.log('ilike jan%@example.com           (unescaped) →', JSON.stringify(unescapedPercent))
    console.log('ilike jan\\%@example.com          (escaped)   →', JSON.stringify(escapedPercent))
    console.log('ilike jan*kowalski@example.com   (escaped by us, * left alone) →', JSON.stringify(starPattern),
      '← DB-level false positive; the second comparison in code rejects it (case 4 above is false)')

    console.log('\n=== countAutoSendsSince (real function, real PostgREST) ===')
    const baseline = await countAutoSendsSince(client, since())
    const event = (sent: boolean, occurredAt: Date) => ({
      inquiry_id: r5,
      type:       'agent.auto_send_decided',
      actor_kind: 'agent',
      source:     'app',
      channel:    'email',
      payload:    { sent, score: 0.93, reasons: ['proof'], draft_message_id: null },
      occurred_at: occurredAt.toISOString(),
    })
    const { error: evErr } = await client.from('inquiry_events').insert([
      event(true,  new Date(Date.now() - 1 * HOUR)),
      event(true,  new Date(Date.now() - 2 * HOUR)),
      event(false, new Date(Date.now() - 1 * HOUR)),
      event(true,  new Date(Date.now() - 25 * HOUR)),
    ])
    if (evErr != null) throw new Error(`event insert failed: ${evErr.message}`)
    const after = await countAutoSendsSince(client, since())
    console.log(`events inserted: sent=true @-1h, sent=true @-2h, sent=false @-1h, sent=true @-25h`)
    console.log(`baseline before insert: ${baseline}   count after insert: ${after}   (expected baseline + 2)`)
    console.log(`${after - baseline === 2 ? 'OK  ' : 'FAIL'} count is ${after} (no error)`)

    expect(results).toEqual(cases.map(c => c[1]))
    expect(unescapedUnderscore).toContain('janXkowalski@example.com')   // the reason the escape exists
    expect(escapedUnderscore).toEqual(['Jan_Kowalski@Example.com'])
    expect(after - baseline).toBe(2)
    void r2
  } finally {
    const { error } = await client.from('inquiries').delete().in('id', ids)
    const { count } = await client.from('inquiries').select('id', { count: 'exact', head: true }).in('id', ids)
    const { count: evLeft } = await client.from('inquiry_events').select('id', { count: 'exact', head: true }).in('inquiry_id', ids)
    console.log(`\ncleanup: deleted ${ids.length} inquiries (${error ? error.message : 'no error'}); rows left: inquiries=${count}, inquiry_events=${evLeft}`)
  }
})
