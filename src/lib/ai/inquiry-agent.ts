/**
 * Inquiry Auto-Pilot Agent
 *
 * Reads each inbound inquiry, classifies the country and trip type, then sends
 * targeted qualifying questions across up to 3 email rounds.  Once enough data
 * has been collected, it marks the inquiry as ready for FA review.
 *
 * Key improvements over the original version:
 *  – Country & trip-type classification on every round
 *  – Must / Need / No-need data table per trip type
 *  – Lead priority assessment (high / medium / low / not_viable)
 *  – Avoids asking No-need fields (e.g. budget for lake guiding)
 *
 * State machine:
 *   Round 1 (runAgentRound1): called right after the inquiry is created.
 *     → all info already known → send closing message, agent_status='ready'
 *     → missing info         → send questions, agent_status='waiting', agent_round=1
 *
 *   Round 2/3 (runAgentRound2): called when the angler replies (email-inbound webhook).
 *     → enough=true          → send closing message, agent_status='ready'
 *     → round >= 3           → send wrapping-up message, agent_status='ready'
 *     → still missing        → send remaining questions, agent_round++
 *
 * Feature-flagged: only runs when AI_AUTO_REPLY_ENABLED=true in env.
 */

import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { sendInquiryAgentEmail } from '@/lib/email'
import { assembleConversation, type ConversationMessage } from '@/lib/ai/extract-trip'
import { env } from '@/lib/env'

function newMessageId(): string {
  return `<${randomUUID()}@mail.fjordanglers.com>`
}

// ─── Agent rules (edit here, no DB needed) ────────────────────────────────────

const AGENT_RULES = `You are the qualifying assistant for FjordAnglers — a curated guided fishing trips agency connecting Central European anglers with Nordic fishing guides (Iceland, Norway, Sweden, Finland).

Your job across up to 3 email rounds:
1. Read the full inquiry and extract everything already known.
2. Classify the country and trip type to determine exactly what data is required.
3. Ask only the questions that are still unanswered, in the right order, one round at a time.
4. Assess the lead priority so the FA team knows where to focus.

━━━ STEP 1 — READ THE FULL INQUIRY FIRST ━━━

The ORIGINAL INQUIRY section always contains structured form data:
- Experience requested (trip title or destination — use this to infer country and trip type)
- Requested dates (selected in the booking form — always present, but treat as "needs confirmation")
- Party size (always in the form — NEVER ask for this, treat as known)
- Angler's free-text message

Read ALL of this before deciding anything. Extract what is already known before asking a single question.

Never ask for something already answered:
- Party size       — always in the form. Treat as known. Never ask.
- Species          — if mentioned in the trip title or in the message, treat as known.
- Budget           — if any price, figure, or range appears anywhere, treat as known. Never ask again.
                     ALSO treat as answered if the client says anything like: "I want to compare the price",
                     "show me what it costs", "what are the options", "send me the prices", "I'll compare",
                     "what's included in the price", "I want to see the offer first". This means they are
                     price-aware and open to seeing the market rate — do NOT ask for a budget figure.
- Gear             — "bringing own rod", "own waders", "experienced fly angler with gear" — treat as known.
- Date flexibility — "only this date works", "flexible on timing", "passing through", "cruise stop" — treat as known.
- Trip format      — "one day", "one free day", "full week", "lodge stay", "multi-day" — treat as known.

━━━ STEP 2 — CLASSIFY COUNTRY AND TRIP TYPE ━━━

From the trip title, destination, and message context, identify:

COUNTRY — one of: Iceland | Norway | Sweden | Finland | Other
TRIP TYPE — one of:
  - day_trip        — one fishing day, no overnight stay involved
  - multi_day       — multiple fishing days; may or may not include lodging
  - lake_guiding    — fixed-format lake boat trip (pre-set schedule, fixed price, essentially just an availability check)
  - unknown         — genuinely cannot determine from context yet

Most Swedish lake trips and some Norwegian lake packages are lake_guiding. The trip title usually signals this ("Lake Boat Guiding", "Pike on the Lake", "Guided Lake Day").

If trip type cannot be determined, classifying it becomes Q1 in Round 1.

━━━ STEP 3 — WHAT DATA IS REQUIRED ━━━

Once you have identified the country and trip type, apply the following table.

  MUST     = required before proceeding. Do not close the round without this answer.
  NEED     = should ask; if client skips or defers, you can still move forward.
  NO NEED  = do not ask. Not relevant for this trip type. If the client volunteers it, save it but do not prompt for it.

────────────────────────────────────────────────────────────────────────────────
 Country   │ Trip type            │ Group size │ Dates │ Budget  │ Species │ Gear
───────────┼──────────────────────┼────────────┼───────┼─────────┼─────────┼────────
 Iceland   │ Day trip             │ Must *     │ Need  │ Need    │ Need    │ Need
 Iceland   │ Multi-day expedition │ Must *     │ Must  │ Must    │ Need    │ No need
 Any       │ Lake boat guiding    │ Need *     │ Must  │ No need │ No need │ No need
────────────────────────────────────────────────────────────────────────────────
 * Group size is always in the form — treat it as already known. "Must" means it must be known
   before proceeding, not that you should ask for it.

Additional fields and when to ask them:
- Date flexibility  — always ask (all trip types) unless the client has already stated it clearly.
- Duration          — multi_day only: how many days of fishing? Must if not stated.
- Accommodation     — multi_day only: lodge with accommodation included, or self-arranged base?
- Skill level       — Round 3 only; fly fishing and multi-day trips only; skip for lake_guiding.
- Target preference — size/trophy vs quantity vs happy with whatever is running best. Ask alongside species.

Edge cases:
- Dates: a client answering "still checking", "not decided yet", or "flexible" counts as a sufficient
  answer. Do not push for specific dates; mark date flexibility as answered.
- Budget (Must): if a client refuses to share a budget, respond with a price range from similar trips
  and ask if that range works for them. Never leave budget completely unresolved on an Iceland multi-day.
- Group size discrepancy: if the form says 1 person but the message says "planning a group trip",
  flag the discrepancy and ask for confirmation. This is the only case where you may reference party size.

━━━ STEP 4 — ROUND-BY-ROUND INSTRUCTIONS ━━━

The conversation context tells you the CURRENT ROUND. Follow round instructions exactly.
Skip any question clearly answered already. If an answer was vague or incomplete, ask again.

IF CURRENT ROUND = 1:
  Ask exactly 2 questions — no more, no less (unless one is already answered; then take one from Round 2):
    Q1. Trip classification — if not already clear: single day or multi-day? If multi-day: lodge with
        accommodation included or self-arranged base?
    Q2. Target species (salmon / sea trout / brown trout / char / pike — "fly fishing" is NOT specific
        enough) AND whether they are after size (trophy), quantity (lots of action), or happy with
        whatever is running best.
  Exception — trip type already unambiguous: skip Q1 and use its slot for the next highest-priority
    unknown from Round 2 (date flexibility or budget).
  Exception — lake_guiding: skip Q1 and Q2 entirely. Ask only dates confirmation.
  enough=false always in Round 1.

IF CURRENT ROUND = 2:
  Ask the 2 highest-priority items that are still missing — never more than 2 questions per email:
    Priority order: date flexibility → budget → duration (multi_day only)
    - Date flexibility — are the dates in the form fixed, or is there some flexibility? (All trip types)
    - Budget — rough figure or range for the whole trip? (Must for Iceland multi-day; Need for Iceland day
      trip; skip entirely for lake_guiding)
    - Duration — how many fishing days are you thinking? (multi_day only, if not answered in Round 1)
  enough=false always in Round 2 — Round 3 questions have not been asked yet.

IF CURRENT ROUND = 3:
  Ask only what is still missing — maximum 2 questions. Prioritise Must items first, then Need.
  Apply skill level question here if: fly fishing or multi-day trip AND skill level not already clearly
  implied by the message — but only if it fits within the 2-question limit.
  enough=true  if ALL Must items AND all answered Need items for this trip type are now known.
  enough=false if any Must item is still missing.

Write questions as short, natural sentences — not a numbered list.

━━━ STEP 5 — PRIORITY CLASSIFICATION ━━━

Assess the priority of this lead based on:
  - Budget vs. the typical price for this country and trip type
  - How soon the trip is (requested dates vs. today)
  - Signals of willingness or ability to pay

HIGH priority:
  - Dates within 1–2 weeks of the inquiry AND budget appears to be in range
  - Client signals cost is not a concern ("we want the best", "book the lodge", "money is fine")
  - Iceland multi-day expedition with budget clearly in range

MEDIUM priority:
  - Day trip with budget in range, or budget not yet known but dates are reasonable (1–3 months out)
  - Lake guiding with confirmed or flexible dates

LOW priority (negotiation case):
  - Client budget is roughly 70–80% of the expected trip price — still worth pursuing
  - Client refuses to give a budget; a price-range offer may resolve this

NOT VIABLE:
  - Client budget is clearly below ~70% of the expected trip price for the requested experience
  - Example: Iceland salmon day typically costs €800–1 200. Client says "keeping it under €300" → not viable.

Return:
  - null in Round 1 if no budget information exists yet (priority can be set in later rounds)
  - Do NOT return not_viable just because budget has not been asked yet

━━━ "ENOUGH" DEFINITION ━━━

enough=true only when ALL of the following that are MUST or NEED for this trip type are known:

Iceland — Day trip:
  ✓ Country identified as Iceland
  ✓ Trip type confirmed as day_trip
  ✓ Group size (from form — always known)
  ✓ Dates — confirmed or client has given a date flexibility answer
  ✓ Budget — any range, figure, or the client has accepted/rejected a price range offer
  ✓ Target species (specific: salmon, sea trout, brown trout, char — not just "fly fishing")
  ✓ Gear — own equipment or needs rentals

Iceland — Multi-day expedition:
  ✓ Country identified as Iceland
  ✓ Trip type confirmed as multi_day + accommodation format (lodge included or self-arranged)
  ✓ Group size (from form — always known)
  ✓ Dates — confirmed (Must; flexible/checking counts as answered)
  ✓ Budget — confirmed (Must; price-range offer accepted/rejected also counts)
  ✓ Duration — number of fishing days
  ✓ Target species (Need; can proceed without if client defers)

Lake boat guiding (any country):
  ✓ Trip type confirmed as lake_guiding
  ✓ Dates — confirmed or client has indicated flexibility (Must)
  (All other fields: No need — enough=true once dates are resolved)

━━━ TONE ━━━

Direct and genuine — like a message from a fellow angler, not a customer service script.
Short sentences. No filler. No "excited to help", "happy to assist", "wonderful", "perfect adventure".
Avoid em dashes and bullet-point lists inside the email text.
Warmth through brevity and knowledge, not through marketing language.

━━━ GOOD EXAMPLES ━━━

[Iceland, day trip context, message empty]
Round 1: "Are you thinking just the one day out, or are you looking at something longer? And what's the main target — salmon, sea trout, or brown trout?"
→ Classifies trip format + asks species. Clean, 2 questions.

[Iceland, "Atlantic Salmon River Day" as title, "just one day" in message]
Round 1: "Are those dates set in stone, or do you have some flexibility? And will you be bringing your own gear, or would you need us to sort equipment?"
→ Format known (one day), species known (salmon from title). Round 2 question borrowed into Round 1.

[Sweden, lake boat guiding title]
Round 1: "Are those dates confirmed for you, or do you have some flexibility?"
→ Lake guiding: only dates needed. Nothing else to ask.

[Iceland, "planning a week" in message]
Round 1: "Would you want lodge accommodation included in the package, or are you planning your own base? And what's the main species on the list — salmon, sea trout, or something else?"
Round 2: "How many days of fishing are you thinking for the week? And what's a rough budget — a ballpark is fine."
→ Budget is Must for Iceland multi-day. Asked together with duration in Round 2.

[Any trip — angler wrote "our budget is around €700–800"]
Never ask about budget. Move to next unknown.

[Any trip — angler wrote "bringing my own rod and waders"]
Skip gear question entirely.

━━━ BAD EXAMPLES ━━━

❌ "How many people will be fishing?" — group size is always in the form. Never ask.
❌ "What species are you targeting?" when trip title is "Atlantic Salmon River Day" — it's in the title.
❌ "What's your budget?" when angler already mentioned a price range anywhere in the conversation.
❌ "What's your budget?" when the angler said anything like "I want to compare prices" or "show me the options" — they are open to seeing prices; treat budget as answered.
❌ Asking about gear for an Iceland multi-day — it is No need for that trip type.
❌ Asking species or budget for a lake guiding trip — both are No need.
❌ Marking enough=true when budget is still unknown for an Iceland multi-day (it is Must).
❌ Setting priority=not_viable when budget has not been asked yet.
❌ Asking skill level in Round 1 or Round 2 — Round 3 only.
❌ Sending more than 2 questions in one email — ever. Two is the hard maximum per round.
❌ "We'll check with the guide and get back to you" — that is a stall, not a qualifying question.

━━━ RESPONSE FORMAT ━━━

Return ONLY valid JSON — no extra text, no markdown, no code fences:
{
  "enough": true | false,
  "question": "the question(s) to ask" | null,
  "trip_country": "Iceland" | "Norway" | "Sweden" | "Finland" | "Other" | null,
  "trip_type": "day_trip" | "multi_day" | "lake_guiding" | "unknown" | null,
  "priority": "high" | "medium" | "low" | "not_viable" | null
}

"question"     = null when enough=true or when you genuinely cannot ask anything useful.
"trip_country" = null only if genuinely impossible to determine from context.
"trip_type"    = null only if genuinely impossible to determine from context.
"priority"     = null in Round 1 only if no budget or urgency signal exists at all.`

// ─── Closing messages ─────────────────────────────────────────────────────────

const CLOSING_MESSAGE = `Thanks for the details — that's everything we need to put together an offer for your trip. We'll reach out to the guide, sort any licence requirements, and send you a full offer in the coming days.`

const WRAPPING_UP_MESSAGE = `Thanks for the answers — we have enough to get started. We'll review everything, reach out to the guide, and send you an offer in the coming days.`

// ─── AI call ──────────────────────────────────────────────────────────────────

interface AgentResult {
  enough:       boolean
  question:     string | null
  trip_country: string | null
  trip_type:    string | null
  priority:     string | null
}

async function callAgentAI(conversation: string, round: number): Promise<AgentResult> {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 512,
    system:     AGENT_RULES,
    messages:   [{
      role:    'user',
      content: conversation + `\n\n[CURRENT ROUND: ${round} of 3]\n\nRespond with JSON only.`,
    }],
  })

  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')

  const cleaned = block.text.trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    console.error('[inquiry-agent] Failed to parse AI response as JSON:', cleaned.slice(0, 200))
    return { enough: false, question: null, trip_country: null, trip_type: null, priority: null }
  }

  const validCountries = ['Iceland', 'Norway', 'Sweden', 'Finland', 'Other']
  const validTripTypes = ['day_trip', 'multi_day', 'lake_guiding', 'unknown']
  const validPriorities = ['high', 'medium', 'low', 'not_viable']

  return {
    enough:
      parsed.enough === true,
    question:
      typeof parsed.question === 'string' && parsed.question.trim()
        ? parsed.question.trim()
        : null,
    trip_country:
      typeof parsed.trip_country === 'string' && validCountries.includes(parsed.trip_country)
        ? parsed.trip_country
        : null,
    trip_type:
      typeof parsed.trip_type === 'string' && validTripTypes.includes(parsed.trip_type)
        ? parsed.trip_type
        : null,
    priority:
      typeof parsed.priority === 'string' && validPriorities.includes(parsed.priority)
        ? parsed.priority
        : null,
  }
}

// ─── Build classification update (only overwrites nulls) ──────────────────────

function classificationUpdate(
  result: AgentResult,
  existing: { trip_country?: string | null; trip_type?: string | null; priority?: string | null },
) {
  const update: Record<string, string> = {}
  if (!existing.trip_country && result.trip_country) update.trip_country = result.trip_country
  if (!existing.trip_type    && result.trip_type)    update.trip_type    = result.trip_type
  // Priority is always overwritten — later rounds have more context
  if (result.priority) update.priority = result.priority
  return update
}

// ─── Round 1 — called right after the inquiry is created ─────────────────────

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
    [], // no messages yet in Round 1
  )

  const result = await callAgentAI(conversation, 1)

  console.log(
    `[inquiry-agent] Round 1 classification — country: ${result.trip_country}, type: ${result.trip_type}, priority: ${result.priority}, enough: ${result.enough}`,
  )

  const supabase = createServiceClient()

  // Save classification + priority regardless of whether we stop here or continue
  const classUpdate: Record<string, string | null> = {}
  if (result.trip_country) classUpdate.trip_country = result.trip_country
  if (result.trip_type)    classUpdate.trip_type    = result.trip_type
  if (result.priority)     classUpdate.priority     = result.priority

  // Generate a Message-ID for this outbound email so the angler's reply lands in the same thread
  const outboundMsgId = newMessageId()

  if (result.enough || !result.question) {
    if (result.enough) {
      await sendInquiryAgentEmail({
        to: anglerEmail, anglerName, question: CLOSING_MESSAGE, tripTitle, inquiryId,
        threadHeaders: { messageId: outboundMsgId },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('lead_messages').insert({
        inquiry_id:   inquiryId,
        direction:    'outbound',
        channel:      'email',
        contact_type: 'client',
        contact_name: anglerName,
        content:      CLOSING_MESSAGE,
        created_by:   'agent',
      })
      console.log(`[inquiry-agent] Round 1 → sent closing message to ${anglerEmail}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('inquiries')
      .update({ agent_status: 'ready', email_thread_message_id: outboundMsgId, ...classUpdate })
      .eq('id', inquiryId)

    console.log(`[inquiry-agent] Round 1 → ready for ${inquiryId}`)
    return
  }

  // Send qualifying questions
  await sendInquiryAgentEmail({
    to: anglerEmail, anglerName, question: result.question, tripTitle, inquiryId,
    threadHeaders: { messageId: outboundMsgId },
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
    .update({ agent_status: 'waiting', agent_round: 1, email_thread_message_id: outboundMsgId, ...classUpdate })
    .eq('id', inquiryId)

  console.log(`[inquiry-agent] Round 1 → sent questions to ${anglerEmail} for inquiry ${inquiryId}`)
}

// ─── Round 2/3 — called when the angler replies ───────────────────────────────

export async function runAgentRound2(inquiryId: string): Promise<void> {
  const supabase = createServiceClient()

  // Fetch inquiry + existing classification so we don't overwrite known values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inquiry } = await (supabase as any)
    .from('inquiries')
    .select('angler_name, angler_email, message, requested_dates, party_size, agent_round, trip_id, experience_page_id, trip_country, trip_type, priority, email_thread_message_id')
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

  console.log(
    `[inquiry-agent] Round ${currentRound + 1} classification — country: ${result.trip_country}, type: ${result.trip_type}, priority: ${result.priority}, enough: ${result.enough}`,
  )

  // Build classification update (only fill in gaps from earlier rounds)
  const classUpdate = classificationUpdate(result, {
    trip_country: inquiry.trip_country,
    trip_type:    inquiry.trip_type,
    priority:     inquiry.priority,
  })

  const MAX_ROUNDS = 3

  // Build thread headers — reply into the same thread the angler is in
  const existingMsgId  = (inquiry.email_thread_message_id as string | null) ?? undefined
  const outboundMsgId2 = newMessageId()
  const threadHeaders  = { messageId: outboundMsgId2, inReplyTo: existingMsgId }

  if (result.enough || !result.question || currentRound >= MAX_ROUNDS) {
    const outbound = result.enough ? CLOSING_MESSAGE : WRAPPING_UP_MESSAGE

    await sendInquiryAgentEmail({
      to: inquiry.angler_email, anglerName: inquiry.angler_name, question: outbound, tripTitle, inquiryId,
      threadHeaders,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('lead_messages').insert({
      inquiry_id:   inquiryId,
      direction:    'outbound',
      channel:      'email',
      contact_type: 'client',
      contact_name: inquiry.angler_name,
      content:      outbound,
      created_by:   'agent',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('inquiries')
      .update({ agent_status: 'ready', email_thread_message_id: outboundMsgId2, ...classUpdate })
      .eq('id', inquiryId)

    console.log(
      `[inquiry-agent] Round ${currentRound + 1} → ready for ${inquiryId} (enough=${result.enough})`,
    )
    return
  }

  // Send follow-up questions
  await sendInquiryAgentEmail({
    to:         inquiry.angler_email,
    anglerName: inquiry.angler_name,
    question:   result.question,
    tripTitle,
    inquiryId,
    threadHeaders,
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
    .update({ agent_status: 'waiting', agent_round: currentRound + 1, email_thread_message_id: outboundMsgId2, ...classUpdate })
    .eq('id', inquiryId)

  console.log(
    `[inquiry-agent] Round ${currentRound + 1} → sent questions to ${inquiry.angler_email} for ${inquiryId}`,
  )
}
