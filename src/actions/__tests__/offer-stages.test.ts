/**
 * FA-1.76 — offer stages without needless blocks, against the real local stack.
 *
 *   • "Client accepted" on a draft offer records presented on the way (D2.2)
 *   • "Mark as presented" without a message (D2.2)
 *   • Back to draft, change accepted option — with and without a live deposit link (D2.3, D2.5);
 *     the deposit set for the withdrawn option is cleared (tj 2026-10-27, option B)
 *   • Notify guide / contacts exchanged without a guide message (D2.4)
 *   • Restore from lost into the three loop statuses; the money path stays shut (D5 a)
 *   • Declined offer → reopen, or replace with a new one (superseded)
 *
 * Env and safety fuse: src/tests/setup.ts (local URL only). Every inquiry is created here
 * under the fixed ids below and deleted in afterAll; the seed's rows are never touched.
 * Fixtures write statuses directly — that is arrangement, not the code under test.
 *
 * Mocked: next/cache and the session client (only exist inside a Next request), and
 * Stripe — `paymentLinks.update` is asserted, never sent anywhere.
 */

import { vi, describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

const h = vi.hoisted(() => ({ sessionClient: null as unknown }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/supabase/server', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return {
    createClient: vi.fn(async () => h.sessionClient),
    createServiceClient: vi.fn(() =>
      createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    ),
  }
})
vi.mock('@/lib/stripe/client', () => ({
  stripe: { paymentLinks: { update: vi.fn() } },
}))
vi.mock('@/lib/ai/draft-deposit-link', () => ({
  draftDepositLinkMessage:       vi.fn(),
  buildStripeProductName:        vi.fn(),
  buildStripeProductDescription: vi.fn(),
}))
vi.mock('@/lib/ai/knowledge', () => ({ loadKnowledge: vi.fn() }))
vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_APP_URL: 'https://test.example.com' } }))

import { stripe } from '@/lib/stripe/client'
import {
  markClientAccepted,
  markOfferPresented,
  backToDraft,
  changeAcceptedOption,
  reopenOffer,
  markAsGuideOffer,
  markGuideNotifiedPaid,
  markContactsExchanged,
} from '@/actions/messages'
import { updateInquiryStatus } from '@/actions/inquiries'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const INQ = {
  skip:         '17600000-0000-4000-8000-000000000001',
  present:      '17600000-0000-4000-8000-000000000002',
  presentMsg:   '17600000-0000-4000-8000-000000000003',
  backDraft:    '17600000-0000-4000-8000-000000000004',
  change:       '17600000-0000-4000-8000-000000000005',
  changeLink:   '17600000-0000-4000-8000-000000000006',
  changeFail:   '17600000-0000-4000-8000-000000000007',
  guide:        '17600000-0000-4000-8000-000000000008',
  restoreQ:     '17600000-0000-4000-8000-000000000009',
  restoreW:     '17600000-0000-4000-8000-00000000000a',
  restoreO:     '17600000-0000-4000-8000-00000000000b',
  lostBad:      '17600000-0000-4000-8000-00000000000c',
  cancelled:    '17600000-0000-4000-8000-00000000000d',
  declined:     '17600000-0000-4000-8000-00000000000e',
  lostLocked:   '17600000-0000-4000-8000-00000000000f',
  changeDep:    '17600000-0000-4000-8000-000000000010',
} as const
const ALL_INQ = Object.values(INQ)

type Db = SupabaseClient<Database>
type InquiryStatus = Database['public']['Tables']['inquiries']['Row']['status']

function db(): Db {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

let adminId = ''

async function cleanup(): Promise<void> {
  const { error } = await db().from('inquiries').delete().in('id', ALL_INQ)
  if (error != null) throw new Error(`cleanup: ${error.message}`)
}

async function makeInquiry(
  id: string,
  status: InquiryStatus,
  extra: Partial<Database['public']['Tables']['inquiries']['Insert']> = {},
): Promise<void> {
  const { error } = await db().from('inquiries').insert({
    id, status, angler_name: 'FA-1.76 test', angler_email: 'fa176@test.invalid', ...extra,
  })
  if (error != null) throw new Error(`insert inquiry ${id}: ${error.message}`)
}

/** An offer with two options, then moved to `status` (and option 1 accepted when accepted). */
async function makeOffer(inquiryId: string, status: string): Promise<{ offerId: string; opt1: string; opt2: string }> {
  const svc = db()
  const { data: offerId, error } = await svc.rpc('create_offer_with_options', {
    p_inquiry_id:        inquiryId,
    p_guide_id:          null as unknown as string,
    p_source_message_id: null as unknown as string,
    p_created_by:        adminId,
    p_options: [
      { label: '3 days', price_cents: 300000, currency: 'eur', includes: [] },
      { label: '5 days', price_cents: 450000, currency: 'eur', includes: [] },
    ],
  })
  if (error != null || offerId == null) throw new Error(`offer for ${inquiryId}: ${error?.message}`)
  const { data: opts } = await svc.from('offer_options').select('id, label').eq('offer_id', offerId).order('label')
  const opt1 = opts!.find(o => o.label === '3 days')!.id
  const opt2 = opts!.find(o => o.label === '5 days')!.id
  if (status === 'accepted') await svc.from('offer_options').update({ is_accepted: true }).eq('id', opt1)
  if (status !== 'draft') await svc.from('offers').update({ status }).eq('id', offerId)
  return { offerId, opt1, opt2 }
}

/** A deposit as setDepositAmount leaves it — all four columns (deposit_cents_all_or_nothing). */
const DEPOSIT = {
  deposit_amount_cents: 60000,
  deposit_currency:     'EUR',
  deposit_eur_rate:     1,
  deposit_eur_rate_at:  '2026-10-27T10:00:00+00:00',
} as const
const NO_DEPOSIT = { deposit_amount_cents: null, deposit_currency: null, deposit_eur_rate: null, deposit_eur_rate_at: null }

async function inquiry(id: string) {
  const { data } = await db()
    .from('inquiries')
    .select('status, lost_reason_code, lost_reason, deposit_payment_link_id, deposit_payment_link_url, deposit_amount_cents, deposit_currency, deposit_eur_rate, deposit_eur_rate_at')
    .eq('id', id)
    .single()
  return data!
}

async function offerRow(id: string) {
  const { data } = await db().from('offers').select('status').eq('id', id).single()
  return data!
}

async function accepted(offerId: string): Promise<string[]> {
  const { data } = await db().from('offer_options').select('id').eq('offer_id', offerId).eq('is_accepted', true)
  return (data ?? []).map(o => o.id)
}

async function events(inquiryId: string) {
  const { data } = await db()
    .from('inquiry_events')
    .select('type, from_status, to_status, message_id, channel, payload')
    .eq('inquiry_id', inquiryId)
    .order('occurred_at', { ascending: true })
    .order('id', { ascending: true })
  return data ?? []
}

beforeAll(async () => {
  const client = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data, error } = await client.auth.signInWithPassword({ email: 'admin@seed.test', password: 'seed-admin-password-2026' })
  if (error != null || data.user == null) throw new Error(`sign-in as admin@seed.test failed: ${error?.message}`)
  h.sessionClient = client
  adminId = data.user.id
  await cleanup()
})

afterAll(cleanup)

beforeEach(() => { vi.mocked(stripe.paymentLinks.update).mockReset() })

// ─── D2.2 — skip "presented" ──────────────────────────────────────────────────

describe('"Client accepted" on a draft offer (D2.2)', () => {
  it('one click: offer accepted, inquiry offer_presented, offer.presented + offer.accepted', async () => {
    await makeInquiry(INQ.skip, 'waiting_guide')
    const { offerId, opt2 } = await makeOffer(INQ.skip, 'draft')

    const res = await markClientAccepted(offerId, opt2)

    expect(res).toEqual({ success: true })
    expect((await offerRow(offerId)).status).toBe('accepted')
    expect(await accepted(offerId)).toEqual([opt2])
    expect((await inquiry(INQ.skip)).status).toBe('offer_presented')
    const ev = await events(INQ.skip)
    expect(ev.map(e => e.type)).toEqual(['offer.presented', 'status.changed', 'offer.accepted'])
    expect(ev[0]).toMatchObject({ message_id: null, payload: { offer_id: offerId } })
    expect(ev[1]).toMatchObject({ from_status: 'waiting_guide', to_status: 'offer_presented' })
    expect(ev[2]).toMatchObject({ payload: { offer_id: offerId, option_id: opt2 } })
    // FA-1.29 D1 holds: awaiting_payment only through the deposit link
    expect(ev.some(e => e.to_status === 'awaiting_payment')).toBe(false)
  })

  it('a second "Client accepted" is refused — change the accepted option first', async () => {
    const { data: off } = await db().from('offers').select('id').eq('inquiry_id', INQ.skip).single()
    const { data: opts } = await db().from('offer_options').select('id, is_accepted').eq('offer_id', off!.id)
    const other = opts!.find(o => !o.is_accepted)!.id

    const res = await markClientAccepted(off!.id, other)

    expect(res).toMatchObject({ success: false, error: expect.stringMatching(/Change accepted option/) })
    expect(await accepted(off!.id)).not.toContain(other)
  })
})

describe('"Mark as presented" without a client message (D2.2)', () => {
  it('works with no message: offer presented, inquiry offer_presented, event without message', async () => {
    await makeInquiry(INQ.present, 'qualifying')
    const { offerId } = await makeOffer(INQ.present, 'draft')

    expect(await markOfferPresented(offerId, null)).toEqual({ success: true })

    expect((await offerRow(offerId)).status).toBe('presented')
    expect((await inquiry(INQ.present)).status).toBe('offer_presented')
    const ev = await events(INQ.present)
    expect(ev.map(e => e.type)).toEqual(['offer.presented', 'status.changed'])
    expect(ev[0]).toMatchObject({ message_id: null, channel: null })
  })

  it('attaches the message when there is one, with its channel', async () => {
    await makeInquiry(INQ.presentMsg, 'waiting_guide')
    const { offerId } = await makeOffer(INQ.presentMsg, 'draft')
    const { data: msg } = await db().from('messages').insert({
      inquiry_id: INQ.presentMsg, channel: 'whatsapp', direction: 'outbound', counterpart: 'angler',
      body: 'Here is the offer', status: 'sent',
    }).select('id').single()

    expect(await markOfferPresented(offerId, msg!.id)).toEqual({ success: true })

    const ev = await events(INQ.presentMsg)
    expect(ev[0]).toMatchObject({ type: 'offer.presented', message_id: msg!.id, channel: 'whatsapp' })
  })
})

// ─── D2.3 / D2.5 — step back ──────────────────────────────────────────────────

describe('step back (D2.3)', () => {
  it('Back to draft: presented → draft, offer.reverted, inquiry status unchanged', async () => {
    await makeInquiry(INQ.backDraft, 'offer_presented')
    const { offerId } = await makeOffer(INQ.backDraft, 'presented')

    expect(await backToDraft(offerId)).toEqual({ success: true })

    expect((await offerRow(offerId)).status).toBe('draft')
    expect((await inquiry(INQ.backDraft)).status).toBe('offer_presented')
    const ev = await events(INQ.backDraft)
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ type: 'offer.reverted', payload: { offer_id: offerId, from: 'presented', to: 'draft' } })
  })

  it('Change accepted option without a link: accepted → presented, option cleared, no Stripe call', async () => {
    await makeInquiry(INQ.change, 'offer_presented')
    const { offerId, opt1, opt2 } = await makeOffer(INQ.change, 'accepted')

    expect(await changeAcceptedOption(offerId)).toEqual({ success: true })

    expect((await offerRow(offerId)).status).toBe('presented')
    expect(await accepted(offerId)).toEqual([])
    expect((await inquiry(INQ.change)).status).toBe('offer_presented')
    expect(vi.mocked(stripe.paymentLinks.update)).not.toHaveBeenCalled()
    const ev = await events(INQ.change)
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({
      type: 'offer.reverted', payload: { offer_id: offerId, from: 'accepted', to: 'presented', option_id: opt1 },
    })

    // …and the other option can now be accepted (one accepted per offer still holds)
    expect(await markClientAccepted(offerId, opt2)).toEqual({ success: true })
    expect(await accepted(offerId)).toEqual([opt2])
  })

  it('clears the deposit set for the withdrawn option and records the old one in offer.reverted (tj 2026-10-27)', async () => {
    await makeInquiry(INQ.changeDep, 'offer_presented', DEPOSIT)
    const { offerId, opt1 } = await makeOffer(INQ.changeDep, 'accepted')

    expect(await changeAcceptedOption(offerId)).toEqual({ success: true })

    expect(await inquiry(INQ.changeDep)).toMatchObject({ status: 'offer_presented', ...NO_DEPOSIT })
    const ev = await events(INQ.changeDep)
    expect(ev.map(e => e.type)).toEqual(['offer.reverted'])
    expect(ev[0].payload).toMatchObject({
      option_id:       opt1,
      deposit_cleared: { amount_cents: 60000, currency: 'EUR', eur_rate: 1 },
    })
    expect(Date.parse((ev[0].payload as { deposit_cleared: { eur_rate_at: string } }).deposit_cleared.eur_rate_at))
      .toBe(Date.parse(DEPOSIT.deposit_eur_rate_at))
  })
})

describe('change accepted option with an active deposit link (D2.5)', () => {
  it('deactivates the link in Stripe, forgets it, and moves awaiting_payment → offer_presented', async () => {
    vi.mocked(stripe.paymentLinks.update).mockResolvedValue({ id: 'plink_fa176', active: false } as never)
    await makeInquiry(INQ.changeLink, 'awaiting_payment', {
      ...DEPOSIT,
      deposit_payment_link_id:  'plink_fa176',
      deposit_payment_link_url: 'https://buy.stripe.com/test_fa176',
    })
    const { offerId, opt1 } = await makeOffer(INQ.changeLink, 'accepted')

    expect(await changeAcceptedOption(offerId)).toEqual({ success: true })

    expect(vi.mocked(stripe.paymentLinks.update)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(stripe.paymentLinks.update)).toHaveBeenCalledWith('plink_fa176', { active: false })
    const inq = await inquiry(INQ.changeLink)
    expect(inq).toMatchObject({
      status: 'offer_presented', deposit_payment_link_id: null, deposit_payment_link_url: null, ...NO_DEPOSIT,
    })
    expect((await offerRow(offerId)).status).toBe('presented')
    expect(await accepted(offerId)).toEqual([])
    const ev = await events(INQ.changeLink)
    expect(ev.map(e => e.type)).toEqual(['status.changed', 'offer.reverted'])
    expect(ev[0]).toMatchObject({ from_status: 'awaiting_payment', to_status: 'offer_presented' })
    expect(ev[1]).toMatchObject({
      payload: {
        from: 'accepted', to: 'presented', option_id: opt1, link_id: 'plink_fa176',
        deposit_cleared: { amount_cents: 60000, currency: 'EUR', eur_rate: 1 },
      },
    })
  })

  it('when Stripe refuses, nothing changes — link, status, offer and log stay as they were', async () => {
    vi.mocked(stripe.paymentLinks.update).mockRejectedValue(new Error('Stripe network error'))
    await makeInquiry(INQ.changeFail, 'awaiting_payment', {
      ...DEPOSIT,
      deposit_payment_link_id:  'plink_fa176_fail',
      deposit_payment_link_url: 'https://buy.stripe.com/test_fa176_fail',
    })
    const { offerId, opt1 } = await makeOffer(INQ.changeFail, 'accepted')

    const res = await changeAcceptedOption(offerId)

    expect(res).toMatchObject({ success: false, error: expect.stringMatching(/nothing was changed/) })
    expect(await inquiry(INQ.changeFail)).toMatchObject({
      status: 'awaiting_payment', deposit_payment_link_id: 'plink_fa176_fail', deposit_amount_cents: 60000, deposit_currency: 'EUR',
    })
    expect((await offerRow(offerId)).status).toBe('accepted')
    expect(await accepted(offerId)).toEqual([opt1])
    expect(await events(INQ.changeFail)).toEqual([])
  })
})

// ─── D2.4 — guide steps without a message ─────────────────────────────────────

describe('Notify guide / Contacts exchanged without a guide message (D2.4)', () => {
  it('notify works with no message, once; contacts works with no message and hands over', async () => {
    await makeInquiry(INQ.guide, 'paid', { deposit_paid_at: new Date().toISOString() })

    expect(await markGuideNotifiedPaid(INQ.guide, null)).toEqual({ success: true })
    expect(await markGuideNotifiedPaid(INQ.guide, null))
      .toEqual({ success: false, error: 'The guide is already marked as notified' })
    expect(await markContactsExchanged(INQ.guide, null)).toEqual({ success: true })

    expect((await inquiry(INQ.guide)).status).toBe('handed_over')
    const ev = await events(INQ.guide)
    expect(ev.map(e => e.type)).toEqual(['guide.notified_paid', 'contacts.exchanged', 'status.changed'])
    expect(ev[0]).toMatchObject({ message_id: null })
    expect(ev[1]).toMatchObject({ message_id: null })
    expect(ev[2]).toMatchObject({ from_status: 'paid', to_status: 'handed_over' })
  })

  it('refuses before the deposit is paid', async () => {
    expect(await markGuideNotifiedPaid(INQ.skip, null))
      .toMatchObject({ success: false, error: expect.stringMatching(/not paid yet/) })
  })
})

// ─── D5 a — restore from lost ─────────────────────────────────────────────────

describe('restore from lost (D5 a)', () => {
  it.each([
    ['qualifying',      INQ.restoreQ],
    ['waiting_guide',   INQ.restoreW],
    ['offer_presented', INQ.restoreO],
  ] as const)('lost → %s, with lost_reason_code / lost_reason cleared', async (to, id) => {
    await makeInquiry(id, 'lost', { lost_reason_code: 'price', lost_reason: 'too expensive this year' })

    expect(await updateInquiryStatus(id, to)).toEqual({ success: true })

    expect(await inquiry(id)).toMatchObject({ status: to, lost_reason_code: null, lost_reason: null })
    const ev = await events(id)
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ type: 'status.changed', from_status: 'lost', to_status: to })
  })

  it.each([
    ['lost',            'awaiting_payment'],
    ['lost',            'paid'],
    ['cancelled',       'qualifying'],
    ['offer_presented', 'paid'],
  ] as const)('red proof: %s → %s is refused and nothing is written', async (from, to) => {
    const id = from === 'cancelled' ? INQ.cancelled : INQ.lostBad
    await db().from('inquiries').delete().eq('id', id)
    await makeInquiry(id, from, from === 'lost' ? { lost_reason_code: 'price' } : {})

    const res = await updateInquiryStatus(id, to)

    expect(res).toEqual({ success: false, error: expect.stringContaining(`${from} → ${to} is not an allowed transition`) })
    expect((await inquiry(id)).status).toBe(from)
    expect(await events(id)).toEqual([])
  })

  it('a lost inquiry\'s offer cannot be accepted until the inquiry is restored', async () => {
    await makeInquiry(INQ.lostLocked, 'lost', { lost_reason_code: 'client_silent' })
    const { offerId, opt1 } = await makeOffer(INQ.lostLocked, 'presented')

    expect(await markClientAccepted(offerId, opt1))
      .toEqual({ success: false, error: 'The offer cannot be changed — the inquiry is lost' })
    expect(await events(INQ.lostLocked)).toEqual([])
  })
})

describe('declined offer after restore (D5 a)', () => {
  it('Reopen offer: declined → draft with offer.reverted', async () => {
    await makeInquiry(INQ.declined, 'qualifying')
    const { offerId } = await makeOffer(INQ.declined, 'declined')

    expect(await reopenOffer(offerId)).toEqual({ success: true })

    expect((await offerRow(offerId)).status).toBe('draft')
    const ev = await events(INQ.declined)
    expect(ev[0]).toMatchObject({ type: 'offer.reverted', payload: { offer_id: offerId, from: 'declined', to: 'draft' } })
  })

  it('New offer: the declined one becomes superseded, the new one is a draft', async () => {
    const { offerId: oldId } = await makeOffer(INQ.declined, 'declined')

    const res = await markAsGuideOffer(INQ.declined, {
      messageId:         null,
      options:           [{ label: '4 days', priceCents: 380000, currency: 'eur' }],
      supersedesOfferId: oldId,
    })

    expect(res.success).toBe(true)
    const newId = (res as { offerId: string }).offerId
    expect((await offerRow(oldId)).status).toBe('superseded')
    expect((await offerRow(newId)).status).toBe('draft')
    const ev = await events(INQ.declined)
    expect(ev.at(-1)).toMatchObject({ type: 'offer.superseded', payload: { offer_id: oldId, superseded_by: newId } })
  })

  it('only a declined offer can be replaced', async () => {
    const { offerId } = await makeOffer(INQ.declined, 'presented')
    const res = await markAsGuideOffer(INQ.declined, {
      options:           [{ label: 'x', priceCents: 100, currency: 'eur' }],
      supersedesOfferId: offerId,
    })
    expect(res).toEqual({ success: false, error: 'Only a declined offer can be replaced — this one is presented' })
  })
})
