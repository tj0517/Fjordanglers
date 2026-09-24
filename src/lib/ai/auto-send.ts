/**
 * Hybrid auto-send pipeline. FA-1.27.
 *
 * autoSendReply({ inquiryId, counterpart, channel })
 *   Hard gates → draftReply (always saves draft) → destination gate → judge → send or hold.
 *   Emits `agent.auto_send_decided` with {sent, score, reasons, draft_message_id}.
 *   Returns null when a pre-draft gate blocks (counterpart, channel, status) — no draft,
 *   no event, no side-effects. Returns AutoSendResult for all post-draft outcomes.
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

export interface AutoSendResult {
  sent:           boolean
  score:          number | null
  reasons:        string[]
  draftMessageId: string
}

// ─── hasAgentAutoReply ────────────────────────────────────────────────────────

/**
 * Returns true when the inquiry already has at least one outbound angler message
 * drafted by the agent that was sent. Used for the D2 transition: when the angler
 * replies to a 'new' inquiry that received an auto-reply, move status to 'qualifying'.
 */
export async function hasAgentAutoReply(inquiryId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('inquiry_id', inquiryId)
    .eq('direction', 'outbound')
    .eq('counterpart', 'angler')
    .eq('drafted_by', 'agent')
    .in('status', ['sent', 'queued'])

  return (count ?? 0) > 0
}

// ─── autoSendReply ────────────────────────────────────────────────────────────

/**
 * Runs the full auto-send pipeline for one inquiry. Returns null when a pre-draft
 * gate does not pass (no DB writes). Returns AutoSendResult for all post-draft
 * outcomes (draft row always exists in the DB by the time this returns non-null).
 */
export async function autoSendReply(params: {
  inquiryId:   string
  counterpart: 'angler' | 'guide'
  channel:     'email' | 'whatsapp' | 'instagram'
}): Promise<AutoSendResult | null> {
  const { inquiryId, counterpart, channel } = params

  // Gate 1: only angler replies can be auto-sent
  if (counterpart !== 'angler') return null

  // Gate 2: only email for now (D3)
  if (channel !== 'email') return null

  // Gate 3: only while qualifying is still open
  const supabase = createServiceClient()
  const { data: inquiry } = await supabase
    .from('inquiries')
    .select('id, status, trip_country, angler_email')
    .eq('id', inquiryId)
    .maybeSingle()

  if (inquiry == null) return null
  if (inquiry.status !== 'new' && inquiry.status !== 'qualifying') return null
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
    await emitDecision(inquiryId, draft.draftId, false, null, [
      'no active destination knowledge entry for country: ' + (inquiry.trip_country ?? 'unknown'),
    ])
    return {
      sent:           false,
      score:          null,
      reasons:        ['no active destination knowledge entry for country: ' + (inquiry.trip_country ?? 'unknown')],
      draftMessageId: draft.draftId,
    }
  }

  // Build conversation text for the judge from sent/received messages (no drafts).
  const { data: msgs } = await supabase
    .from('messages')
    .select('direction, body, occurred_at')
    .eq('inquiry_id', inquiryId)
    .neq('status', 'draft')
    .order('occurred_at', { ascending: true })

  const conversationText = (msgs ?? [])
    .map(m => `[${m.direction === 'inbound' ? 'ANGLER' : 'AGENT'}] ${m.body}`)
    .join('\n\n')

  // Judge
  let judged: Awaited<ReturnType<typeof judgeReply>>
  try {
    judged = await judgeReply(conversationText, draft.text)
  } catch (err) {
    const reason = `judge error: ${err instanceof Error ? err.message : String(err)}`
    console.error('[autoSendReply] judgeReply failed:', err)
    await emitDecision(inquiryId, draft.draftId, false, null, [reason])
    return { sent: false, score: null, reasons: [reason], draftMessageId: draft.draftId }
  }

  const shouldSend = judged.score >= JUDGE_THRESHOLD && judged.send

  if (shouldSend) {
    await sendMessage(supabase, {
      inquiryId,
      channel:    'email',
      counterpart: 'angler',
      to:          inquiry.angler_email,
      subject:     draft.subject ?? undefined,
      body:        draft.text,
      draftedBy:   'agent',
      draftId:     draft.draftId,
      actor:       { kind: 'agent' },
    })
  }

  await emitDecision(inquiryId, draft.draftId, shouldSend, judged.score, judged.reasons)

  return {
    sent:           shouldSend,
    score:          judged.score,
    reasons:        judged.reasons,
    draftMessageId: draft.draftId,
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function emitDecision(
  inquiryId:       string,
  draftMessageId:  string,
  sent:            boolean,
  score:           number | null,
  reasons:         string[],
): Promise<void> {
  const supabase = createServiceClient()
  await emitEvent(supabase, {
    inquiryId,
    type:    'agent.auto_send_decided',
    actor:   { kind: 'agent' },
    source:  'app',
    channel: 'email',
    payload: { sent, score, reasons, draft_message_id: draftMessageId },
  })
}
