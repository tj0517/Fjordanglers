/**
 * FA-1.13 fix — an inbound WhatsApp from an *assigned* guide lands in the thread.
 *
 * matchInboundPhone looked up the guide's open inquiries with `.eq('guide_id', …)`.
 * `inquiries.guide_id` is the owner of the experience page the inquiry came from
 * (written once by createInquiry); the guide an admin assigns is `assigned_guide_id`
 * (actions/inquiries.ts). So a guide assigned by the admin — usually not the page
 * owner — who writes first, before any outbound message to them exists, matched
 * nothing and went to `unmatched`.
 *
 * Runs against the real local stack, not a mock: the point is also that the `.or()`
 * filter string is valid PostgREST syntax, which a fake query builder cannot prove.
 * Self-contained: inserts its own guides and inquiries, deletes them in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServiceClient } from '@/lib/supabase/server'
import { matchInboundPhone } from '@/lib/inquiry-matcher'

const G_ASSIGNED = '0a1b2c3d-0001-4a00-8000-000000000001'
const G_OWNER    = '0a1b2c3d-0002-4a00-8000-000000000002'
const P_ASSIGNED = '+3547770991'
const P_OWNER    = '+3547770992'
const EMAIL_LIKE = 'fa-1.13-matcher-%@regression.test'

let inqAssigned = ''
let inqOwner    = ''

async function cleanup() {
  const svc = createServiceClient()
  await svc.from('inquiries').delete().like('angler_email', EMAIL_LIKE)
  await svc.from('guides').delete().in('id', [G_ASSIGNED, G_OWNER])
}

beforeAll(async () => {
  const svc = createServiceClient()
  await cleanup()

  const g = await svc.from('guides').insert([
    { id: G_ASSIGNED, full_name: 'FA-1.13 matcher — assigned guide', country: 'Iceland' },
    { id: G_OWNER,    full_name: 'FA-1.13 matcher — page owner',     country: 'Iceland' },
  ])
  expect(g.error).toBeNull()
  const c = await svc.from('guide_contacts').insert([
    { guide_id: G_ASSIGNED, phone_e164: P_ASSIGNED },
    { guide_id: G_OWNER,    phone_e164: P_OWNER },
  ])
  expect(c.error).toBeNull()

  // Assigned by an admin: assigned_guide_id set, guide_id null, no outbound message.
  const a = await svc.from('inquiries')
    .insert({ angler_name: 'Matcher A', angler_email: 'fa-1.13-matcher-a@regression.test', assigned_guide_id: G_ASSIGNED })
    .select('id').single()
  expect(a.error).toBeNull()
  inqAssigned = a.data!.id

  // Historical / page-owner shape: guide_id set, nobody assigned, no outbound message.
  const o = await svc.from('inquiries')
    .insert({ angler_name: 'Matcher B', angler_email: 'fa-1.13-matcher-b@regression.test', guide_id: G_OWNER })
    .select('id').single()
  expect(o.error).toBeNull()
  inqOwner = o.data!.id
})

afterAll(cleanup)

describe('FA-1.13 — matchInboundPhone, guide side', () => {
  it('assigned guide, zero outbound messages → matched to the thread as guide', async () => {
    const matches = await matchInboundPhone(P_ASSIGNED)
    expect(matches).toEqual([
      { inquiryId: inqAssigned, counterpart: 'guide', counterpartId: G_ASSIGNED },
    ])
  })

  it('guide_id-only inquiry (page owner / historical data) still matches', async () => {
    const matches = await matchInboundPhone(P_OWNER)
    expect(matches).toEqual([
      { inquiryId: inqOwner, counterpart: 'guide', counterpartId: G_OWNER },
    ])
  })

  it('unknown number → no match', async () => {
    expect(await matchInboundPhone('+3547770000')).toEqual([])
  })
})
