/**
 * Judge for the hybrid auto-send pipeline. FA-1.27.
 *
 * judgeReply(conversation, draftText)
 *   Sends the conversation thread + draft + "never auto" rules to Haiku.
 *   Returns { score (0–1), send (bool), reasons (string[]) }.
 *   Caller decides whether to send based on JUDGE_THRESHOLD.
 *
 * SERVER-ONLY. Caller: src/lib/ai/auto-send.ts.
 */

import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'

export const JUDGE_THRESHOLD = 0.9

export interface JudgeResult {
  score:   number    // 0.0–1.0
  send:    boolean   // false if any "never auto" condition detected
  reasons: string[]  // why score/send is what it is
}

const JUDGE_PROMPT = `\
You are a quality judge for a fishing-trip agency's (FjordAnglers) auto-reply system.
You will receive a conversation thread and a draft reply the AI has prepared.

Your task: decide whether the draft is safe to send automatically.

Return ONLY valid JSON — no other text, no markdown fences:
{"score": 0.0, "send": false, "reasons": ["reason"]}

RULES — set "send" to false (regardless of score) when ANY of these apply:
- The message contains a complaint, accusation or negative sentiment toward the agency
- The message compares FjordAnglers with a competitor
- The message asks for a guide's direct contact, phone or email
- Something has gone wrong (booking issue, refund, error, overcharge)
- The angler's question cannot be answered from the knowledge provided in the draft
- The message is vague, unclear or doesn't fit any known stage of the booking process
- The draft breaks any rules from the instructions (e.g. asks again for party size already given, promises dates that may not be available, speculates about guide availability)
- The draft proposes something that needs admin review before committing (pricing, exceptions, custom terms)
- The draft addresses the wrong person or makes a factual claim that could be wrong

Score (0.0–1.0) = your confidence that the draft is accurate, appropriate and complete.
Threshold for auto-send is 0.9 — be strict; when in doubt, score below the threshold.
`

export async function judgeReply(conversation: string, draftText: string): Promise<JudgeResult> {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('[judgeReply] ANTHROPIC_API_KEY not set')

  const client = new Anthropic({ apiKey })

  const userContent = [
    JUDGE_PROMPT,
    '',
    '=== CONVERSATION ===',
    conversation,
    '',
    '=== DRAFT REPLY ===',
    draftText,
  ].join('\n')

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 256,
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
