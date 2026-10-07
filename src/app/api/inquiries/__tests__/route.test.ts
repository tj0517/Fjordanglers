/**
 * FA-1.27 — /api/inquiries POST, flag-off and auto-send-throws checks.
 *
 * When AI_AUTO_REPLY_ENABLED is false, neither classifyInquiry nor autoSendReply
 * should be called — no AI model invocations on the new-inquiry path.
 *
 * When AI_AUTO_REPLY_ENABLED is true and autoSendReply throws, the route must
 * still return 201 (auto-send errors must never block inquiry creation).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const anthropicCreateMock = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: anthropicCreateMock }
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

// Mutable env so tests can flip AI_AUTO_REPLY_ENABLED
const mockEnv = vi.hoisted(() => ({
  ANTHROPIC_API_KEY:     'test-key',
  NEXT_PUBLIC_APP_URL:   'https://test.example.com',
  FA_EMAIL:              'test@fjordanglers.com',
  AI_AUTO_REPLY_ENABLED: false as boolean,
  RESEND_API_KEY:        'test-resend',
}))

vi.mock('@/lib/env', () => ({ env: mockEnv }))

const classifyInquiryMock = vi.fn()
vi.mock('@/lib/ai/inquiry-agent', () => ({
  classifyInquiry: classifyInquiryMock,
}))

const autoSendReplyMock = vi.fn()
vi.mock('@/lib/ai/auto-send', () => ({
  autoSendReply:     autoSendReplyMock,
  hasAgentAutoReply: vi.fn().mockResolvedValue(false),
}))

const sendFaEmailMock     = vi.fn()
const sendAnglerEmailMock = vi.fn()
vi.mock('@/lib/email', () => ({
  sendInquiryReceivedFaEmail:     sendFaEmailMock,
  sendInquiryReceivedAnglerEmail: sendAnglerEmailMock,
}))

// FA-1.42 — data-layer lookup for "same e-mail within 24 h"
const hasRecentInquiryMock = vi.fn()
const primaryGuideMock = vi.fn()
vi.mock('@/lib/supabase/queries', () => ({
  hasRecentInquiryFromEmail: hasRecentInquiryMock,
  getPrimaryGuideId:         primaryGuideMock,
}))

const createInquiryMock = vi.fn()
vi.mock('@/lib/inquiries/create', () => ({
  createInquiry: createInquiryMock,
}))

vi.mock('@/lib/business-days', () => ({
  addBusinessDays:   () => new Date(),
  formatBusinessDay: () => '2026-10-01',
}))

import { createServiceClient } from '@/lib/supabase/server'

/** Rows the route itself writes to inquiry_events (createInquiry is mocked, so only FA-1.42 skips land here). */
let emittedEvents: Record<string, unknown>[] = []

beforeEach(() => {
  vi.clearAllMocks()
  mockEnv.AI_AUTO_REPLY_ENABLED = false
  emittedEvents = []
  createInquiryMock.mockResolvedValue({ id: 'inq-flag-off', status: 'new' })
  sendFaEmailMock.mockResolvedValue(undefined)
  sendAnglerEmailMock.mockResolvedValue(undefined)
  hasRecentInquiryMock.mockResolvedValue(false)
  primaryGuideMock.mockResolvedValue('guide-primary')

  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'experience_pages') {
        const b = {
          select: () => b,
          eq:     () => b,
          single: async () => ({
            data: {
              id:              '11111111-1111-1111-1111-111111111111',
              guide_id:        'guide-1',
              experience_name: 'NZ Trout Fly Fishing',
              country:         'New Zealand',
            },
            error: null,
          }),
        }
        return b
      }
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        insert: (row: Record<string, unknown>) => {
          if (table === 'inquiry_events') emittedEvents.push(row)
          return { select: () => ({ single: async () => ({ data: { id: 'row-1' }, error: null }) }) }
        },
      }
    },
  } as unknown as ReturnType<typeof createServiceClient>)
})

const TEST_BODY = {
  experience_page_id: '550e8400-e29b-41d4-a716-446655440000',
  angler_name:        'Test Angler',
  angler_email:       'test@angler.com',
  requested_dates:    ['2026-08-01'],
  party_size:         2,
  message:            'I want to fish New Zealand rivers.',
}

describe('/api/inquiries POST — flag off, FA-1.27', () => {
  it('calls 0 AI model invocations when AI_AUTO_REPLY_ENABLED=false', async () => {
    const { POST } = await import('@/app/api/inquiries/route')

    const response = await POST(new NextRequest('http://localhost/api/inquiries', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(TEST_BODY),
    }))

    expect(response.status).toBe(201)

    expect(classifyInquiryMock).toHaveBeenCalledTimes(0)
    expect(autoSendReplyMock).toHaveBeenCalledTimes(0)
    expect(anthropicCreateMock).toHaveBeenCalledTimes(0)
  })
})

describe('/api/inquiries POST — autoSendReply throws, FA-1.27', () => {
  it('returns 201 even when autoSendReply throws', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true
    classifyInquiryMock.mockResolvedValueOnce({ qualified: 'yes', reason: 'valid inquiry' })
    autoSendReplyMock.mockRejectedValueOnce(new Error('auto-send pipeline crashed'))

    const { POST } = await import('@/app/api/inquiries/route')

    const response = await POST(new NextRequest('http://localhost/api/inquiries', {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(TEST_BODY),
    }))

    expect(response.status).toBe(201)
    expect(autoSendReplyMock).toHaveBeenCalledTimes(1)
  })
})

// ─── FA-1.42 — repeat submissions from the same e-mail ───────────────────────

const REPEAT_REASON = 'repeat submission from same e-mail within 24 h'

function post(body: Record<string, unknown> = TEST_BODY) {
  return import('@/app/api/inquiries/route').then(({ POST }) => POST(new NextRequest('http://localhost/api/inquiries', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(body),
  })))
}

describe('/api/inquiries POST — repeat from the same e-mail, FA-1.42', () => {
  it('saves the inquiry, skips AI, auto-reply and the customer e-mail, still mails FA, and leaves an event with the reason — RED on main: everything is called', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true
    hasRecentInquiryMock.mockResolvedValue(true)

    const response = await post()

    expect(response.status).toBe(201)
    expect(createInquiryMock).toHaveBeenCalledTimes(1)
    expect(classifyInquiryMock).not.toHaveBeenCalled()
    expect(autoSendReplyMock).not.toHaveBeenCalled()
    expect(sendAnglerEmailMock).not.toHaveBeenCalled()
    expect(sendFaEmailMock).toHaveBeenCalledTimes(1)

    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents[0]).toMatchObject({
      inquiry_id: 'inq-flag-off',
      type:       'agent.auto_send_decided',
      payload:    { sent: false, score: null, reasons: [REPEAT_REASON], draft_message_id: null },
    })
  })

  it('does not write the angler e-mail address into the event', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true
    hasRecentInquiryMock.mockResolvedValue(true)

    await post()

    expect(JSON.stringify(emittedEvents)).not.toMatch(/angler\.com/i)
  })

  it('treats a repeat the same way when the auto-reply flag is off (D2): no customer e-mail, event still saved', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = false
    hasRecentInquiryMock.mockResolvedValue(true)

    const response = await post()

    expect(response.status).toBe(201)
    expect(sendAnglerEmailMock).not.toHaveBeenCalled()
    expect(sendFaEmailMock).toHaveBeenCalledTimes(1)
    expect(emittedEvents).toHaveLength(1)
    expect((emittedEvents[0].payload as Record<string, unknown>).reasons).toEqual([REPEAT_REASON])
  })

  it('leaves behaviour unchanged for a first inquiry from an e-mail: classify, auto-send, customer e-mail, no skip event', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true
    hasRecentInquiryMock.mockResolvedValue(false)

    const response = await post()

    expect(response.status).toBe(201)
    expect(classifyInquiryMock).toHaveBeenCalledTimes(1)
    expect(autoSendReplyMock).toHaveBeenCalledTimes(1)
    expect(sendAnglerEmailMock).toHaveBeenCalledTimes(1)
    expect(sendFaEmailMock).toHaveBeenCalledTimes(1)
    expect(emittedEvents).toHaveLength(0)
  })

  it('asks the data layer about this e-mail, excluding the new inquiry, over the last 24 h', async () => {
    const before = Date.now()
    await post({ ...TEST_BODY, angler_email: 'Test@Angler.COM' })
    const after = Date.now()

    expect(hasRecentInquiryMock).toHaveBeenCalledTimes(1)
    const params = hasRecentInquiryMock.mock.calls[0][1] as { email: string; excludeInquiryId: string; since: Date }
    expect(params.email).toBe('Test@Angler.COM')
    expect(params.excludeInquiryId).toBe('inq-flag-off')
    const DAY = 24 * 60 * 60 * 1000
    expect(params.since.getTime()).toBeGreaterThanOrEqual(before - DAY)
    expect(params.since.getTime()).toBeLessThanOrEqual(after - DAY)
  })

  it('fails open when the lookup throws: the inquiry is treated as new and gets the usual flow', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true
    hasRecentInquiryMock.mockRejectedValue(new Error('connection reset'))

    const response = await post()

    expect(response.status).toBe(201)
    expect(sendAnglerEmailMock).toHaveBeenCalledTimes(1)
    expect(classifyInquiryMock).toHaveBeenCalledTimes(1)
    expect(autoSendReplyMock).toHaveBeenCalledTimes(1)
    expect(emittedEvents).toHaveLength(0)
  })
})

// ─── FA-1.43 — hidden trap field and minimum fill time ────────────────────────
//
// Client-supplied and forgeable: these stop simple bots only, they are not a security boundary.

const TRAP_REASON = 'trap field filled'
const FAST_REASON = 'form submitted less than 2 s after it was shown'

describe('/api/inquiries POST — trap field and fill time, FA-1.43', () => {
  it('trap filled: saves the inquiry, no AI, no auto-reply, no e-mail to anyone, event with the reason — RED on main: everything is called', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true

    const response = await post({ ...TEST_BODY, trip_notes_extra: 'http://spam.example', form_elapsed_ms: 15000 })

    expect(response.status).toBe(201)
    expect(createInquiryMock).toHaveBeenCalledTimes(1)
    expect(classifyInquiryMock).not.toHaveBeenCalled()
    expect(autoSendReplyMock).not.toHaveBeenCalled()
    expect(sendAnglerEmailMock).not.toHaveBeenCalled()
    expect(sendFaEmailMock).not.toHaveBeenCalled()

    expect(emittedEvents).toHaveLength(1)
    expect(emittedEvents[0]).toMatchObject({
      inquiry_id: 'inq-flag-off',
      type:       'agent.auto_send_decided',
      payload:    { sent: false, score: null, reasons: [TRAP_REASON], draft_message_id: null },
    })
  })

  it('submitted in under 2 s with an empty trap: same path — RED on main', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true

    const response = await post({ ...TEST_BODY, trip_notes_extra: '', form_elapsed_ms: 400 })

    expect(response.status).toBe(201)
    expect(createInquiryMock).toHaveBeenCalledTimes(1)
    expect(classifyInquiryMock).not.toHaveBeenCalled()
    expect(autoSendReplyMock).not.toHaveBeenCalled()
    expect(sendAnglerEmailMock).not.toHaveBeenCalled()
    expect(sendFaEmailMock).not.toHaveBeenCalled()
    expect(emittedEvents).toHaveLength(1)
    expect((emittedEvents[0].payload as Record<string, unknown>).reasons).toEqual([FAST_REASON])
  })

  it('the skip is recorded even when the auto-reply flag is off', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = false

    await post({ ...TEST_BODY, trip_notes_extra: 'x' })

    expect(sendAnglerEmailMock).not.toHaveBeenCalled()
    expect(sendFaEmailMock).not.toHaveBeenCalled()
    expect(emittedEvents).toHaveLength(1)
  })

  it('a fractional duration is usable (performance.now deltas are fractional): 400.5 ms is suspicious', async () => {
    await post({ ...TEST_BODY, form_elapsed_ms: 400.5 })

    expect(sendAnglerEmailMock).not.toHaveBeenCalled()
    expect(emittedEvents).toHaveLength(1)
  })

  it('zero ms is a valid duration and suspicious', async () => {
    await post({ ...TEST_BODY, form_elapsed_ms: 0 })

    expect(sendFaEmailMock).not.toHaveBeenCalled()
    expect(emittedEvents).toHaveLength(1)
  })

  it('the 2 s boundary: 1999 ms is suspicious, 2000 ms is a normal request', async () => {
    await post({ ...TEST_BODY, form_elapsed_ms: 1999 })
    expect(sendAnglerEmailMock).not.toHaveBeenCalled()
    expect(emittedEvents).toHaveLength(1)

    vi.clearAllMocks()
    emittedEvents = []
    createInquiryMock.mockResolvedValue({ id: 'inq-flag-off', status: 'new' })
    hasRecentInquiryMock.mockResolvedValue(false)

    await post({ ...TEST_BODY, form_elapsed_ms: 2000 })
    expect(sendAnglerEmailMock).toHaveBeenCalledTimes(1)
    expect(sendFaEmailMock).toHaveBeenCalledTimes(1)
    expect(emittedEvents).toHaveLength(0)
  })

  it('empty trap and 2 s or more: behaves as today — classify, auto-send, both e-mails, no event', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true

    const response = await post({ ...TEST_BODY, trip_notes_extra: '', form_elapsed_ms: 12000 })

    expect(response.status).toBe(201)
    expect(classifyInquiryMock).toHaveBeenCalledTimes(1)
    expect(autoSendReplyMock).toHaveBeenCalledTimes(1)
    expect(sendAnglerEmailMock).toHaveBeenCalledTimes(1)
    expect(sendFaEmailMock).toHaveBeenCalledTimes(1)
    expect(emittedEvents).toHaveLength(0)
  })

  it('neither field sent: a missing field alone is not suspicious', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true

    const response = await post()

    expect(response.status).toBe(201)
    expect(sendAnglerEmailMock).toHaveBeenCalledTimes(1)
    expect(classifyInquiryMock).toHaveBeenCalledTimes(1)
    expect(emittedEvents).toHaveLength(0)
  })

  it.each([
    ['negative',        -5],
    ['text',            'fast'],
    ['numeric string',  '300'],
    ['null',            null],
    ['NaN-like object', {}],
    ['array',           [1]],
    ['boolean',         true],
    ['absurdly large',  1e15],
  ])('unusable form_elapsed_ms (%s) means "no information": normal request, never a 400', async (_label, value) => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true

    const response = await post({ ...TEST_BODY, form_elapsed_ms: value })

    expect(response.status).toBe(201)
    expect(sendAnglerEmailMock).toHaveBeenCalledTimes(1)
    expect(classifyInquiryMock).toHaveBeenCalledTimes(1)
    expect(emittedEvents).toHaveLength(0)
  })

  it.each([
    ['number', 1],
    ['null',   null],
    ['object', { a: 1 }],
    ['blank',  '   '],
  ])('a trap value that is not a non-blank string (%s) is not "filled"', async (_label, value) => {
    const response = await post({ ...TEST_BODY, trip_notes_extra: value, form_elapsed_ms: 9000 })

    expect(response.status).toBe(201)
    expect(sendAnglerEmailMock).toHaveBeenCalledTimes(1)
    expect(emittedEvents).toHaveLength(0)
  })

  it('suspicious wins over repeat: no repeat lookup, one event, reason is the trap', async () => {
    hasRecentInquiryMock.mockResolvedValue(true)

    await post({ ...TEST_BODY, trip_notes_extra: 'x' })

    expect(hasRecentInquiryMock).not.toHaveBeenCalled()
    expect(emittedEvents).toHaveLength(1)
    expect((emittedEvents[0].payload as Record<string, unknown>).reasons).toEqual([TRAP_REASON])
  })

  it('both signals at once: one event, trap reason only', async () => {
    await post({ ...TEST_BODY, trip_notes_extra: 'x', form_elapsed_ms: 100 })

    expect(emittedEvents).toHaveLength(1)
    expect((emittedEvents[0].payload as Record<string, unknown>).reasons).toEqual([TRAP_REASON])
  })

  it('the response is identical to a normal one — status, body keys and headers', async () => {
    const normal     = await post({ ...TEST_BODY, form_elapsed_ms: 9000 })
    const normalBody = await normal.json() as Record<string, unknown>

    const trapped     = await post({ ...TEST_BODY, trip_notes_extra: 'x', form_elapsed_ms: 100 })
    const trappedBody = await trapped.json() as Record<string, unknown>

    expect(trapped.status).toBe(normal.status)
    expect(Object.keys(trappedBody).sort()).toEqual(Object.keys(normalBody).sort())
    expect(trappedBody).toEqual(normalBody)
    expect([...trapped.headers.entries()]).toEqual([...normal.headers.entries()])
  })

  it('writes no angler e-mail address into the event and does not log the detection', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    await post({ ...TEST_BODY, trip_notes_extra: 'x' })

    expect(JSON.stringify(emittedEvents)).not.toMatch(/angler\.com/i)
    const logged = JSON.stringify([...log.mock.calls, ...err.mock.calls])
    expect(logged).not.toMatch(/trap|suspicious|honeypot|fast/i)
    log.mockRestore()
    err.mockRestore()
  })

  it('a failed event write does not turn into a 500 and the skip still applies', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(createServiceClient).mockReturnValue({
      from: (table: string) => {
        if (table === 'experience_pages') {
          const b = {
            select: () => b,
            eq:     () => b,
            single: async () => ({ data: { id: 'p', guide_id: 'g', experience_name: 'NZ', country: 'NZ' }, error: null }),
          }
          return b
        }
        return { insert: () => { throw new Error('events table down') } }
      },
    } as unknown as ReturnType<typeof createServiceClient>)

    const response = await post({ ...TEST_BODY, trip_notes_extra: 'x' })

    expect(response.status).toBe(201)
    expect(sendAnglerEmailMock).not.toHaveBeenCalled()
    expect(sendFaEmailMock).not.toHaveBeenCalled()
  })
})

/**
 * FA-1.55 — the trap field and the minimum fill time on the v2 path.
 *
 * The three-step form sends the same two signals the v1 widget does, and the server reads
 * them the same way: a `brief` buys no exemption. RED with the guard bypassed: make
 * `suspicionReason` return null and both of the first two cases below classify, auto-send and
 * e-mail a bot's submission.
 */
describe('/api/inquiries POST — trap and fill time on the v2 form, FA-1.55', () => {
  const BRIEF = {
    dates_mode:  'exact',
    date_from:   '2027-03-10',
    date_to:     '2027-03-11',
    days:        2,
    anglers:     2,
    non_anglers: 0,
    skill_level: 3,
    priority:    'learning',
    fitness:     'mid',
    wading_ok:   true,
    budget_ack:  true,
  }

  const V2_BODY = { ...TEST_BODY, brief: BRIEF }

  it('trap filled on a v2 request: saved, but no AI, no auto-reply and no e-mail to anyone', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true

    const response = await post({ ...V2_BODY, trip_notes_extra: 'http://spam.example', form_elapsed_ms: 60000 })

    expect(response.status).toBe(201)
    expect(createInquiryMock).toHaveBeenCalledTimes(1)
    expect(createInquiryMock.mock.calls[0][0].brief).toEqual(BRIEF)
    expect(classifyInquiryMock).not.toHaveBeenCalled()
    expect(autoSendReplyMock).not.toHaveBeenCalled()
    expect(sendAnglerEmailMock).not.toHaveBeenCalled()
    expect(sendFaEmailMock).not.toHaveBeenCalled()
    expect((emittedEvents[0].payload as Record<string, unknown>).reasons).toEqual([TRAP_REASON])
  })

  it('a v2 request submitted in under 2 s: same path, same reason', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true

    const response = await post({ ...V2_BODY, trip_notes_extra: '', form_elapsed_ms: 900 })

    expect(response.status).toBe(201)
    expect(classifyInquiryMock).not.toHaveBeenCalled()
    expect(sendFaEmailMock).not.toHaveBeenCalled()
    expect((emittedEvents[0].payload as Record<string, unknown>).reasons).toEqual([FAST_REASON])
  })

  it('a v2 request with an empty trap after 2 s behaves as a normal one', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true

    const response = await post({ ...V2_BODY, trip_notes_extra: '', form_elapsed_ms: 45000 })

    expect(response.status).toBe(201)
    expect(classifyInquiryMock).toHaveBeenCalledTimes(1)
    expect(autoSendReplyMock).toHaveBeenCalledTimes(1)
    expect(sendFaEmailMock).toHaveBeenCalledTimes(1)
    expect(sendAnglerEmailMock).toHaveBeenCalledTimes(1)
    expect(emittedEvents).toHaveLength(0)
  })

  it('a repeat v2 submission from the same e-mail still skips the customer e-mail and the AI', async () => {
    mockEnv.AI_AUTO_REPLY_ENABLED = true
    hasRecentInquiryMock.mockResolvedValue(true)

    const response = await post({ ...V2_BODY, form_elapsed_ms: 45000 })

    expect(response.status).toBe(201)
    expect(sendFaEmailMock).toHaveBeenCalledTimes(1)
    expect(sendAnglerEmailMock).not.toHaveBeenCalled()
    expect(classifyInquiryMock).not.toHaveBeenCalled()
    expect((emittedEvents[0].payload as Record<string, unknown>).reasons).toEqual([REPEAT_REASON])
  })
})
