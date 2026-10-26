/**
 * Judge for the hybrid auto-send pipeline. FA-1.27 / FA-1.72.
 *
 * judgeReply(conversation, draftText, knowledge?)
 *   Sends the conversation the draft was written from + the draft + the STOP rules to Haiku.
 *   `conversation` is the text draftReply built its prompt from (inquiry block + history), so the
 *   judge reads exactly what the drafting agent read. When `knowledge` is given (the entries the
 *   draft was built from, FA-1.47) they go in as the source of truth for prices, guide rules and
 *   instructions.
 *   Returns { score (0–1), send (bool), reasons (string[]) }.
 *
 *   The question is "is there a critical reason NOT to send?": the default is send=true, and
 *   send=false only for one of five STOP groups. `score` is information for statistics — the
 *   caller sends on `send` alone. A reply that cannot be parsed (e.g. cut off) throws; the caller
 *   treats that as "do not send".
 *
 * SERVER-ONLY. Caller: src/lib/ai/auto-send.ts.
 */

import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import type { KnowledgeEntry } from './knowledge'

export interface JudgeResult {
  score:   number    // 0.0–1.0, information only — never a gate
  send:    boolean   // false only when a STOP group applies
  reasons: string[]  // at most 3, short; with send=false each names its STOP group
}

const JUDGE_PROMPT = `\
You are the safety check of a fishing-trip agency's (FjordAnglers) auto-reply system.
You receive the conversation with an angler and a draft reply that the drafting AI has prepared.
The draft is sent to the angler automatically unless you stop it, and a sent e-mail cannot be taken back.

Default verdict: send. Set "send" to false ONLY when one of the five STOP groups below clearly applies. An imperfect draft is still sent.

The CONVERSATION section holds the angler's original inquiry (the form: experience, requested dates, party size, the angler's own words and answers) followed by the message history. Dates, places and numbers in the inquiry block were given by the angler.

STOP GROUP 1 — complaint or problem: the angler complains, accuses or is negative toward the agency, or reports that something went wrong (booking problem, refund, overpayment, error).
STOP GROUP 2 — competitor: the angler compares FjordAnglers with a competitor or another offer.
STOP GROUP 3 — guide contact: the angler asks for a guide's direct contact (phone, e-mail, profile).
STOP GROUP 4 — draft contradicts the knowledge: the draft states a price or condition different from the knowledge base, or makes a concrete commitment the knowledge base does not support (a price, a date, availability of a guide on a specific day, non-standard terms), or breaks a prohibition in the Instructions entry on promises, availability, dates, prices, contact details or coverage gaps (for example working around a gap in coverage instead of saying it plainly). Asking or promising to check ("we will check whether a guide is free") is fine; stating that a guide IS free, or that a date IS available or confirmed, is a commitment. If there is no KNOWLEDGE BASE section, treat every price, condition and commitment in the draft as outside the knowledge base.
STOP GROUP 5 — draft misrepresents the conversation: the draft states dates, a month, a place or a number of people that appear neither in the inquiry block nor in the message history, or contradicts an earlier FA message in the history (a different price, withdrawing a promise). Repeating or summarising what the angler wrote is fine; adding to it is not.

These are NOT reasons to stop — send:
- the angler's message is short, vague or unclear, or the draft answers it by asking a question back;
- the angler asks something the knowledge base does not answer, and the draft does not invent an answer (for example "we will check with our guides and come back to you");
- the draft quotes a price or condition that matches the knowledge base — it is verified, no admin review needed;
- the draft names a guide or says where a guide works;
- the draft asks again for something already given, or slips on style, tone, length or greeting, even where the Instructions entry asks for better;
- the angler says they will get back later, or the message needs no real answer;
- general politeness and pleasantries.

Return ONLY valid JSON — no other text, no markdown fences:
{"score": 0.0, "send": true, "reasons": ["short reason"]}

"reasons": at most 3 reasons, each under 20 words. When "send" is false, each reason starts with the STOP group it falls under, for example "STOP GROUP 4: quotes 900 NZD, the knowledge base says 1 440 NZD". When "send" is true, one short line is enough.
Score (0.0–1.0): your overall rating of how accurate and appropriate the draft is, for statistics only. It does not affect sending: "send" alone decides, and a low score with "send": true is allowed.
`

// Added to the input only when knowledge is passed (FA-1.47); written for STOP group 4 (FA-1.72).
const KNOWLEDGE_RULE = `\
KNOWLEDGE BASE RULE: the entries in the KNOWLEDGE BASE section below are exactly what the drafting agent was given. They are the source of truth for prices, guide rules and instructions.
- A price, condition or fact in the draft that is consistent with the knowledge base is verified. Do not stop the draft for it and do not ask for admin review of it.
- Set "send" to false (STOP GROUP 4) when the draft contradicts the knowledge base, states a price or condition that is not in the knowledge base, makes a concrete commitment the knowledge base does not support, or breaks a prohibition in the Instructions entry on promises, availability, dates, prices, contact details or coverage gaps.
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
    max_tokens: 512,
    messages:   [{ role: 'user', content: userContent }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('[judgeReply] Unexpected response type')

  let parsed: unknown
  try {
    // Strip markdown code fences if the model added them despite the prompt instruction
    const text = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`[judgeReply] Could not parse judge response: ${block.text}`)
  }

  const p = parsed as Record<string, unknown>
  if (typeof p.score !== 'number' || typeof p.send !== 'boolean' || !Array.isArray(p.reasons)) {
    throw new Error(`[judgeReply] Malformed judge response: ${block.text}`)
  }

  return {
    score:   Math.min(1, Math.max(0, p.score)),
    send:    p.send,
    reasons: (p.reasons as unknown[]).map(r => String(r)),
  }
}
