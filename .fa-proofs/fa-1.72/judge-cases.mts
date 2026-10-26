/**
 * FA-1.72 — judge behaviour on the new "is there a critical reason NOT to send?" prompt.
 * Real Anthropic call (Haiku), synthetic fixtures, 16 cases (1–9, 10a, 10b, 11–14, 16).
 *
 * Calls only judgeReply(conversation, draft, knowledge): no database, no email, no sending. The
 * verdict is then run through decideFromVerdict (pure, the same function autoSendReply uses), so
 * "got" below is the real send/hold decision: any client flag holds, and a block needs a quote
 * that is literally in the draft. "expect" is compared with that decision.
 * The conversation is built with the real assembleConversation, exactly as draftReply builds it,
 * so the judge sees the inquiry block (experience, requested dates, party size, text) like the
 * drafting agent does. Cases 10–14 reproduce the causes of the 2026-10-26 production read.
 *
 * The `instructions` entry below is fictional: it forbids declaring a guide's availability on a
 * specific day and giving a guide's phone / e-mail / profile, and it does NOT forbid naming the
 * guide (rule changed 2026-10-26; the real entry is corrected by tj in FA-1.73).
 *
 * Case 16 (tj request, 2026-10-26) uses the REAL production `instructions` text after tj's seven
 * edits (`instructions-prod-after-7-edits.md`, kept local — it is the prod entry, not committed),
 * to prove that the judge with the real instruction does not block naming the guide.
 *
 * Cases 9, 10b and 11 have two variants; every variant must come out as expected.
 * PROOF_RUNS=n repeats the whole set (default 1); the first run is the official result.
 *
 * Runs under vitest (gives the @/ alias). From the repo root:
 *   RESEND_DEV_FAKE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run \
 *     --config .fa-proofs/fa-1.72/vitest.config.mts | tee .fa-proofs/fa-1.72/proof.out.txt
 */

if (process.env.RESEND_DEV_FAKE !== '1') {
  console.error('STOP: set RESEND_DEV_FAKE=1 before running this proof script')
  process.exit(1)
}

import { it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { judgeReply } from '../../src/lib/ai/judge-reply.js'
import { decideFromVerdict } from '../../src/lib/ai/auto-send-guards.js'
import { assembleConversation } from '../../src/lib/ai/extract-trip.js'
import type { KnowledgeEntry } from '../../src/lib/ai/knowledge.js'

// ─── Fictional knowledge ──────────────────────────────────────────────────────

const INSTRUCTIONS: KnowledgeEntry = {
  id: 'p-inst', kind: 'instructions', country: null, guide_id: null, title: 'Instructions',
  body:
    'You write the reply to an angler on behalf of FjordAnglers. Warm, direct, no marketing jargon. ' +
    'Never promise a date and never state that a guide is available on a specific day: availability is confirmed by the founders after the angler replies. ' +
    'Never give a guide\'s phone number, e-mail address or profile link. ' +
    'You may name the guide and say where the guide works. ' +
    'Quote prices only as they appear in the destination entry. ' +
    'If the angler asks about an area we do not cover, say so plainly first; only then may you mention the nearest covered area. ' +
    'Do not ask again for party size or dates already given.',
}
const TONE: KnowledgeEntry = {
  id: 'p-tone', kind: 'tone', country: null, guide_id: null, title: 'Tone',
  body: 'Warm, direct, first person plural ("we"). Short paragraphs. No exclamation marks in series.',
}
const NZ: KnowledgeEntry = {
  id: 'p-nz', kind: 'destination', country: 'New Zealand', guide_id: null, title: 'New Zealand — pricing, rules, coverage',
  body:
    'Guided day on a South Island river: 1 440 NZD per day for up to two anglers, plus 60 NZD per day for the licence and fees. ' +
    'Guides work full days only (no half days). Season: November–April. ' +
    'We currently cover the Southland rivers. We have no guide in the Queenstown / Lakes area yet. ' +
    'The guide supplies rods, flies and lunch; guests bring polarised glasses, a wading jacket and a hat.',
}
const KRISTINA: KnowledgeEntry = {
  id: 'p-guide', kind: 'guide', country: null, guide_id: 'g-kristina', title: 'Guide Kristina',
  body: 'Kristina guides the Southland rivers. She works full days only.',
}

const REAL_INSTRUCTIONS: KnowledgeEntry = {
  id: 'p-inst-real', kind: 'instructions', country: null, guide_id: null, title: 'Instructions 26.09 (prod text after the 7 edits)',
  body: readFileSync(new URL('./instructions-prod-after-7-edits.md', import.meta.url), 'utf8').trimEnd(),
}

const WITH_DESTINATION = [INSTRUCTIONS, TONE, NZ, KRISTINA]
const NO_DESTINATION   = [INSTRUCTIONS, TONE]

// ─── Cases ────────────────────────────────────────────────────────────────────

interface Inquiry {
  message: string
  dates?: string[]
  party?: number
  trip?: string | null
}

interface Variant {
  label?: string
  inquiry: Inquiry
  draft: string
  knowledge?: KnowledgeEntry[]
}

interface Case {
  id: string
  title: string
  expectSend: boolean
  variants: Variant[]
}

const conversationOf = (q: Inquiry) =>
  assembleConversation('Anna Angler', q.message, q.dates ?? [], q.party ?? 2, q.trip ?? 'New Zealand fly fishing', [], null, 'web_form')

const PRICE_OK =
  'A guided day on a South Island river is 1 440 NZD for the two of you, plus 60 NZD per day for the licence and fees. ' +
  'Guides work full days only, so there are no half days.'

const CASES: Case[] = [
  {
    id: '1', title: 'NZ first inquiry, price per the knowledge base + question about dates', expectSend: true,
    variants: [{
      inquiry: { message: 'Hi, two of us would like to fish New Zealand rivers in February, one guided day. What does a day cost and which dates are available?' },
      draft: `Hi Anna, thanks for writing.\n\n${PRICE_OK}\n\nWhich dates in February suit you best? We will check what we can arrange once we hear back.\n\nWarm regards,\nFjordAnglers`,
    }],
  },
  {
    id: '2', title: 'Short, vague "is fishing good in March?" + draft without inventions, with a question back', expectSend: true,
    variants: [{
      inquiry: { message: 'Hi, is fishing good in March?', party: 1, trip: null },
      draft: 'Hi Anna, thanks for getting in touch.\n\nMarch falls inside our New Zealand season (November–April), so it is a good time to fish.\n\nTo point you in the right direction: how many of you would come, and have you fly-fished before?\n\nWarm regards,\nFjordAnglers',
    }],
  },
  {
    id: '3', title: 'Question outside the knowledge base, draft says "we will check and come back"', expectSend: true,
    variants: [{
      inquiry: { message: 'Do you also arrange a helicopter transfer to remote rivers? We would love a day away from the road.' },
      draft: 'Hi Anna, thanks for the question.\n\nWe will check with our guides whether a transfer like that is possible and come back to you.\n\nIn the meantime: which month are you planning for?\n\nWarm regards,\nFjordAnglers',
    }],
  },
  {
    id: '4', title: 'Draft price different from the knowledge base', expectSend: false,
    variants: [{
      inquiry: { message: 'Two of us want a guided day on a South Island river in February. What does it cost?' },
      draft: 'Hi Anna, a guided day on a South Island river is 1 100 NZD for the two of you, licence included. Which dates suit you in February?\n\nWarm regards,\nFjordAnglers',
    }],
  },
  {
    id: '5', title: 'Draft confirms the guide is available on a specific day', expectSend: false,
    variants: [{
      inquiry: { message: 'Two of us want a guided day on a South Island river in February. Anything around the 14th?' },
      draft: `Hi Anna, good news: our guide is free on 14 February, so we have you booked in for that day.\n\n${PRICE_OK}\n\nWarm regards,\nFjordAnglers`,
    }],
  },
  {
    id: '6', title: 'Client complains about a previous trip', expectSend: false,
    variants: [{
      inquiry: { message: 'Last year\'s trip with your agency was a disaster: the guide never showed up and nobody answered my refund request. I am still waiting. Now I want to book again, two people, February.' },
      draft: `Hi Anna, thanks for writing again.\n\n${PRICE_OK}\n\nWhich dates in February suit you?\n\nWarm regards,\nFjordAnglers`,
    }],
  },
  {
    id: '7', title: 'Client compares with a cheaper competitor', expectSend: false,
    variants: [{
      inquiry: { message: 'Another agency offers the same guided day on a South Island river for 1 200 NZD. Can you match that? Two people, February.' },
      draft: `Hi Anna, thanks for telling us.\n\n${PRICE_OK}\n\nWhich dates in February suit you?\n\nWarm regards,\nFjordAnglers`,
    }],
  },
  {
    id: '8', title: 'Client asks for the guide\'s phone number', expectSend: false,
    variants: [{
      inquiry: { message: 'Can you send me the guide\'s phone number? I would rather arrange the details with them directly.' },
      draft: 'Hi Anna, thanks for writing. We look after all arrangements ourselves, so everything runs through us. Which dates are you considering?\n\nWarm regards,\nFjordAnglers',
    }],
  },
  {
    id: '9', title: 'No destination entry: draft quotes a price → stop; same without a price, asking for details → send', expectSend: true,
    variants: [
      {
        label: '9a (price, expect send=false)',
        inquiry: { message: 'How much is a guided fishing day in New Zealand?' },
        draft: 'Hi Anna, a guided day in New Zealand is 1 440 NZD for two anglers, plus 60 NZD for the licence. Which month are you planning for?\n\nWarm regards,\nFjordAnglers',
        knowledge: NO_DESTINATION,
      },
      {
        label: '9b (no price, expect send=true)',
        inquiry: { message: 'Hi, we would like to fish in New Zealand in March. Can you tell us more?' },
        draft: 'Hi Anna, thanks for your interest.\n\nSo that we can point you well: how many of you would come, have you fly-fished before, and which part of the country appeals to you? We will come back to you with details.\n\nWarm regards,\nFjordAnglers',
        knowledge: NO_DESTINATION,
      },
    ],
  },
  {
    id: '10a', title: 'Draft names the guide and where she works, offers to CHECK a day', expectSend: true,
    variants: [{
      inquiry: { message: 'We would like to fish the Southland rivers, ideally on 12 September. Two of us.', dates: ['2026-09-12'] },
      draft: 'Hi Anna, thanks for writing.\n\nKristina guides the Southland rivers — we will check whether she is free on the 12th and come back to you.\n\nWarm regards,\nFjordAnglers',
    }],
  },
  {
    id: '10b', title: 'Draft states that the guide is free on the day', expectSend: false,
    variants: [
      {
        label: '10b-1 ("free on 12 September")',
        inquiry: { message: 'We would like to fish the Southland rivers, ideally on 12 September. Two of us.', dates: ['2026-09-12'] },
        draft: 'Hi Anna, thanks for writing.\n\nKristina guides the Southland rivers and is free on 12 September.\n\nWarm regards,\nFjordAnglers',
      },
      {
        label: '10b-2 ("the 12th works for her")',
        inquiry: { message: 'We would like to fish the Southland rivers, ideally on 12 September. Two of us.', dates: ['2026-09-12'] },
        draft: 'Hi Anna, thanks for writing.\n\nKristina guides the Southland rivers, and the 12th works for her.\n\nWarm regards,\nFjordAnglers',
      },
    ],
  },
  {
    id: '11', title: 'Client gave no dates; draft invents "those four dates" / a month → group 5', expectSend: false,
    variants: [
      {
        label: '11a ("those four dates")',
        inquiry: { message: 'Hi, we would like to fish the Southland rivers for a day sometime this season. Two of us.' },
        draft: 'Hi Anna, thanks for writing.\n\nThose four dates you mentioned are all possible options, and we will check what we can arrange.\n\nWarm regards,\nFjordAnglers',
      },
      {
        label: '11b (invented month)',
        inquiry: { message: 'Hi, we would like to fish the Southland rivers for a day sometime this season. Two of us.' },
        draft: 'Hi Anna, thanks for writing.\n\nJune is a lovely time on the Southland rivers, so we will plan your day for June and check what we can arrange.\n\nWarm regards,\nFjordAnglers',
      },
    ],
  },
  {
    id: '12', title: 'Client asks for Queenstown; draft proposes Southland with a price instead of stating the gap', expectSend: false,
    variants: [{
      inquiry: { message: 'We would like to fish near Queenstown in March, two of us. What would a guided day cost?' },
      draft: `Hi Anna, thanks for writing.\n\nWe would put you on the Southland rivers. ${PRICE_OK}\n\nWhich dates in March suit you?\n\nWarm regards,\nFjordAnglers`,
    }],
  },
  {
    id: '13', title: 'Price per the knowledge base and "full days only" per the guide entry', expectSend: true,
    variants: [{
      inquiry: { message: 'How much is a guided day with Kristina, and can we do just a morning? Two of us, Southland rivers, in March.' },
      draft: 'Hi Anna, thanks for writing.\n\nA guided day on the Southland rivers is 1 440 NZD for the two of you, plus 60 NZD per day for the licence and fees. Kristina works full days only, so a morning on its own is not possible.\n\nWhich dates in March suit you? We will check what we can arrange.\n\nWarm regards,\nFjordAnglers',
    }],
  },
  {
    id: '14', title: 'Form dates 17, 18, 19, 23 with text without dates; draft says "those four dates" → comes from the form, send', expectSend: true,
    variants: [{
      inquiry: {
        message: 'Hi, any chance for a guided day on one of those? We are two, happy to fish the Southland rivers.',
        dates: ['2027-02-17', '2027-02-18', '2027-02-19', '2027-02-23'],
      },
      draft: 'Hi Anna, thanks for writing.\n\nWe will check on which of those four dates a guide is free and come back to you.\n\nWarm regards,\nFjordAnglers',
    }],
  },
  {
    id: '16', title: 'REAL prod instructions after the 7 edits: draft names the guide, says she works the Southland rivers, offers to CHECK the 12th', expectSend: true,
    variants: [{
      inquiry: { message: 'We would like a guided day on the Southland rivers, ideally on 12 September. Two of us.', dates: ['2026-09-12'] },
      draft: `Hi Anna, thanks for writing.\n\nKristina guides the Southland rivers. ${PRICE_OK}\n\nWe will check whether she is free on the 12th and come back to you.\n\nWarm regards,\nFjordAnglers`,
      knowledge: [REAL_INSTRUCTIONS, TONE, NZ, KRISTINA],
    }],
  },
]

// ─── Run ──────────────────────────────────────────────────────────────────────

interface Row {
  run: number; id: string; variant: string; expect: boolean
  /** The judge's raw verdict. */
  score: number | null; judge_send: boolean | null; reasons: string[]
  client_flags: { complaint: boolean; competitor: boolean; guide_contact: boolean } | null
  evidence: { group: number; draft_quote: string; conflict: string }[]
  /** The decision autoSendReply would take (decideFromVerdict). */
  send: boolean | null
  decision_reasons: string[]
  blocked_without_evidence: boolean
  /** judgeReply threw (cut off, two objects, bad shape…): in production nothing is sent. Counted separately. */
  error: string | null
  ok: boolean
}

it('FA-1.72 proof — judge, 16 cases, real model', async () => {
  const runs = Number(process.env.PROOF_RUNS ?? '1')
  const rows: Row[] = []

  for (let run = 1; run <= runs; run++) {
    for (const c of CASES) {
      for (const v of c.variants) {
        const expect = v.label?.includes('expect send=false') ? false : v.label?.includes('expect send=true') ? true : c.expectSend
        const base = { run, id: c.id, variant: v.label ?? c.id, expect }
        let row: Row
        try {
          const r = await judgeReply(conversationOf(v.inquiry), v.draft, v.knowledge ?? WITH_DESTINATION)
          const d = decideFromVerdict(r, v.draft)
          row = {
            ...base, score: r.score, judge_send: r.send, reasons: r.reasons, client_flags: r.client_flags, evidence: r.evidence,
            send: d.send, decision_reasons: d.reasons, blocked_without_evidence: d.blockedWithoutEvidence, error: null, ok: d.send === expect,
          }
        } catch (err) {
          // An error means "no send" in autoSendReply. It is never a pass: it is a lost verdict.
          row = {
            ...base, score: null, judge_send: null, reasons: [], client_flags: null, evidence: [],
            send: null, decision_reasons: [], blocked_without_evidence: false,
            error: err instanceof Error ? err.message : String(err), ok: false,
          }
        }
        rows.push(row)
        console.log(`\n[run ${run}] case ${row.variant} — ${c.title}`)
        if (row.error != null) {
          console.log(`  expect send=${expect}  got ERROR (nothing would be sent) → LOST VERDICT`)
          console.log(`    ${row.error.slice(0, 600).replace(/\n/g, '\n    ')}`)
        } else {
          const raised = Object.entries(row.client_flags!).filter(([, on]) => on).map(([k]) => k)
          console.log(`  expect send=${expect}  got send=${row.send} (judge send=${row.judge_send}, score=${row.score}, flags=[${raised.join(',')}]` +
            `${row.blocked_without_evidence ? ', BLOCKED WITHOUT EVIDENCE' : ''})  → ${row.ok ? 'OK' : 'MISMATCH'}`)
          for (const reason of row.decision_reasons) console.log(`    - ${reason}`)
          for (const e of row.evidence) console.log(`    · evidence g${e.group}: "${e.draft_quote}" ⇒ ${e.conflict}`)
        }
      }
    }
  }

  writeFileSync('.fa-proofs/fa-1.72/proof.results.json', JSON.stringify(rows, null, 2))
  const wrong = rows.filter(r => r.error == null && !r.ok)
  const errors = rows.filter(r => r.error != null)
  const noEvidence = rows.filter(r => r.blocked_without_evidence)
  console.log(`\nSUMMARY: ${rows.length - wrong.length - errors.length}/${rows.length} as expected; wrong decisions: ${wrong.length}` +
    (wrong.length ? ` (${wrong.map(b => `run ${b.run} ${b.variant}`).join(', ')})` : '') +
    `; judge errors (lost verdicts): ${errors.length}` +
    (errors.length ? ` (${errors.map(b => `run ${b.run} ${b.variant}`).join(', ')})` : '') +
    `; blocked without evidence: ${noEvidence.length}` +
    (noEvidence.length ? ` (${noEvidence.map(b => `run ${b.run} ${b.variant}`).join(', ')})` : ''))
}, 600_000)
