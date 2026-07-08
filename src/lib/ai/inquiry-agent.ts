/**
 * Inquiry Auto-Pilot Agent
 *
 * Analyzes a new inquiry and sends 2-3 qualifying questions to the angler.
 * Runs up to 3 rounds before marking the inquiry as ready for FA review.
 *
 * State machine:
 *   Round 1 (runAgentRound1): called after inquiry created
 *     → all info already known → send closing message, agent_status='ready'
 *     → missing info → send 2-3 questions, agent_status='waiting', agent_round=1
 *
 *   Round 2/3 (runAgentRound2): called when angler replies (email-inbound webhook)
 *     → enough=true → send closing message, agent_status='ready'
 *     → round >= 3  → send wrapping-up message, agent_status='ready'
 *     → still missing, round < 3 → send remaining questions, agent_round++
 *
 * Feature-flagged: only runs when AI_AUTO_REPLY_ENABLED=true in env.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { sendInquiryAgentEmail } from '@/lib/email'
import { assembleConversation, type ConversationMessage } from '@/lib/ai/extract-trip'
import { env } from '@/lib/env'

// ─── Rules for the agent (edit here, no DB needed) ────────────────────────────

const AGENT_RULES = `You are a follow-up assistant for FjordAnglers — a curated guided fishing trips agency connecting Central European anglers with Nordic fishing guides (Iceland, Norway, Sweden).

Your job: read the full inquiry, extract what is already known, and ask all remaining qualifying questions across two rounds (2-3 questions per round).

━━━ STEP 1 — READ THE FULL INQUIRY FIRST ━━━
The ORIGINAL INQUIRY section always contains structured form data:
- Experience requested (trip title)
- Requested dates (selected in the booking form)
- Party size (selected in the booking form) — ALWAYS already known, NEVER ask for this
- Angler's message (free text they wrote)

Read ALL of this before deciding anything. Extract what is already known.
NEVER ask for something already answered in the form or in the angler's message:
- Party size — always in the form. Treat as known. Do not ask.
- Species — if mentioned in the trip title or message, treat as known
- Budget — if any price or range mentioned, treat as known, never ask again
- Gear — "bringing own gear", "own rods and waders", "experienced fly angler" — treat as known
- Date flexibility — "only this date works", "flexible", "passing through", "cruise stop" — treat as known
- Trip format — "one free day", "one day", "full week", "lodge stay", "multi-day" — treat as known

━━━ STEP 2 — ALWAYS CLASSIFY THE TRIP FIRST ━━━

The VERY FIRST question in Round 1 is always the trip classification — unless the angler has already stated the format clearly in their message.

Ask: "Are you looking for just the one day, or a multi-day trip? And if multi-day, would you want accommodation included or would you arrange your own base?"

Skip this ONLY if the message already makes the format unambiguous:
- "just one day" / "one free day" / "day trip" — clearly single day
- "full week stay", "lodge", "multi-day" — clearly multi-day with or without lodge
- If even slightly ambiguous — ask.

━━━ STEP 3 — ROUND-BY-ROUND INSTRUCTIONS ━━━

The conversation context tells you the CURRENT ROUND. Follow the round instructions exactly.
Skip any question already clearly answered in the form or conversation. Do not skip questions just because the angler's reply was vague — ask again if needed.

IF CURRENT ROUND = 1:
Ask exactly 2 questions — no more, no less:
  Q1. Trip classification: single day or multi-day? If multi-day: lodge with accommodation or self-arranged?
  Q2. Target species (salmon / sea trout / brown trout / char — "fly fishing" is NOT specific enough) AND whether they want size (trophy), quantity (lots of action), or happy with whatever's running best.
  Exception: if trip format is already crystal clear from the message, skip Q1 and ask Q2 + one Round 2 question instead.
  enough=false always in Round 1.

IF CURRENT ROUND = 2:
Ask all Round 2 items that are still missing (up to 3):
  - Date flexibility — are the selected dates fixed, or is there some flexibility?
  - Budget — rough budget for the whole trip? (MANDATORY if not yet mentioned)
  - Duration — how many days of fishing? (multi-day only, if not answered in Round 1)
  enough=false always in Round 2 — Round 3 questions have not been asked yet.

IF CURRENT ROUND = 3:
Ask ALL questions that have not yet been answered — from any round. Do not skip anything still missing.
The full list of things to collect (skip if already known):
  - Trip format (single day / multi-day / lodge)
  - Target species + size vs quantity preference
  - Date flexibility
  - Budget
  - Duration (multi-day only)
  - Gear (own equipment or needs rentals?)
  - Skill level (beginner / some experience / seasoned)
  enough=true if ALL applicable items are now known. Otherwise enough=false.

Write questions as short natural sentences, not a numbered list.

━━━ "ENOUGH" DEFINITION ━━━

enough=true only when ALL of the following are known:
1. Trip format (single day or multi-day; if multi-day: lodge or self-arranged)
2. Target species (salmon / sea trout / brown trout / char — NOT just "fly fishing")
3. Date flexibility (fixed or open to change)
4. Budget (any price range or rough figure)
5. Duration (how many days — multi-day only; skip for single-day trips)
6. Gear (own equipment or needs rentals)
7. Skill level (beginner / some experience / seasoned)

Do NOT mark enough=true until all applicable questions are answered.
Missing gear or skill level alone is not a blocker only if the angler has already implied them (e.g. "experienced fly angler with own gear").

━━━ TONE ━━━
Direct and genuine — like a message from a fellow angler, not a sales rep.
Short sentences. No filler. No "excited to help", "happy to assist", "perfect fishing adventure".
Avoid icons and long dashes.

━━━ GOOD EXAMPLES ━━━

[1 date in form, title = "Guided Fly Fishing Iceland", message = empty]
Round 1: "Are you thinking just the one day, or something longer? And what are you mainly after — salmon, sea trout, or brown trout?"
→ Classification + species in one message. Date flex can follow in Round 2 if needed.

[1 date in form, title = "Atlantic Salmon River Day", message = "just one day"]
Round 1: "Are those dates fixed for you, or do you have some flexibility? Also, will you be bringing your own gear or would you need us to arrange equipment?"
→ Format known (one day), species known (salmon from title), asked date flex + gear.

[2 dates in form, title = "Guided Fly Fishing Iceland", message = empty]
Round 1: "Are you looking for just the one day, or a multi-day trip? And if multi-day, would you want accommodation included or arrange your own base?"
→ 2 dates = ambiguous. Always ask classification first.

[5 dates in form, title = "Luxury Tailored Iceland", message = "planning a group trip"]
Round 1: "Are you thinking a lodge stay with accommodation included, or guided days while arranging your own base? How many days of fishing are you thinking, and are those dates fixed or do you have some flexibility?"
→ Classification + duration + date flex combined. Species can follow in Round 2.

[Any trip — angler wrote "our budget is around €700-800"]
Never ask about budget. Move to next unknown.

[Any trip — angler wrote "bringing my own rod and waders"]
Skip gear question entirely.

━━━ BAD EXAMPLES ━━━

❌ "How many people will be fishing?" — party size is always in the form. Never ask.
❌ "What species are you targeting?" as the first question when trip format is still unknown
❌ "What species are you targeting?" when 2 dates were selected and trip format is unclear
❌ "What's your budget?" when angler already mentioned a price range
❌ "Is July 16th a fixed date for you?" before species and format are confirmed
❌ Marking enough=true before all 7 questions are answered (or clearly implied from context)
❌ Asking skill level or gear in Round 1 or Round 2 — these are Round 3 only
❌ "We'll check with the guide and get back to you" — not a question, that is a stall
❌ Sending a numbered list of 5 questions in one message — group naturally, max 3 per round

━━━ RESPONSE FORMAT ━━━
Return ONLY valid JSON, no extra text:
{
  "enough": true | false,
  "question": "the question(s) to ask" | null
}

"question" = null when enough=true or when you genuinely cannot ask anything useful`

// ─── Closing message sent when agent has collected enough info ────────────────

const CLOSING_MESSAGE = `Thanks for the details — that's everything we need to put together an offer for your trip. We'll contact the guide, sort out any licence requirements, and send you a full offer in the coming days.`

const WRAPPING_UP_MESSAGE = `Thanks for the answers — we have enough to get started. We'll review everything, reach out to the guide, and send you an offer in the coming days.`

// ─── AI call ──────────────────────────────────────────────────────────────────

interface AgentResult {
  enough: boolean
  question: string | null
}

async function callAgentAI(conversation: string, round: number): Promise<AgentResult> {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: AGENT_RULES,
    messages: [{ role: 'user', content: conversation + `\n\n[CURRENT ROUND: ${round} of 3]\n\nRespond with JSON only.` }],
  })

  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')

  const cleaned = block.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    console.error('[inquiry-agent] Failed to parse AI response as JSON:', cleaned.slice(0, 200))
    return { enough: false, question: null }
  }

  return {
    enough: parsed.enough === true,
    question: typeof parsed.question === 'string' && parsed.question.trim() ? parsed.question.trim() : null,
  }
}

// ─── Round 1 — called right after inquiry is created ─────────────────────────

export interface Round1Params {
  inquiryId:      string
  anglerName:     string
  anglerEmail:    string
  tripTitle:      string
  message:        string | null
  requestedDates: string[]
  partySize:      number
}

export async function runAgentRound1(params: Round1Params): Promise<void> {
  const { inquiryId, anglerName, anglerEmail, tripTitle, message, requestedDates, partySize } = params

  const conversation = assembleConversation(
    anglerName,
    message,
    requestedDates,
    partySize,
    tripTitle,
    [], // no messages yet
  )

  const result = await callAgentAI(conversation, 1)

  const supabase = createServiceClient()

  if (result.enough || !result.question) {
    if (result.enough) {
      // Send closing confirmation to angler
      await sendInquiryAgentEmail({ to: anglerEmail, anglerName, question: CLOSING_MESSAGE, tripTitle, inquiryId })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('lead_messages').insert({
        inquiry_id: inquiryId, direction: 'outbound', channel: 'email',
        contact_type: 'client', contact_name: anglerName, content: CLOSING_MESSAGE, created_by: 'agent',
      })
      console.log(`[inquiry-agent] Round 1 → sent closing message to ${anglerEmail} for inquiry ${inquiryId}`)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('inquiries')
      .update({ agent_status: 'ready' })
      .eq('id', inquiryId)
    console.log(`[inquiry-agent] Round 1 → ready for ${inquiryId}`)
    return
  }

  // Send qualifying questions
  await sendInquiryAgentEmail({
    to:        anglerEmail,
    anglerName,
    question:  result.question,
    tripTitle,
    inquiryId,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('lead_messages').insert({
    inquiry_id:   inquiryId,
    direction:    'outbound',
    channel:      'email',
    contact_type: 'client',
    contact_name: anglerName,
    content:      result.question,
    created_by:   'agent',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('inquiries')
    .update({ agent_status: 'waiting', agent_round: 1 })
    .eq('id', inquiryId)

  console.log(`[inquiry-agent] Round 1 → sent questions to ${anglerEmail} for inquiry ${inquiryId}`)
}

// ─── Round 2 — called when angler replies ─────────────────────────────────────

export async function runAgentRound2(inquiryId: string): Promise<void> {
  const supabase = createServiceClient()

  // Fetch inquiry + all messages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (supabase as any)
    .from('inquiries')
    .select('angler_name, angler_email, message, requested_dates, party_size, agent_round, trip_id, experience_page_id')
    .eq('id', inquiryId)
    .single()

  if (!inquiry) {
    console.error(`[inquiry-agent] Round 2: inquiry ${inquiryId} not found`)
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages } = await (supabase as any)
    .from('lead_messages')
    .select('direction, channel, contact_name, content, created_at')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true })

  // Fetch trip title
  let tripTitle = 'your trip'
  if (inquiry.trip_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: trip } = await (supabase as any)
      .from('experiences')
      .select('title')
      .eq('id', inquiry.trip_id)
      .single()
    if (trip?.title) tripTitle = trip.title
  } else if (inquiry.experience_page_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: expPage } = await (supabase as any)
      .from('experience_pages')
      .select('experience_name')
      .eq('id', inquiry.experience_page_id)
      .single()
    if (expPage?.experience_name) tripTitle = expPage.experience_name
  }

  const conversation = assembleConversation(
    inquiry.angler_name,
    inquiry.message ?? null,
    inquiry.requested_dates ?? [],
    inquiry.party_size ?? 1,
    tripTitle,
    (messages ?? []) as ConversationMessage[],
  )

  const currentRound: number = inquiry.agent_round ?? 1
  const result = await callAgentAI(conversation, currentRound + 1)

  const MAX_ROUNDS = 3

  // Stop if enough info or already at max rounds
  if (result.enough || !result.question || currentRound >= MAX_ROUNDS) {
    const outbound = result.enough ? CLOSING_MESSAGE : WRAPPING_UP_MESSAGE
    await sendInquiryAgentEmail({ to: inquiry.angler_email, anglerName: inquiry.angler_name, question: outbound, tripTitle, inquiryId })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('lead_messages').insert({
      inquiry_id: inquiryId, direction: 'outbound', channel: 'email',
      contact_type: 'client', contact_name: inquiry.angler_name, content: outbound, created_by: 'agent',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('inquiries')
      .update({ agent_status: 'ready' })
      .eq('id', inquiryId)
    console.log(`[inquiry-agent] Round ${currentRound} → ready for ${inquiryId} (enough=${result.enough})`)
    return
  }

  // Send follow-up questions
  await sendInquiryAgentEmail({
    to:         inquiry.angler_email,
    anglerName: inquiry.angler_name,
    question:   result.question,
    tripTitle,
    inquiryId,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('lead_messages').insert({
    inquiry_id:   inquiryId,
    direction:    'outbound',
    channel:      'email',
    contact_type: 'client',
    contact_name: inquiry.angler_name,
    content:      result.question,
    created_by:   'agent',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('inquiries')
    .update({ agent_status: 'waiting', agent_round: currentRound + 1 })
    .eq('id', inquiryId)

  console.log(`[inquiry-agent] Round ${currentRound + 1} → sent questions to ${inquiry.angler_email} for inquiry ${inquiryId}`)
}
