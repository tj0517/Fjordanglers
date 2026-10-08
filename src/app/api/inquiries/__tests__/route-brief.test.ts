/**
 * FA-1.55 — POST /api/inquiries with and without `brief`.
 *
 * Two things have to be true at once:
 *
 *   • a v2 request stores the brief exactly as sent, fills the old columns from it, points
 *     `guide_id` at the page's active primary guide and stamps the event with page_version;
 *   • a v1 request — the old widget, which knows nothing about any of this — reaches
 *     `createInquiry` with the same arguments it did before `brief` existed.
 *
 * The red cases are the point of the schema: a level the form cannot offer, a brief with no
 * `dates_mode`, and an unknown key must all be 400 **with no inquiry created**.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))

const mockEnv = vi.hoisted(() => ({
  ANTHROPIC_API_KEY:     'test-key',
  NEXT_PUBLIC_APP_URL:   'https://test.example.com',
  FA_EMAIL:              'test@fjordanglers.com',
  AI_AUTO_REPLY_ENABLED: false as boolean,
  RESEND_API_KEY:        'test-resend',
}))
vi.mock('@/lib/env', () => ({ env: mockEnv }))

vi.mock('@/lib/ai/inquiry-agent', () => ({ classifyInquiry: vi.fn() }))
vi.mock('@/lib/ai/auto-send', () => ({ autoSendReply: vi.fn(), hasAgentAutoReply: vi.fn().mockResolvedValue(false) }))

const sendFaEmailMock     = vi.fn()
const sendAnglerEmailMock = vi.fn()
vi.mock('@/lib/email', () => ({
  sendInquiryReceivedFaEmail:     sendFaEmailMock,
  sendInquiryReceivedAnglerEmail: sendAnglerEmailMock,
}))

const hasRecentInquiryMock = vi.fn()
const primaryGuideMock     = vi.fn()
vi.mock('@/lib/supabase/queries', () => ({
  hasRecentInquiryFromEmail: hasRecentInquiryMock,
  getPrimaryGuideId:         primaryGuideMock,
}))

const createInquiryMock = vi.fn()
vi.mock('@/lib/inquiries/create', () => ({ createInquiry: createInquiryMock }))

vi.mock('@/lib/business-days', () => ({
  addBusinessDays:   () => new Date(),
  formatBusinessDay: () => '2026-10-09',
}))

import { createServiceClient } from '@/lib/supabase/server'

const PAGE_ID = '550e8400-e29b-41d4-a716-446655440000'

/** The page the request names: a v2 page whose legacy `guide_id` is NOT the primary guide. */
const PAGE_ROW = {
  id:              PAGE_ID,
  guide_id:        'guide-legacy',
  experience_name: 'Seed Backcountry Day',
  country:         'New Zealand',
  page_version:    2,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.AI_AUTO_REPLY_ENABLED = false
  createInquiryMock.mockResolvedValue({ id: 'inq-brief', status: 'new' })
  sendFaEmailMock.mockResolvedValue(undefined)
  sendAnglerEmailMock.mockResolvedValue(undefined)
  hasRecentInquiryMock.mockResolvedValue(false)
  primaryGuideMock.mockResolvedValue('guide-primary')

  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'experience_pages') {
        const b = { select: () => b, eq: () => b, single: async () => ({ data: PAGE_ROW, error: null }) }
        return b
      }
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'row-1' }, error: null }) }) }),
      }
    },
  } as unknown as ReturnType<typeof createServiceClient>)
})

const BRIEF = {
  dates_mode:  'exact',
  date_from:   '2027-03-10',
  date_to:     '2027-03-12',
  days:        3,
  anglers:     2,
  non_anglers: 1,
  skill_level: 3,
  priority:    'trophy',
  fitness:     'mid',
  wading_ok:   true,
  budget_ack:  true,
}

/** What the wizard sends. `party_size` is present because the schema requires it. */
function v2Body(brief: unknown = BRIEF, over: Record<string, unknown> = {}) {
  return {
    experience_page_id: PAGE_ID,
    angler_name:   'Anna Angler',
    angler_email:  'anna@angler.test',
    angler_country: 'pl',
    party_size:    2,
    message:       'We are a father and son.',
    brief,
    form_elapsed_ms: 45_000,
    ...over,
  }
}

/** What the v1 widget sends — no brief, no country. */
const V1_BODY = {
  experience_page_id: PAGE_ID,
  angler_name:     'Old Form',
  angler_email:    'old@angler.test',
  requested_dates: ['2026-08-02', '2026-08-01'],
  party_size:      4,
  trip_length:     '2-3',
  message:         'Written by hand.',
  form_elapsed_ms: 30_000,
}

async function post(body: unknown) {
  const { POST } = await import('@/app/api/inquiries/route')
  return POST(new NextRequest('http://localhost/api/inquiries', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(body),
  }))
}

describe('POST with a brief — the v2 form', () => {
  it('stores the brief exactly as sent', async () => {
    const response = await post(v2Body())
    expect(response.status).toBe(201)

    const args = createInquiryMock.mock.calls[0][0]
    expect(args.brief).toEqual(BRIEF)
  })

  it('fills the old columns from the brief, not from what the client sent beside it', async () => {
    // party_size 9 and trip_length '7+' in the body are deliberately wrong: the brief wins.
    await post(v2Body(BRIEF, { party_size: 9, trip_length: '7+', requested_dates: ['2030-01-01'] }))

    const args = createInquiryMock.mock.calls[0][0]
    expect(args.requestedDates).toEqual(['2027-03-10', '2027-03-11', '2027-03-12'])
    expect(args.partySize).toBe(2)
    expect(args.tripLength).toBe('2-3')
    expect(args.message).toContain('We are a father and son.')
    expect(args.message).toContain('Answers from the inquiry form')
    expect(args.message).toContain('Skill level: 3/5')
    expect(args.anglerCountry).toBe('PL')
    expect(args.experiencePageId).toBe(PAGE_ID)
  })

  it('points guide_id at the page\'s active primary guide, not the legacy column', async () => {
    await post(v2Body())
    expect(primaryGuideMock).toHaveBeenCalledWith(expect.anything(), PAGE_ID)
    expect(createInquiryMock.mock.calls[0][0].guideId).toBe('guide-primary')
  })

  it('keeps the page\'s guide when it has no primary row, instead of losing the guide', async () => {
    primaryGuideMock.mockResolvedValue(null)
    await post(v2Body())
    expect(createInquiryMock.mock.calls[0][0].guideId).toBe('guide-legacy')
  })

  it('keeps the page\'s guide when the primary lookup fails', async () => {
    primaryGuideMock.mockRejectedValue(new Error('connection lost'))
    const response = await post(v2Body())
    expect(response.status).toBe(201)
    expect(createInquiryMock.mock.calls[0][0].guideId).toBe('guide-legacy')
  })

  it('passes the page_version on, for the event', async () => {
    await post(v2Body())
    expect(createInquiryMock.mock.calls[0][0].pageVersion).toBe(2)
  })

  it('sends FA the message that carries the summary and the dates from the brief', async () => {
    await post(v2Body())
    const faArgs = sendFaEmailMock.mock.calls[0][0]
    expect(faArgs.requestedDates).toEqual(['2027-03-10', '2027-03-11', '2027-03-12'])
    expect(faArgs.partySize).toBe(2)
    expect(faArgs.message).toContain('Priority:')
  })

  it('stores nothing for requested_dates when the dates are flexible', async () => {
    await post(v2Body({
      dates_mode: 'flexible', flex_month: '2027-06', days: 2, anglers: 1, non_anglers: 0,
      skill_level: 4, priority: 'numbers', fitness: 'low', wading_ok: false,
      budget_band: 'EUR:140000-230000',
    }))
    const args = createInquiryMock.mock.calls[0][0]
    expect(args.requestedDates).toEqual([])
    expect(args.message).toContain('June 2027')
  })
})

describe('POST without a brief — the v1 widget, unchanged', () => {
  it('reaches createInquiry with the same arguments as before brief existed', async () => {
    const response = await post(V1_BODY)
    expect(response.status).toBe(201)

    const args = createInquiryMock.mock.calls[0][0]
    expect(args.brief).toBeNull()
    expect(args.pageVersion).toBe(2)   // read from the page, only recorded with a brief
    // Sorted, exactly as the route has always done; nothing derived, nothing appended.
    expect(args.requestedDates).toEqual(['2026-08-01', '2026-08-02'])
    expect(args.partySize).toBe(4)
    expect(args.tripLength).toBe('2-3')
    expect(args.message).toBe('Written by hand.')
    expect(args.anglerCountry).toBeNull()
    // The legacy column, as before: no primary-guide lookup happens at all.
    expect(args.guideId).toBe('guide-legacy')
    expect(primaryGuideMock).not.toHaveBeenCalled()
  })
})

describe('red cases — 400 and no inquiry created', () => {
  it('skill_level 7 → 400, createInquiry never called', async () => {
    const response = await post(v2Body({ ...BRIEF, skill_level: 7 }))
    expect(response.status).toBe(400)
    expect(createInquiryMock).not.toHaveBeenCalled()
  })

  it('no dates_mode → 400, createInquiry never called', async () => {
    const { dates_mode: _unused, ...noMode } = BRIEF
    const response = await post(v2Body(noMode))
    expect(response.status).toBe(400)
    expect(createInquiryMock).not.toHaveBeenCalled()
  })

  it('an unknown key inside the brief → 400, createInquiry never called', async () => {
    const response = await post(v2Body({ ...BRIEF, discount_code: 'FREE' }))
    expect(response.status).toBe(400)
    expect(createInquiryMock).not.toHaveBeenCalled()
  })

  it('a brief that is not an object → 400', async () => {
    expect((await post(v2Body('skill 3, March'))).status).toBe(400)
    expect(createInquiryMock).not.toHaveBeenCalled()
  })

  it('names the offending field in the 400 body, and nothing else', async () => {
    const response = await post(v2Body({ ...BRIEF, skill_level: 7 }))
    const body = await response.json() as { error: string; details: Record<string, unknown> }
    expect(body.error).toBe('Invalid input')
    expect(Object.keys(body.details)).toContain('brief')
  })
})
