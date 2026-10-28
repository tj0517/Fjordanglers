/**
 * FA-1.77 — Stripe product name and description of the deposit link, against the real
 * local stack.
 *
 *   • createPaymentLink creates the product from the admin's values (trimmed) and records
 *     product_id, name and description in payment.link_sent
 *   • empty / over-limit values are refused before Stripe and before any write
 *   • updatePaymentLinkDetails on an active link: products.update, no new link, URL in the
 *     DB unchanged, payment.link_details_updated with before and after (tj D3 a);
 *     links created before FA-1.77 find their product through paymentLinks.listLineItems
 *
 * Env and safety fuse: src/tests/setup.ts (local URL only). Every inquiry is created here
 * under the fixed ids below and deleted in afterAll; the seed's rows are never touched.
 *
 * Mocked: next/cache and the session client (only exist inside a Next request), Stripe
 * (calls asserted, never sent anywhere), the AI draft and its knowledge.
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
  stripe: {
    products:     { create: vi.fn(), update: vi.fn() },
    prices:       { create: vi.fn() },
    paymentLinks: { create: vi.fn(), update: vi.fn(), listLineItems: vi.fn() },
  },
}))
vi.mock('@/lib/ai/draft-deposit-link', () => ({
  draftDepositLinkMessage: vi.fn().mockResolvedValue('Here is your deposit link.'),
}))
vi.mock('@/lib/ai/knowledge', () => ({
  loadKnowledge: vi.fn().mockResolvedValue({
    instructions: { id: 'k1', kind: 'instructions', country: null, guide_id: null, title: 'Instructions', body: 'Be helpful.' },
    entries:      [],
    usedIds:      [],
  }),
}))
vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_APP_URL: 'https://test.example.com' } }))

import { stripe } from '@/lib/stripe/client'
import { createPaymentLink, updatePaymentLinkDetails } from '@/actions/messages'
import { PRODUCT_NAME_MAX, PRODUCT_DESCRIPTION_MAX } from '@/lib/stripe/product-details'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const INQ = {
  create:     '17700000-0000-4000-8000-000000000001',
  invalid:    '17700000-0000-4000-8000-000000000002',
  update:     '17700000-0000-4000-8000-000000000003',
  legacy:     '17700000-0000-4000-8000-000000000004',
  same:       '17700000-0000-4000-8000-000000000005',
  badUpdate:  '17700000-0000-4000-8000-000000000006',
  stripeFail: '17700000-0000-4000-8000-000000000007',
  paid:       '17700000-0000-4000-8000-000000000008',
  noLink:     '17700000-0000-4000-8000-000000000009',
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

/** A deposit as setDepositAmount leaves it — all four columns (deposit_cents_all_or_nothing). */
const DEPOSIT = {
  deposit_amount_cents: 60000,
  deposit_currency:     'EUR',
  deposit_eur_rate:     1,
  deposit_eur_rate_at:  '2026-10-27T10:00:00+00:00',
} as const

async function makeInquiry(
  id: string,
  status: InquiryStatus,
  extra: Partial<Database['public']['Tables']['inquiries']['Insert']> = {},
): Promise<void> {
  const { error } = await db().from('inquiries').insert({
    id, status, angler_name: 'FA-1.77 test', angler_email: 'fa177@test.invalid', party_size: 2, ...DEPOSIT, ...extra,
  })
  if (error != null) throw new Error(`insert inquiry ${id}: ${error.message}`)
}

/** An active link as createPaymentLink leaves it: link columns + payment.link_sent. */
async function makeActiveLink(id: string, linkId: string, payloadExtra: Record<string, unknown>): Promise<void> {
  await makeInquiry(id, 'awaiting_payment', {
    deposit_payment_link_id:  linkId,
    deposit_payment_link_url: `https://buy.stripe.com/test_${linkId}`,
  })
  const { error } = await db().from('inquiry_events').insert({
    inquiry_id: id, type: 'payment.link_sent', actor_kind: 'admin', actor_id: adminId, source: 'app', channel: 'app',
    payload: { amount_cents: 60000, currency: 'EUR', link_id: linkId, ...payloadExtra },
  })
  if (error != null) throw new Error(`insert link event ${id}: ${error.message}`)
}

async function inquiry(id: string) {
  const { data } = await db()
    .from('inquiries')
    .select('status, deposit_payment_link_id, deposit_payment_link_url, deposit_amount_cents, deposit_currency, updated_at')
    .eq('id', id)
    .single()
  return data!
}

async function events(inquiryId: string) {
  const { data } = await db()
    .from('inquiry_events')
    .select('type, actor_kind, payload')
    .eq('inquiry_id', inquiryId)
    .order('occurred_at', { ascending: true })
    .order('id', { ascending: true })
  return data ?? []
}

function stripeCalls(): number {
  return [
    stripe.products.create, stripe.products.update, stripe.prices.create,
    stripe.paymentLinks.create, stripe.paymentLinks.update, stripe.paymentLinks.listLineItems,
  ].reduce((n, fn) => n + vi.mocked(fn).mock.calls.length, 0)
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

beforeEach(() => {
  for (const fn of [
    stripe.products.create, stripe.products.update, stripe.prices.create,
    stripe.paymentLinks.create, stripe.paymentLinks.update, stripe.paymentLinks.listLineItems,
  ]) vi.mocked(fn).mockReset()
})

const BAD: Array<[string, { name: string; description: string }, string]> = [
  ['empty name',                  { name: '',                               description: 'Booking fee.' },                               'Product name is required'],
  ['whitespace-only name',        { name: '   ',                            description: 'Booking fee.' },                               'Product name is required'],
  ['name over the Stripe limit',  { name: 'n'.repeat(PRODUCT_NAME_MAX + 1), description: 'Booking fee.' },                               'Stripe allows 250'],
  ['empty description',           { name: 'Salmon week',                    description: '' },                                           'Description is required'],
  ['description over the limit',  { name: 'Salmon week',                    description: 'd'.repeat(PRODUCT_DESCRIPTION_MAX + 1) },      'the limit is 250'],
]

// ─── createPaymentLink ────────────────────────────────────────────────────────

describe('createPaymentLink with the admin\'s name and description', () => {
  it('product created from the edited values (trimmed); payment.link_sent records product_id, name, description', async () => {
    await makeInquiry(INQ.create, 'offer_presented')
    vi.mocked(stripe.products.create).mockResolvedValue({ id: 'prod_fa177' } as never)
    vi.mocked(stripe.prices.create).mockResolvedValue({ id: 'price_fa177' } as never)
    vi.mocked(stripe.paymentLinks.create).mockResolvedValue({ id: 'plink_fa177', url: 'https://buy.stripe.com/test_fa177' } as never)

    const res = await createPaymentLink(INQ.create, {
      name:        '  Laxá salmon week — June · 2 anglers  ',
      description: ' Booking fee. The balance goes to Einar on arrival. ',
    })

    expect(res).toMatchObject({ success: true, url: 'https://buy.stripe.com/test_fa177' })
    expect(vi.mocked(stripe.products.create)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(stripe.products.create)).toHaveBeenCalledWith({
      name:        'Laxá salmon week — June · 2 anglers',
      description: 'Booking fee. The balance goes to Einar on arrival.',
      metadata:    { inquiry_id: INQ.create },
    })
    expect(vi.mocked(stripe.prices.create)).toHaveBeenCalledWith({ currency: 'eur', unit_amount: 60000, product: 'prod_fa177' })

    expect(await inquiry(INQ.create)).toMatchObject({
      status: 'awaiting_payment', deposit_payment_link_id: 'plink_fa177', deposit_payment_link_url: 'https://buy.stripe.com/test_fa177',
    })
    const sent = (await events(INQ.create)).filter(e => e.type === 'payment.link_sent')
    expect(sent).toHaveLength(1)
    expect(sent[0].payload).toEqual({
      amount_cents: 60000,
      currency:     'EUR',
      link_id:      'plink_fa177',
      product_id:   'prod_fa177',
      name:         'Laxá salmon week — June · 2 anglers',
      description:  'Booking fee. The balance goes to Einar on arrival.',
    })
  })

  it.each(BAD)('%s: refused before Stripe, nothing written', async (_case, product, message) => {
    await db().from('inquiries').delete().eq('id', INQ.invalid)
    await makeInquiry(INQ.invalid, 'offer_presented')
    const before = await inquiry(INQ.invalid)

    const res = await createPaymentLink(INQ.invalid, product)

    expect(res).toEqual({ success: false, error: expect.stringContaining(message) })
    expect(stripeCalls()).toBe(0)
    expect(await inquiry(INQ.invalid)).toEqual(before)
    expect(await events(INQ.invalid)).toEqual([])
  })
})

// ─── updatePaymentLinkDetails ─────────────────────────────────────────────────

describe('updatePaymentLinkDetails on an active link (tj D3 a)', () => {
  it('products.update on the recorded product; no new link; URL unchanged; event with before and after', async () => {
    await makeActiveLink(INQ.update, 'plink_upd', { product_id: 'prod_upd', name: 'Old name · 2 people', description: 'Old fee text.' })
    vi.mocked(stripe.products.update).mockResolvedValue({ id: 'prod_upd' } as never)
    const before = await inquiry(INQ.update)

    const res = await updatePaymentLinkDetails(INQ.update, { name: ' New name · 3 people ', description: 'New fee text.' })

    expect(res).toEqual({ success: true })
    expect(vi.mocked(stripe.products.update)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(stripe.products.update)).toHaveBeenCalledWith('prod_upd', { name: 'New name · 3 people', description: 'New fee text.' })
    expect(vi.mocked(stripe.paymentLinks.create)).not.toHaveBeenCalled()
    expect(vi.mocked(stripe.paymentLinks.update)).not.toHaveBeenCalled()
    expect(vi.mocked(stripe.products.create)).not.toHaveBeenCalled()
    expect(vi.mocked(stripe.paymentLinks.listLineItems)).not.toHaveBeenCalled()

    // No inquiry column changes — same link, same URL, same status
    expect(await inquiry(INQ.update)).toEqual(before)
    const ev = await events(INQ.update)
    expect(ev.map(e => e.type)).toEqual(['payment.link_sent', 'payment.link_details_updated'])
    expect(ev[1].actor_kind).toBe('admin')
    expect(ev[1].payload).toEqual({
      link_id:    'plink_upd',
      product_id: 'prod_upd',
      before:     { name: 'Old name · 2 people', description: 'Old fee text.' },
      after:      { name: 'New name · 3 people', description: 'New fee text.' },
    })
  })

  it('a second edit takes "before" from the first edit', async () => {
    vi.mocked(stripe.products.update).mockResolvedValue({ id: 'prod_upd' } as never)
    const res = await updatePaymentLinkDetails(INQ.update, { name: 'Third name', description: 'New fee text.' })

    expect(res).toEqual({ success: true })
    const last = (await events(INQ.update)).at(-1)!
    expect(last.payload).toMatchObject({
      before: { name: 'New name · 3 people', description: 'New fee text.' },
      after:  { name: 'Third name',          description: 'New fee text.' },
    })
  })

  it('link created before FA-1.77: product found through paymentLinks.listLineItems, before read from Stripe', async () => {
    await makeActiveLink(INQ.legacy, 'plink_legacy', {})
    vi.mocked(stripe.paymentLinks.listLineItems).mockResolvedValue({
      data: [{ price: { product: { id: 'prod_legacy', name: 'Legacy trip · 1 person', description: 'Legacy fee.' } } }],
    } as never)
    vi.mocked(stripe.products.update).mockResolvedValue({ id: 'prod_legacy' } as never)
    const before = await inquiry(INQ.legacy)

    const res = await updatePaymentLinkDetails(INQ.legacy, { name: 'Legacy trip · 2 people', description: 'Legacy fee.' })

    expect(res).toEqual({ success: true })
    expect(vi.mocked(stripe.paymentLinks.listLineItems)).toHaveBeenCalledWith('plink_legacy', { limit: 1, expand: ['data.price.product'] })
    expect(vi.mocked(stripe.products.update)).toHaveBeenCalledWith('prod_legacy', { name: 'Legacy trip · 2 people', description: 'Legacy fee.' })
    expect(vi.mocked(stripe.paymentLinks.create)).not.toHaveBeenCalled()
    expect(await inquiry(INQ.legacy)).toEqual(before)
    expect((await events(INQ.legacy)).at(-1)!.payload).toEqual({
      link_id:    'plink_legacy',
      product_id: 'prod_legacy',
      before:     { name: 'Legacy trip · 1 person', description: 'Legacy fee.' },
      after:      { name: 'Legacy trip · 2 people', description: 'Legacy fee.' },
    })
  })

  it('same values as now: no Stripe call, no event', async () => {
    await makeActiveLink(INQ.same, 'plink_same', { product_id: 'prod_same', name: 'Trip', description: 'Fee.' })

    const res = await updatePaymentLinkDetails(INQ.same, { name: ' Trip ', description: 'Fee.' })

    expect(res).toEqual({ success: true })
    expect(stripeCalls()).toBe(0)
    expect((await events(INQ.same)).map(e => e.type)).toEqual(['payment.link_sent'])
  })

  it.each(BAD)('%s: refused before Stripe, no event', async (_case, product, message) => {
    await db().from('inquiries').delete().eq('id', INQ.badUpdate)
    await makeActiveLink(INQ.badUpdate, 'plink_bad', { product_id: 'prod_bad', name: 'Trip', description: 'Fee.' })

    const res = await updatePaymentLinkDetails(INQ.badUpdate, product)

    expect(res).toEqual({ success: false, error: expect.stringContaining(message) })
    expect(stripeCalls()).toBe(0)
    expect((await events(INQ.badUpdate)).map(e => e.type)).toEqual(['payment.link_sent'])
  })

  it('Stripe refuses: error returned, no event', async () => {
    await makeActiveLink(INQ.stripeFail, 'plink_fail', { product_id: 'prod_fail', name: 'Trip', description: 'Fee.' })
    vi.mocked(stripe.products.update).mockRejectedValue(new Error('No such product: prod_fail'))

    const res = await updatePaymentLinkDetails(INQ.stripeFail, { name: 'Trip 2', description: 'Fee.' })

    expect(res).toEqual({ success: false, error: 'No such product: prod_fail' })
    expect((await events(INQ.stripeFail)).map(e => e.type)).toEqual(['payment.link_sent'])
  })

  it('refused without an active link, and after the deposit is paid', async () => {
    await makeInquiry(INQ.noLink, 'offer_presented')
    await makeActiveLink(INQ.paid, 'plink_paid', { product_id: 'prod_paid', name: 'Trip', description: 'Fee.' })
    await db().from('inquiries').update({ deposit_paid_at: '2026-10-27T12:00:00+00:00' }).eq('id', INQ.paid)

    expect(await updatePaymentLinkDetails(INQ.noLink, { name: 'Trip', description: 'Fee.' }))
      .toEqual({ success: false, error: 'No active payment link — create one first' })
    expect(await updatePaymentLinkDetails(INQ.paid, { name: 'Trip 2', description: 'Fee.' }))
      .toEqual({ success: false, error: 'The deposit is already paid' })
    expect(stripeCalls()).toBe(0)
    expect(await events(INQ.noLink)).toEqual([])
  })
})
