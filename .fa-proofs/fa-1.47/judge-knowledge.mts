/**
 * FA-1.47 — judge behaviour with knowledge, real Anthropic call (Haiku), synthetic fixtures.
 *
 * Calls only judgeReply(conversation, draft, knowledge): no database, no email, no sending.
 * Case modelled on production inquiry 2640acd6 (NZ, 4 Oct 2026): price entry 1 440 NZD + 60 NZD,
 * guide works full days only. Three drafts, each judged once:
 *   1 consistent with the entry   → expect score >= 0.9
 *   2 contradicting the entry     → expect score < 0.9 or send=false
 *   3 promise outside the entry   → expect score < 0.9 or send=false
 *
 * Runs under vitest (gives the @/ alias). From the repo root:
 *   RESEND_DEV_FAKE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run \
 *     --config .fa-proofs/fa-1.47/vitest.config.mts | tee .fa-proofs/fa-1.47/proof.out.txt
 */

if (process.env.RESEND_DEV_FAKE !== '1') {
  console.error('STOP: set RESEND_DEV_FAKE=1 before running this proof script')
  process.exit(1)
}

import { it } from 'vitest'
import { judgeReply, JUDGE_THRESHOLD } from '../../src/lib/ai/judge-reply.js'
import type { KnowledgeEntry } from '../../src/lib/ai/knowledge.js'

const CONVERSATION =
  '[ANGLER] Hi! Two of us would like to fly-fish in New Zealand in the second half of February, ' +
  'one guided day on a South Island river. We have fished for trout at home in Poland. ' +
  'What would a day cost and what do we need to bring?'

const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'proof-inst', kind: 'instructions', country: null, guide_id: null, title: 'Instructions',
    body:
      'You write the first reply to an angler on behalf of FjordAnglers. Warm, direct, no marketing jargon. ' +
      'Never promise availability of a specific day or guide: availability is confirmed by the founders after the angler replies. ' +
      'Quote prices only as they appear in the destination entry. Do not ask again for party size or dates already given.',
  },
  {
    id: 'proof-tone', kind: 'tone', country: null, guide_id: null, title: 'Tone',
    body: 'Warm, direct, first person plural ("we"). Short paragraphs. No exclamation marks in series.',
  },
  {
    id: 'proof-nz', kind: 'destination', country: 'New Zealand', guide_id: null, title: 'New Zealand — pricing and rules',
    body:
      'Guided day on a South Island river: 1 440 NZD per day for up to two anglers, plus 60 NZD per day for the licence and fees. ' +
      'The guide works full days only (no half days). Season: November–April. ' +
      'Bring polarised glasses, a wading jacket and a hat; the guide supplies rods, flies and lunch.',
  },
]

const DRAFTS = [
  {
    label: '1 consistent with the entry',
    expect: 'score >= 0.9',
    text:
      'Hi, thanks for writing. A guided day on a South Island river is 1 440 NZD for the two of you, ' +
      'plus 60 NZD for the licence and fees. The guide works full days only, so there are no half days. ' +
      'Bring polarised glasses, a wading jacket and a hat; the guide supplies rods, flies and lunch. ' +
      'Which dates in the second half of February suit you best? We will check availability once we hear back.',
  },
  {
    label: '2 contradicting the entry',
    expect: 'score < 0.9 or send=false',
    text:
      'Hi, thanks for writing. A guided day on a South Island river is 900 NZD for the two of you, licence included, ' +
      'and the guide is happy to do a half day if you prefer. ' +
      'Bring polarised glasses, a wading jacket and a hat; the guide supplies rods, flies and lunch. ' +
      'Which dates in the second half of February suit you best?',
  },
  {
    label: '3 promise outside the knowledge',
    expect: 'score < 0.9 or send=false',
    text:
      'Hi, thanks for writing. A guided day on a South Island river is 1 440 NZD for the two of you, ' +
      'plus 60 NZD for the licence and fees. Good news: the guide is free on 18 February, so we have you booked in for that day. ' +
      'Bring polarised glasses, a wading jacket and a hat; the guide supplies rods, flies and lunch.',
  },
]

it('FA-1.47 proof — judge with knowledge', async () => {
  console.log(`JUDGE_THRESHOLD = ${JUDGE_THRESHOLD}`)
  for (const d of DRAFTS) {
    const r = await judgeReply(CONVERSATION, d.text, KNOWLEDGE)
    const sent = r.score >= JUDGE_THRESHOLD && r.send
    console.log(`\n=== Draft ${d.label} (expect: ${d.expect}) ===`)
    console.log(`score=${r.score} send=${r.send} → would auto-send: ${sent}`)
    for (const reason of r.reasons) console.log(`  - ${reason}`)
  }
})
