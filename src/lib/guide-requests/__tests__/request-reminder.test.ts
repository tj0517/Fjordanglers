/**
 * FA-M.06 — the "guide hasn't opened" state with a controlled clock, the list filter, and the
 * reminder text. Pure: no database, no network.
 */
import { describe, it, expect } from 'vitest'
import { reminderState, isGuideNotOpened, type ReminderInput, type ReminderState } from '../reminder'
import { buildGuideReminderMessage } from '../send'
import { applyBaseFilters, type InquiryRow, type BaseFilterParams } from '@/app/admin/inquiries/InquiriesClient'

const HOUR = 3_600_000
const SENT = Date.parse('2027-01-10T08:00:00Z')
const at = (h: number) => SENT + h * HOUR
const iso = (ms: number) => new Date(ms).toISOString()

function req(over: Partial<ReminderInput> = {}): ReminderInput {
  return {
    requestId: 'r-1', guideId: 'g-1', channel: 'whatsapp',
    sentAt: iso(SENT), expiresAt: iso(at(7 * 24)),
    firstOpenedAt: null, answeredAt: null, withdrawnAt: null, remindedAt: null,
    ...over,
  }
}

describe('reminderState — the flag', () => {
  it('shows for a never-opened, unanswered, not-withdrawn request past its threshold (12 h)', () => {
    expect(reminderState(req(), 12, at(13))).toEqual({
      kind: 'not_opened', requestId: 'r-1', guideId: 'g-1', hoursSinceSent: 13, thresholdHours: 12, canRemind: true,
    })
  })

  it('not inside the threshold (11 h of 12; exactly 12 h is still inside)', () => {
    expect(reminderState(req(), 12, at(11))).toEqual({ kind: 'none' })
    expect(reminderState(req(), 12, at(12))).toEqual({ kind: 'none' })
  })

  it('24 h threshold: 13 h is inside, 25 h flags', () => {
    expect(reminderState(req(), 24, at(13))).toEqual({ kind: 'none' })
    expect(reminderState(req(), 24, at(25))).toMatchObject({ kind: 'not_opened', thresholdHours: 24 })
  })

  it('not for an opened request', () => {
    expect(reminderState(req({ firstOpenedAt: iso(at(1)) }), 12, at(30))).toEqual({ kind: 'none' })
  })

  it('not for an answered request', () => {
    expect(reminderState(req({ answeredAt: iso(at(1)) }), 12, at(30))).toEqual({ kind: 'none' })
  })

  it('not for a withdrawn request', () => {
    expect(reminderState(req({ withdrawnAt: iso(at(1)) }), 12, at(30))).toEqual({ kind: 'none' })
  })

  it('not when the guide was removed', () => {
    expect(reminderState(req({ guideId: null }), 12, at(30))).toEqual({ kind: 'none' })
  })

  it('email request: flagged, but no WhatsApp reminder', () => {
    expect(reminderState(req({ channel: 'email' }), 12, at(13))).toMatchObject({ kind: 'not_opened', canRemind: false })
  })
})

describe('reminderState — after the reminder and after expiry (§2 option B)', () => {
  it('reminded → "reminded X h ago" instead of the flag', () => {
    expect(reminderState(req({ remindedAt: iso(at(14)) }), 12, at(17))).toEqual({
      kind: 'reminded', requestId: 'r-1', remindedAt: iso(at(14)), hoursAgo: 3,
    })
  })

  it('link expired, never opened, no answer → "link expired" (no remind)', () => {
    expect(reminderState(req(), 12, at(7 * 24))).toEqual({ kind: 'expired', requestId: 'r-1', opened: false })
  })

  it('a request reminded earlier shows the expired label after expiry', () => {
    expect(reminderState(req({ remindedAt: iso(at(14)) }), 12, at(7 * 24 + 1))).toMatchObject({ kind: 'expired' })
  })

  it('expired but answered or withdrawn → nothing', () => {
    expect(reminderState(req({ answeredAt: iso(at(1)) }), 12, at(8 * 24))).toEqual({ kind: 'none' })
    expect(reminderState(req({ withdrawnAt: iso(at(1)) }), 12, at(8 * 24))).toEqual({ kind: 'none' })
  })
})

describe('reminder text', () => {
  const text = buildGuideReminderMessage({ guideFirstName: 'Josh', partySize: 2, area: 'Taupō', dates: ['2027-01-14', '2027-01-15'] })

  it('is the approved wording', () => {
    expect(text).toBe([
      'Hi Josh,',
      '',
      'Still waiting · Taupō, 14–15 Jan',
      '2 anglers. The client is waiting for an answer — the link is in my message above. One tap is enough.',
      '',
      'FjordAnglers',
    ].join('\n'))
  })

  it('contains no /r/ link and no token', () => {
    expect(text).not.toContain('/r/')
    expect(text).not.toMatch(/https?:\/\//)
    expect(text).not.toMatch(/[A-Za-z0-9_-]{43}/)
  })

  it('without a name, area or party size', () => {
    expect(buildGuideReminderMessage({ guideFirstName: null, partySize: null, area: null, dates: [] }))
      .toBe('Hi,\n\nStill waiting · flexible dates\nThe client is waiting for an answer — the link is in my message above. One tap is enough.\n\nFjordAnglers')
  })
})

// ─── the list filter "Guide hasn't opened" ─────────────────────────────────────

function row(id: string): InquiryRow {
  return {
    id, status: 'waiting_guide', angler_name: id, angler_email: `${id}@x.test`, angler_phone: null,
    requested_dates: ['2027-01-14'], party_size: 2, created_at: '2027-01-01T00:00:00Z', trip_id: null,
    experience_page_id: null, internal_commission_eur: null, deal_currency: null, lost_reason: null,
    last_contact_at: null, next_action: null, assigned_guide_id: 'g-1', guide_acceptance: null,
    guide_decline_reason: null, external_offer_sent: false, offer_sent_at: null, source: null,
    qualified: 'yes', trip_country: 'New Zealand',
  }
}

describe('list filter "Guide hasn\'t opened"', () => {
  const map: Record<string, ReminderState> = {
    flagged:          { kind: 'not_opened', requestId: 'a', guideId: 'g-1', hoursSinceSent: 13, thresholdHours: 12, canRemind: true },
    reminded:         { kind: 'reminded', requestId: 'b', remindedAt: iso(at(14)), hoursAgo: 3 },
    expired_unopened: { kind: 'expired', requestId: 'c', opened: false },
    expired_opened:   { kind: 'expired', requestId: 'd', opened: true },
  }
  const rows = ['flagged', 'reminded', 'expired_unopened', 'expired_opened', 'inside_threshold', 'no_request'].map(row)
  const base: BaseFilterParams = {
    mainFilter: 'guide', subFilter: null, q: '', countryFilter: '', guideIdFilter: '', guideRespFilter: '',
    sourceFilter: '', qualifiedFilter: '', slaFilter: false, tripMap: {}, countryMap: {}, reminderMap: map,
  }

  it('returns only never-opened requests past the threshold (flagged, reminded, expired unopened)', () => {
    const ids = applyBaseFilters(rows, { ...base, notOpenedFilter: true }).map(r => r.id)
    expect(ids).toEqual(['flagged', 'reminded', 'expired_unopened'])
  })

  it('off → every row', () => {
    expect(applyBaseFilters(rows, base)).toHaveLength(rows.length)
  })

  it('isGuideNotOpened: undefined (inside threshold / no request) → false', () => {
    expect(isGuideNotOpened(undefined)).toBe(false)
  })
})
