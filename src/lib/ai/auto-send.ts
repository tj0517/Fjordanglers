/**
 * Hybrid auto-send pipeline. FA-1.27.
 *
 * autoSendReply({ inquiryId, counterpart, channel })
 *   Pre-draft gates → draftReply (always saves draft) → destination gate → judge → send or hold.
 *   Emits `agent.auto_send_decided` for EVERY invocation:
 *     - pre-draft gate failures: sent=false, score=null, draft_message_id=null + reason
 *     - all post-draft outcomes: sent, score, draft_message_id from the saved draft
 *   Exception: flag-off is the CALLER's responsibility — no call → no event.
 *
 * hasAgentAutoReply(inquiryId)
 *   True when this inquiry already has an agent-drafted sent message to the angler.
 *   Used by email-inbound to decide the D2 transition (new → qualifying).
 *
 * SERVER-ONLY. Callers: api/inquiries/route.ts, api/webhooks/email-inbound/route.ts.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { draftReply, DraftReplyError } from '@/lib/ai/draft-reply'
import { judgeReply, JUDGE_THRESHOLD } from '@/lib/ai/judge-reply'
import { loadKnowledge } from '@/lib/ai/knowledge'
import { sendMessage } from '@/lib/messages/send'
import { emitEvent } from '@/lib/events/emit'
import {
  getInquiryForAutoSend,
  hasAgentSentReplyToAngler,
  getConversationForJudge,
} from '@/lib/supabase/queries'

export interface AutoSendResult {
  sent:           boolean
  score:          number | null
  reasons:        string[]
  draftMessageId: string | null
}

// ─── hasAgentAutoReply ────────────────────────────────────────────────────────

/**
 * Returns true when the inquiry already has at least one outbound angler message
 * drafted by the agent that was sent. Used for the D2 transition.
 */
export async function hasAgentAutoReply(inquiryId: string): Promise<boolean> {
  const supabase = createServiceClient()
  return hasAgentSentReplyToAngler(supabase, inquiryId)
}

// ─── autoSendReply ────────────────────────────────────────────────────────────

/**
 * Runs the full auto-send pipeline for one inquiry.
 *
 * Emits `agent.auto_send_decided` for every invocation, including pre-draft gate
 * failures. Returns null ONLY for hard errors (inquiry not found, no angler email,
 * draftReply failed). Returns AutoSendResult for gate failures and post-draft outcomes.
 * Flag-off is the caller's responsibility — do not call this when the flag is off.
 */
export async function autoSendReply(params: {
  inquiryId:   string
  counterpart: 'angler' | 'guide'
  channel:     'email' | 'whatsapp' | 'instagram'
}): Promise<AutoSendResult | null> {
  const { inquiryId, counterpart, channel } = params
  const supabase = createServiceClient()

  // Gate 1: only angler replies can be auto-sent
  if (counterpart !== 'angler') {
    await emitDecision(supabase, inquiryId, null, false, null, ['counterpart is not angler'])
    return { sent: false, score: null, reasons: ['counterpart is not angler'], draftMessageId: null }
  }

  // Gate 2: only email for now (D3)
  if (channel !== 'email') {
    const reason = `channel '${channel}' is not email`
    await emitDecision(supabase, inquiryId, null, false, null, [reason])
    return { sent: false, score: null, reasons: [reason], draftMessageId: null }
  }

  // Gate 3: only while qualifying is still open
  const inquiry = await getInquiryForAutoSend(supabase, inquiryId)

  if (inquiry == null) return null
  if (inquiry.status !== 'new' && inquiry.status !== 'qualifying') {
    const reason = `status '${inquiry.status}' is not eligible for auto-send`
    await emitDecision(supabase, inquiryId, null, false, null, [reason])
    return { sent: false, score: null, reasons: [reason], draftMessageId: null }
  }
  if (!inquiry.angler_email) return null

  // Draft — saved here regardless of gate 4 or judge, so admin always has it to edit.
  let draft: Awaited<ReturnType<typeof draftReply>>
  try {
    draft = await draftReply({ inquiryId, counterpart: 'angler', channel: 'email' })
  } catch (err) {
    if (err instanceof DraftReplyError) {
      // No instructions / empty thread / DB error — log and bail without an event,
      // because there is nothing for admin to act on (no draft was saved).
      console.error('[autoSendReply] draftReply failed:', err.message)
      return null
    }
    throw err
  }

  // Gate 4: destination knowledge entry must exist for this country.
  // Without it the draft may promise something we cannot deliver — never auto-send.
  const { entries } = await loadKnowledge({ country: inquiry.trip_country })
  const hasDestination = entries.some(e => e.kind === 'destination')

  if (!hasDestination) {
    const reason = 'no active destination knowledge entry for country: ' + (inquiry.trip_country ?? 'unknown')
    await emitDecision(supabase, inquiryId, draft.draftId, false, null, [reason])
    return { sent: false, score: null, reasons: [reason], draftMessageId: draft.draftId }
  }

  // Build conversation text for the judge from sent/received messages (no drafts).
  const msgs = await getConversationForJudge(supabase, inquiryId)
  const conversationText = msgs
    .map(m => `[${m.direction === 'inbound' ? 'ANGLER' : 'AGENT'}] ${m.body}`)
    .join('\n\n')

  // Judge
  let judged: Awaited<ReturnType<typeof judgeReply>>
  try {
    judged = await judgeReply(conversationText, draft.text)
  } catch (err) {
    const reason = `judge error: ${err instanceof Error ? err.message : String(err)}`
    console.error('[autoSendReply] judgeReply failed:', err)
    await emitDecision(supabase, inquiryId, draft.draftId, false, null, [reason])
    return { sent: false, score: null, reasons: [reason], draftMessageId: draft.draftId }
  }

  const shouldSend = judged.score >= JUDGE_THRESHOLD && judged.send

  if (shouldSend) {
    await sendMessage(supabase, {
      inquiryId,
      channel:     'email',
      counterpart: 'angler',
      to:          inquiry.angler_email,
      subject:     draft.subject ?? undefined,
      body:        draft.text,
      draftedBy:   'agent',
      draftId:     draft.draftId,
      actor:       { kind: 'agent' },
    })
  }

  await emitDecision(supabase, inquiryId, draft.draftId, shouldSend, judged.score, judged.reasons)

  return {
    sent:           shouldSend,
    score:          judged.score,
    reasons:        judged.reasons,
    draftMessageId: draft.draftId,
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function emitDecision(
  supabase:       ReturnType<typeof createServiceClient>,
  inquiryId:      string,
  draftMessageId: string | null,
  sent:           boolean,
  score:          number | null,
  reasons:        string[],
): Promise<void> {
  await emitEvent(supabase, {
    inquiryId,
    type:    'agent.auto_send_decided',
    actor:   { kind: 'agent' },
    source:  'app',
    channel: 'email',
    payload: { sent, score, reasons, draft_message_id: draftMessageId },
  })
}
