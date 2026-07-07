/**
 * AI-powered trip detail extraction.
 *
 * Reads the full lead_messages conversation and uses Claude to extract
 * structured trip brief fields for the inquiry_trip_details table.
 *
 * Returns ExtractedTripDetails — caller decides whether to save.
 */

import Anthropic from '@anthropic-ai/sdk'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedTripDetails {
  summary:              string | null  // 2-3 sentence plain-English summary of what the angler wants
  target_species:       string | null  // e.g. "Atlantic Salmon, Sea Trout"
  date_flexibility:     'fixed' | 'flexible_1_2' | 'flexible_week' | 'very_flexible' | null
  price_range:          string | null  // e.g. "€500–€800/day"
  accommodation:        string | null  // e.g. "Not required" / "Cabin preferred"
  guide_notes:          string | null  // fishing experience, special requests, anything useful for guide
  confirmed_date:       string | null  // if a specific date or date range is mentioned
  confirmed_party_size: number | null  // if a specific group size is mentioned
}

export type ExtractionResult =
  | { success: true;  data: ExtractedTripDetails }
  | { success: false; error: string }

// ─── Conversation assembler ───────────────────────────────────────────────────

export interface ConversationMessage {
  direction:    'inbound' | 'outbound'
  channel:      string
  contact_name: string
  content:      string
  created_at:   string
}

export function assembleConversation(
  anglerName:     string,
  anglerMessage:  string | null,
  requestedDates: string[],
  partySize:      number,
  experienceTitle: string | null,
  messages:       ConversationMessage[],
): string {
  const lines: string[] = []

  lines.push('=== ORIGINAL INQUIRY ===')
  lines.push(`Angler: ${anglerName}`)
  if (experienceTitle) lines.push(`Experience requested: ${experienceTitle}`)
  if (requestedDates.length > 0) lines.push(`Requested dates: ${requestedDates.join(', ')}`)
  lines.push(`Party size: ${partySize}`)
  if (anglerMessage?.trim()) {
    lines.push(`Angler's message: "${anglerMessage.trim()}"`)
  }

  if (messages.length > 0) {
    lines.push('')
    lines.push('=== CONVERSATION HISTORY ===')
    for (const msg of messages) {
      const dateStr = new Date(msg.created_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
      const who = msg.direction === 'inbound'
        ? `[${dateStr}] ${msg.contact_name} (client):`
        : `[${dateStr}] FA (outbound via ${msg.channel}):`
      lines.push('')
      lines.push(who)
      lines.push(msg.content.trim())
    }
  }

  return lines.join('\n')
}

// ─── Core extraction ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an assistant for FjordAnglers — a curated guided fishing trips agency connecting Central European anglers with Nordic (Norwegian, Swedish, Icelandic) fishing guides.

Your task: extract structured trip details from an inquiry conversation. Return ONLY a valid JSON object matching this exact schema:

{
  "summary": string | null,
  "target_species": string | null,
  "date_flexibility": "fixed" | "flexible_1_2" | "flexible_week" | "very_flexible" | null,
  "price_range": string | null,
  "accommodation": string | null,
  "guide_notes": string | null,
  "confirmed_date": string | null,
  "confirmed_party_size": number | null
}

Field guidance:
- summary: 2-3 sentences in plain English summarising what the angler is looking for — who they are, what trip they want, any standout details. Written for a fishing guide to read at a glance. Null only if the inquiry contains no useful information at all.
- target_species: species the angler wants to catch, e.g. "Atlantic Salmon, Sea Trout". Null if not mentioned.
- date_flexibility: "fixed" = they need specific dates; "flexible_1_2" = ok with ±1-2 days; "flexible_week" = flexible within a week; "very_flexible" = just a month or season is fine. Null if unclear.
- price_range: budget mentioned, e.g. "€500–€800/day" or "€1500 total". Null if not mentioned.
- accommodation: e.g. "Not required", "Cabin preferred", "Included in price". Null if not mentioned.
- guide_notes: anything useful for the fishing guide — angler's experience level, special requests, preferred techniques, accessibility needs, etc. Summarize concisely. Null if nothing relevant.
- confirmed_date: the specific date or date range if clearly stated (human-readable, e.g. "12–15 Aug 2026"). Use the requested dates from the inquiry if no override is given in conversation. Null if very vague.
- confirmed_party_size: exact number if stated (integer). Null if not mentioned separately.

Return ONLY the JSON object. No explanation, no markdown fences, no extra text.`

export async function extractTripDetails(
  apiKey:       string,
  conversation: string,
): Promise<ExtractionResult> {
  const client = new Anthropic({ apiKey })

  let rawText: string
  try {
    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 512,
      system:     SYSTEM_PROMPT,
      messages: [
        {
          role:    'user',
          content: conversation,
        },
      ],
    })

    const block = message.content[0]
    if (block.type !== 'text') {
      return { success: false, error: 'Unexpected response type from Claude' }
    }
    rawText = block.text.trim()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Claude API error: ${msg}` }
  }

  // Parse JSON response
  try {
    // Strip markdown fences if Claude added them despite instructions
    const cleaned = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned) as Record<string, unknown>

    const data: ExtractedTripDetails = {
      summary:              typeof parsed.summary === 'string'               ? parsed.summary              : null,
      target_species:       typeof parsed.target_species === 'string'       ? parsed.target_species       : null,
      date_flexibility:     isValidDateFlex(parsed.date_flexibility)         ? parsed.date_flexibility     : null,
      price_range:          typeof parsed.price_range === 'string'           ? parsed.price_range          : null,
      accommodation:        typeof parsed.accommodation === 'string'         ? parsed.accommodation        : null,
      guide_notes:          typeof parsed.guide_notes === 'string'           ? parsed.guide_notes          : null,
      confirmed_date:       typeof parsed.confirmed_date === 'string'        ? parsed.confirmed_date       : null,
      confirmed_party_size: typeof parsed.confirmed_party_size === 'number'  ? Math.round(parsed.confirmed_party_size) : null,
    }

    return { success: true, data }
  } catch {
    return { success: false, error: `Failed to parse Claude response: ${rawText.slice(0, 200)}` }
  }
}

function isValidDateFlex(v: unknown): v is 'fixed' | 'flexible_1_2' | 'flexible_week' | 'very_flexible' {
  return v === 'fixed' || v === 'flexible_1_2' || v === 'flexible_week' || v === 'very_flexible'
}
