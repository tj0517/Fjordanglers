import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { assembleConversation } from '@/lib/ai/extract-trip'
import { env } from '@/lib/env'
import { computeQualified, setQualified } from '@/lib/inquiries/qualified'

// ─── Agent rules (edit here, no DB needed) ────────────────────────────────────

const AGENT_RULES = `You are the qualifying assistant for FjordAnglers — a curated guided fishing trips agency connecting Central European anglers with fishing guides in Iceland, Norway, Sweden, Finland, New Zealand, and Patagonia (Argentina & Chile).

Your job: read the inquiry and classify it accurately so the FA team knows where to focus.

━━━ STEP 1 — READ THE FULL INQUIRY FIRST ━━━

The ORIGINAL INQUIRY section always contains structured form data:
- Experience requested (trip title or destination — use this to infer country and trip type)
- Requested dates (selected in the booking form — always present, but treat as "needs confirmation")
- Party size (always in the form — NEVER ask for this, treat as known)
- Angler's free-text message

Read ALL of this before deciding anything. Extract what is already known before classifying.

Never treat as unknown something already answered:
- Party size       — always in the form. Treat as known. Never ask.
- Species          — if mentioned in the trip title or in the message, treat as known.
- Budget           — if any price, figure, or range appears anywhere, treat as known.
                     ALSO treat as answered if the client says anything like: "I want to compare the price",
                     "show me what it costs", "what are the options", "send me the prices", "I'll compare",
                     "what's included in the price", "I want to see the offer first". This means they are
                     price-aware and open to seeing the market rate.
- Gear             — "bringing own rod", "own waders", "experienced fly angler with gear" — treat as known.
- Date flexibility — "only this date works", "flexible on timing", "passing through", "cruise stop" — treat as known.
- Trip format      — "one day", "one free day", "full week", "lodge stay", "multi-day" — treat as known.

━━━ STEP 2 — CLASSIFY COUNTRY AND TRIP TYPE ━━━

From the trip title, destination, and message context, identify:

COUNTRY — one of: Iceland | Norway | Sweden | Finland | New Zealand | Argentina | Chile | Other
TRIP TYPE — one of:
  - day_trip        — one fishing day, no overnight stay involved
  - multi_day       — multiple fishing days; may or may not include lodging
  - lake_guiding    — fixed-format lake boat trip (pre-set schedule, fixed price, essentially just an availability check)
  - unknown         — genuinely cannot determine from context yet

Most Swedish lake trips and some Norwegian lake packages are lake_guiding. The trip title usually signals this ("Lake Boat Guiding", "Pike on the Lake", "Guided Lake Day").

━━━ STEP 3 — WHAT DATA IS REQUIRED ━━━

Once you have identified the country and trip type, apply the following table. This context helps calibrate priority.

  MUST     = required before proceeding.
  NEED     = should ask; if client skips or defers, you can still move forward.
  NO NEED  = do not ask. Not relevant for this trip type.

────────────────────────────────────────────────────────────────────────────────
 Country      │ Trip type            │ Group size │ Dates │ Budget  │ Species │ Gear
──────────────┼──────────────────────┼────────────┼───────┼─────────┼─────────┼────────
 Iceland      │ Day trip             │ Must *     │ Need  │ Need    │ Need    │ Need
 Iceland      │ Multi-day expedition │ Must *     │ Must  │ Must    │ Need    │ No need
 Any          │ Lake boat guiding    │ Need *     │ Must  │ No need │ No need │ No need
 New Zealand  │ Day trip             │ Must *     │ Need  │ Need    │ Need    │ Need
 New Zealand  │ Multi-day expedition │ Must *     │ Must  │ Need    │ Need    │ No need
────────────────────────────────────────────────────────────────────────────────
 * Group size is always in the form — treat it as already known.

━━━ STEP 4 — PRIORITY CLASSIFICATION ━━━

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

Return null if no budget or urgency signal exists at all.
Do NOT return not_viable just because budget has not been asked yet.

━━━ RESPONSE FORMAT ━━━

Return ONLY valid JSON — no extra text, no markdown, no code fences:
{
  "trip_country": "Iceland" | "Norway" | "Sweden" | "Finland" | "New Zealand" | "Argentina" | "Chile" | "Other" | null,
  "trip_type": "day_trip" | "multi_day" | "lake_guiding" | "unknown" | null,
  "priority": "high" | "medium" | "low" | "not_viable" | null
}

"trip_country" = null only if genuinely impossible to determine from context.
"trip_type"    = null only if genuinely impossible to determine from context.
"priority"     = null if no budget or urgency signal exists at all.`

// ─── AI call ──────────────────────────────────────────────────────────────────

interface ClassificationResult {
  trip_country: string | null
  trip_type:    string | null
  priority:     string | null
}

async function callClassifierAI(conversation: string): Promise<ClassificationResult> {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 256,
    system:     AGENT_RULES,
    messages:   [{
      role:    'user',
      content: conversation + '\n\nRespond with JSON only.',
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
    return { trip_country: null, trip_type: null, priority: null }
  }

  const validCountries  = ['Iceland', 'Norway', 'Sweden', 'Finland', 'New Zealand', 'Argentina', 'Chile', 'Other']
  const validTripTypes  = ['day_trip', 'multi_day', 'lake_guiding', 'unknown']
  const validPriorities = ['high', 'medium', 'low', 'not_viable']

  return {
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
  result: ClassificationResult,
  existing: { trip_country?: string | null; trip_type?: string | null; priority?: string | null },
) {
  const update: Record<string, string> = {}
  if (!existing.trip_country && result.trip_country) update.trip_country = result.trip_country
  if (!existing.trip_type    && result.trip_type)    update.trip_type    = result.trip_type
  // Priority is always overwritten — later rounds have more context
  if (result.priority) update.priority = result.priority
  return update
}

// ─── Classify — called right after the inquiry is created ────────────────────

export interface ClassifyInquiryParams {
  inquiryId:      string
  anglerName:     string
  tripTitle:      string
  message:        string | null
  requestedDates: string[]
  partySize:      number
}

export async function classifyInquiry(params: ClassifyInquiryParams): Promise<void> {
  const { inquiryId, anglerName, tripTitle, message, requestedDates, partySize } = params

  const conversation = assembleConversation(
    anglerName,
    message,
    requestedDates,
    partySize,
    tripTitle,
    [],
  )

  const result = await callClassifierAI(conversation)

  console.log(
    `[inquiry-agent] classification — country: ${result.trip_country}, type: ${result.trip_type}, priority: ${result.priority}`,
  )

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('inquiries')
    .select('trip_country, trip_type, priority, qualified_set_by')
    .eq('id', inquiryId)
    .single()

  const classUpdate = classificationUpdate(result, existing ?? {})

  if (Object.keys(classUpdate).length > 0) {
    await supabase
      .from('inquiries')
      .update(classUpdate)
      .eq('id', inquiryId)
  }

  const qualifiedResult = computeQualified({
    priority:    (classUpdate.priority    ?? existing?.priority)    ?? null,
    tripCountry: (classUpdate.trip_country ?? existing?.trip_country) ?? null,
  })
  if (qualifiedResult !== 'unknown' && existing?.qualified_set_by !== 'admin') {
    await setQualified(supabase, inquiryId, qualifiedResult, { kind: 'agent' })
  }

  console.log(`[inquiry-agent] classified inquiry ${inquiryId}`)
}
