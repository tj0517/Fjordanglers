/**
 * Judge for the hybrid auto-send pipeline. FA-1.27 / FA-1.72.
 *
 * judgeReply(conversation, draftText, knowledge?)
 *   Sends the conversation the draft was written from + the draft + the STOP rules to Haiku.
 *   `conversation` is the text draftReply built its prompt from (inquiry block + history), so the
 *   judge reads exactly what the drafting agent read. When `knowledge` is given (the entries the
 *   draft was built from, FA-1.47) they go in as the source of truth for prices, guide rules and
 *   instructions.
 *   Returns { client_flags, score (0–1), send (bool), reasons (string[]), evidence }.
 *
 *   The question is "is there a critical reason NOT to send?" and it is split in two:
 *   - client_flags — STOP groups 1–3 (complaint / competitor / guide contact), read from what the
 *     ANGLER wrote, without judging the draft. The caller (autoSendReply) holds the draft when any
 *     flag is true, whatever `send` says.
 *   - send — the default is true; false only for STOP groups 4–5 (the draft contradicts the
 *     knowledge / misrepresents the conversation). A block carries `evidence`: a literal quote of
 *     the draft per reason, which the caller checks against the draft text.
 *   `score` is information for statistics — never a gate.
 *
 *   The reply must be ONE JSON object with a well-shaped `client_flags`. Anything else — cut off,
 *   two objects, text outside the JSON, missing or misshapen flags — throws, and the caller treats
 *   a throw as "do not send". The parser never picks "the last object".
 *
 * SERVER-ONLY. Caller: src/lib/ai/auto-send.ts.
 */

import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import type { KnowledgeEntry } from './knowledge'

export interface JudgeResult {
  /** What the angler wrote — STOP groups 1–3. Any true flag holds the draft (decided in code). */
  client_flags: { complaint: boolean; competitor: boolean; guide_contact: boolean }
  score:        number    // 0.0–1.0, information only — never a gate
  send:         boolean   // false only when STOP group 4 or 5 applies
  reasons:      string[]  // at most 3, short; with send=false each names its STOP group
  /** One entry per block reason: a literal quote of the draft and what it conflicts with. */
  evidence:     { group: 4 | 5; draft_quote: string; conflict: string }[]
}

const JUDGE_PROMPT = `\
You are the safety check of a fishing-trip agency's (FjordAnglers) auto-reply system.
You receive the conversation with an angler and a draft reply that the drafting AI has prepared.
The draft is sent to the angler automatically unless it is stopped, and a sent e-mail cannot be taken back.

The CONVERSATION section holds the angler's original inquiry (the form: experience, requested dates, party size, the angler's own words and answers) followed by the message history. Dates, places and numbers in the inquiry block were given by the angler.

You answer in two parts, in this order.

PART 1 — CLIENT FLAGS. Read only what the angler wrote (the inquiry block and the angler's own messages in the history). Do not look at the draft for this part, and do not weigh how well the draft handles anything. Set each flag to true or false:
- "complaint": the angler complains, accuses or is negative toward the agency, or reports that something went wrong (booking problem, refund, overpayment, error).
- "competitor": the angler compares FjordAnglers with a competitor or another offer.
- "guide_contact": the angler asks for a guide's direct contact (phone, e-mail, profile).
The flags describe the angler only. The flags have no effect on "send": decide "send" from Part 2 alone.

PART 2 — THE DRAFT. Default verdict: send. Set "send" to false ONLY when STOP GROUP 4 or STOP GROUP 5 clearly applies. An imperfect draft is still sent.

STOP GROUP 4 — draft contradicts the knowledge: the draft states a price or condition different from the knowledge base, or makes a concrete commitment the knowledge base does not support (a price, a date, availability of a guide on a specific day, non-standard terms), or breaks a prohibition in the Instructions entry on promises, availability, dates, prices, contact details or coverage gaps (for example working around a gap in coverage instead of saying it plainly). Asking or promising to check ("we will check whether a guide is free") is fine; stating that a guide IS free, or that a date IS available or confirmed, is a commitment. A price or other amount in the draft counts as verified ONLY when the same amount appears literally in an entry of the KNOWLEDGE BASE section. When no entry contains it (for example there is no entry for the angler's country, or there is no KNOWLEDGE BASE section at all), every price in the draft is outside the knowledge base: STOP GROUP 4.
STOP GROUP 5 — draft misrepresents the conversation: the draft states dates, a month, a place or a number of people that appear neither in the inquiry block nor in the message history, or contradicts an earlier FA message in the history (a different price, withdrawing a promise). Repeating or summarising what the angler wrote is fine; adding to it is not.

These are NOT reasons to stop — send:
- the angler's message is short, vague or unclear, or the draft answers it by asking a question back;
- the angler asks something the knowledge base does not answer, and the draft does not invent an answer (for example "we will check with our guides and come back to you");
- the draft quotes a price or condition that appears in the KNOWLEDGE BASE with the same amount or wording — it is verified, no admin review needed;
- the draft names a guide or says where a guide works;
- the draft asks again for something already given, or slips on style, tone, length or greeting, even where the Instructions entry asks for better;
- the angler says they will get back later, or the message needs no real answer;
- general politeness and pleasantries.

A block needs evidence. When "send" is false, every reason must be backed by a sentence of the draft: quote it copied character for character from the DRAFT REPLY section, and say what it conflicts with. If you cannot quote a sentence of the draft that shows the problem, there is no block: set "send" to true.

Return ONLY one valid JSON object — no text before or after it, no second object, no markdown fences:
{"client_flags": {"complaint": false, "competitor": false, "guide_contact": false}, "score": 0.0, "send": true, "reasons": ["short reason"], "evidence": []}

"reasons": at most 3 reasons, each under 20 words. When "send" is false, each reason starts with the STOP group it falls under, for example "STOP GROUP 4: quotes a price that differs from the knowledge base". When "send" is true, one short line is enough.
"evidence": [] when "send" is true. When "send" is false, one entry per reason: {"group": 4 or 5, "draft_quote": "<sentence copied character for character from the DRAFT REPLY>", "conflict": "<what the knowledge base or the conversation says instead, or what is missing; under 25 words>"}.
Score (0.0–1.0): your overall rating of how accurate and appropriate the draft is, for statistics only. It does not affect sending: "send" and the flags alone decide, and a low score with "send": true is allowed.
`

// Added to the input only when knowledge is passed (FA-1.47); written for STOP group 4 (FA-1.72).
const KNOWLEDGE_RULE = `\
KNOWLEDGE BASE RULE: the entries in the KNOWLEDGE BASE section below are exactly what the drafting agent was given. They are the source of truth for prices, guide rules and instructions.
- A condition or fact in the draft that is consistent with the knowledge base is verified. So is a price, but only when the same amount appears literally in a KNOWLEDGE BASE entry. Do not stop the draft for what is verified and do not ask for admin review of it.
- Set "send" to false (STOP GROUP 4) when the draft contradicts the knowledge base, states a price or condition that is not in the knowledge base (any price at all when no entry lists one), makes a concrete commitment the knowledge base does not support, or breaks a prohibition in the Instructions entry on promises, availability, dates, prices, contact details or coverage gaps.
- A question the knowledge base cannot answer is not a reason to stop. Only a draft that invents the answer is.
`

function formatKnowledge(entries: KnowledgeEntry[]): string {
  return entries.map(entry => {
    const label =
      entry.kind === 'instructions' ? 'Instructions' :
      entry.kind === 'guide'        ? `Guide (${entry.guide_id ?? 'unknown'})` :
      entry.kind === 'destination'  ? `Destination: ${entry.country ?? 'unknown'}` :
      'Tone'
    return `--- ${label} (${entry.title}) ---\n${entry.body}`
  }).join('\n\n')
}

export async function judgeReply(
  conversation: string,
  draftText:    string,
  knowledge:    KnowledgeEntry[] = [],
): Promise<JudgeResult> {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('[judgeReply] ANTHROPIC_API_KEY not set')

  const client = new Anthropic({ apiKey })

  const knowledgeSection = knowledge.length === 0 ? [] : [
    KNOWLEDGE_RULE,
    '=== KNOWLEDGE BASE (source of truth) ===',
    formatKnowledge(knowledge),
    '',
  ]

  const userContent = [
    JUDGE_PROMPT,
    '',
    ...knowledgeSection,
    '=== CONVERSATION ===',
    conversation,
    '',
    '=== DRAFT REPLY ===',
    draftText,
  ].join('\n')

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages:   [{ role: 'user', content: userContent }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('[judgeReply] Unexpected response type')

  let parsed: unknown
  try {
    // One JSON object, optionally inside a markdown fence. Two objects or any text outside the
    // JSON do not parse — a model that contradicts itself is not asked which answer it meant.
    const text = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`[judgeReply] Could not parse judge response: ${block.text}`)
  }

  const malformed = () => new Error(`[judgeReply] Malformed judge response: ${block.text}`)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw malformed()

  const p = parsed as Record<string, unknown>
  const clientFlags = parseClientFlags(p.client_flags)
  const evidence    = parseEvidence(p.evidence)
  if (
    clientFlags == null || evidence == null ||
    typeof p.score !== 'number' || typeof p.send !== 'boolean' || !Array.isArray(p.reasons)
  ) {
    throw malformed()
  }

  return {
    client_flags: clientFlags,
    score:        Math.min(1, Math.max(0, p.score)),
    send:         p.send,
    reasons:      (p.reasons as unknown[]).map(r => String(r)),
    evidence,
  }
}

/** Exactly three booleans, or null. A missing or misshapen `client_flags` is an error, never "no flags". */
function parseClientFlags(value: unknown): JudgeResult['client_flags'] | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (typeof v.complaint !== 'boolean' || typeof v.competitor !== 'boolean' || typeof v.guide_contact !== 'boolean') return null
  return { complaint: v.complaint, competitor: v.competitor, guide_contact: v.guide_contact }
}

/** Absent → no evidence (the caller decides what a block without it means); present → well shaped, or null. */
function parseEvidence(value: unknown): JudgeResult['evidence'] | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  const entries: JudgeResult['evidence'] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null
    const e = item as Record<string, unknown>
    if ((e.group !== 4 && e.group !== 5) || typeof e.draft_quote !== 'string' || typeof e.conflict !== 'string') return null
    entries.push({ group: e.group, draft_quote: e.draft_quote, conflict: e.conflict })
  }
  return entries
}
