/**
 * FA-1.61 — the AI work (classifyInquiry, then autoSendReply) runs in `after()`, so the
 * 201 does not wait for it. The two e-mails stay awaited before the response.
 *
 * `after()` is replaced by a queue (./after-queue): the callback does not run until the test
 * calls flushAfter(). That is what makes the ordering visible — a route that awaited the AI
 * work inline would have it finished before POST returns and the queue empty.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { afterMock, afterQueue, flushAfter, resetAfterQueue } from './after-queue'

vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: (await import('./after-queue')).afterMock,
}))

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn() }))

const mockEnv = vi.hoisted(() => ({
  NEXT_PUBLIC_APP_URL:   'https://test.example.com',
  FA_EMAIL:              'test@fjordanglers.com',
  AI_AUTO_REPLY_ENABLED: true as boolean,
}))
vi.mock('@/lib/env', () => ({ env: mockEnv }))

const classifyInquiryMock = vi.fn()
vi.mock('@/lib/ai/inquiry-agent', () => ({ classifyInquiry: classifyInquiryMock }))

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
  formatBusinessDay: () => '2026-10-01',
}))

import { createServiceClient } from '@/lib/supabase/server'

const BODY = {
  experience_page_id: '550e8400-e29b-41d4-a716-446655440000',
  angler_name:        'Test Angler',
  angler_email:       'test@angler.com',
  requested_dates:    ['2026-08-01'],
  party_size:         2,
  message:            'I want to fish New Zealand rivers.',
}

function post(body: Record<string, unknown> = BODY) {
  return import('@/app/api/inquiries/route').then(({ POST }) => POST(new NextRequest('http://localhost/api/inquiries', {
    method:  'POST',
    headers: { 'content-type': 'application/json' },
    body:    JSON.stringify(body),
  })))
}

beforeEach(() => {
  vi.clearAllMocks()
  resetAfterQueue()
  mockEnv.AI_AUTO_REPLY_ENABLED = true
  createInquiryMock.mockResolvedValue({ id: 'inq-after', status: 'new' })
  sendFaEmailMock.mockResolvedValue(undefined)
  sendAnglerEmailMock.mockResolvedValue(undefined)
  hasRecentInquiryMock.mockResolvedValue(false)
  primaryGuideMock.mockResolvedValue('guide-primary')
  classifyInquiryMock.mockResolvedValue({ qualified: 'yes', reason: 'ok' })
  autoSendReplyMock.mockResolvedValue(undefined)

  vi.mocked(createServiceClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'experience_pages') {
        const b = {
          select: () => b,
          eq:     () => b,
          single: async () => ({
            data: { id: '11111111-1111-1111-1111-111111111111', guide_id: 'guide-1', experience_name: 'NZ Trout Fly Fishing', country: 'New Zealand' },
            error: null,
          }),
        }
        return b
      }
      return { insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'row-1' }, error: null }) }) }) }
    },
  } as unknown as ReturnType<typeof createServiceClient>)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('/api/inquiries POST — AI work in after(), FA-1.61', () => {
  it('returns 201 before classifyInquiry finishes (it takes 5 s), then runs classify and auto-send in that order — RED on main: the response waits for the 5 s', async () => {
    // Only setTimeout is faked, so performance.now() below is real time.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let classifyFinished = false
    classifyInquiryMock.mockImplementation(() => new Promise<void>(resolve => {
      setTimeout(() => { classifyFinished = true; resolve() }, 5000)
    }))

    const started  = performance.now()
    const response = await post()
    const elapsed  = performance.now() - started

    expect(response.status).toBe(201)
    expect(elapsed).toBeLessThan(1000)
    expect(await response.json()).toEqual({ id: 'inq-after', status: 'new' })

    // scheduled, not started, not finished
    expect(afterMock).toHaveBeenCalledTimes(1)
    expect(afterQueue).toHaveLength(1)
    expect(classifyFinished).toBe(false)
    expect(autoSendReplyMock).not.toHaveBeenCalled()
    // the e-mails were awaited before the response
    expect(sendFaEmailMock).toHaveBeenCalledTimes(1)
    expect(sendAnglerEmailMock).toHaveBeenCalledTimes(1)

    const flushed = flushAfter()
    await vi.advanceTimersByTimeAsync(5000)
    await flushed

    expect(classifyFinished).toBe(true)
    expect(classifyInquiryMock).toHaveBeenCalledTimes(1)
    expect(autoSendReplyMock).toHaveBeenCalledTimes(1)
    expect(classifyInquiryMock.mock.invocationCallOrder[0])
      .toBeLessThan(autoSendReplyMock.mock.invocationCallOrder[0])
    expect(classifyInquiryMock).toHaveBeenCalledWith(expect.objectContaining({
      inquiryId: 'inq-after', anglerName: 'Test Angler', tripTitle: 'NZ Trout Fly Fishing', partySize: 2,
    }))
    expect(autoSendReplyMock).toHaveBeenCalledWith({ inquiryId: 'inq-after', counterpart: 'angler', channel: 'email' })
  })

  it('the stand-in really defers: when POST returns the callback is queued and nothing of the AI work has run — a route awaiting classify inline would fail this', async () => {
    const response = await post()

    expect(response.status).toBe(201)
    expect(afterQueue).toHaveLength(1)
    expect(classifyInquiryMock).not.toHaveBeenCalled()
    expect(autoSendReplyMock).not.toHaveBeenCalled()

    await flushAfter()

    expect(afterQueue).toHaveLength(0)
    expect(classifyInquiryMock).toHaveBeenCalledTimes(1)
    expect(autoSendReplyMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['trap filled',           { ...BODY, trip_notes_extra: 'http://spam.example', form_elapsed_ms: 15000 }, true,  false],
    ['filled too fast',       { ...BODY, form_elapsed_ms: 400 },                                           true,  false],
    ['repeat from the e-mail', BODY,                                                                       true,  true],
    ['auto-reply flag off',    BODY,                                                                       false, false],
  ])('%s: after() is not called at all, and nothing runs after a flush', async (_label, body, flag, repeat) => {
    mockEnv.AI_AUTO_REPLY_ENABLED = flag
    hasRecentInquiryMock.mockResolvedValue(repeat)

    const response = await post(body)
    await flushAfter()

    expect(response.status).toBe(201)
    expect(afterMock).not.toHaveBeenCalled()
    expect(afterQueue).toHaveLength(0)
    expect(classifyInquiryMock).not.toHaveBeenCalled()
    expect(autoSendReplyMock).not.toHaveBeenCalled()
  })

  it('classifyInquiry throws inside after(): logged as the agent error, auto-send still runs, the response was 201 already', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom  = new Error('model unavailable')
    classifyInquiryMock.mockRejectedValue(boom)

    const response = await post()
    expect(response.status).toBe(201)
    expect(error).not.toHaveBeenCalled()
    expect(autoSendReplyMock).not.toHaveBeenCalled()

    await flushAfter()

    expect(error).toHaveBeenCalledWith('[inquiries/POST] Agent error:', boom)
    expect(autoSendReplyMock).toHaveBeenCalledTimes(1)
  })

  it('autoSendReply throws inside after(): logged as the auto-send error, nothing escapes the callback', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom  = new Error('send crashed')
    autoSendReplyMock.mockRejectedValue(boom)

    const response = await post()
    expect(response.status).toBe(201)
    await expect(flushAfter()).resolves.toBeUndefined()

    expect(error).toHaveBeenCalledWith('[inquiries/POST] Auto-send error:', boom)
    expect(classifyInquiryMock).toHaveBeenCalledTimes(1)
  })

  it('after() itself throws synchronously (no request scope / no waitUntil): still 201, the e-mails were sent, the failure is logged', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom  = new Error('`after` was called outside a request scope')
    afterMock.mockImplementationOnce(() => { throw boom })

    const response = await post()

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: 'inq-after', status: 'new' })
    expect(sendFaEmailMock).toHaveBeenCalledTimes(1)
    expect(sendAnglerEmailMock).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Could not schedule the AI work for inq-after'), boom)

    await flushAfter()
    expect(classifyInquiryMock).not.toHaveBeenCalled()
    expect(autoSendReplyMock).not.toHaveBeenCalled()
  })
})
