/**
 * FA-1.73 — the drafter on the LOCAL stack, real model, fictitious inquiries, knowledge "as on prod".
 *
 * Calls only draftReply (Anthropic + local Supabase) and judgeReply (Anthropic). No e-mail, no
 * WhatsApp, no auto-send: autoSendReply and sendMessage are never imported.
 *
 * Knowledge:
 *   - instructions: the prod text after tj's seven FA-1.72 edits (the D1 change) —
 *     ../fa-1.72/instructions-prod-after-7-edits.md (gitignored, local only)
 *   - tone, Chile, Kristina, Alex: prod text, ./knowledge-prod/ (gitignored)
 *   - New Zealand destination: the PROPOSED text (D2 + O-48), ./knowledge-prod/nz-destination-proposed.md
 *   - Iceland destination: prod text with "or guide name" removed (the same D1 change)
 *   - Bergur and his entry: fictional (this file)
 *
 * Fixture rows: own uuids, tagged angler_email '@fa173.example.test' / title 'FA173-PROOF'.
 * The four seed knowledge rows are switched inactive for the run (one active `instructions` entry is
 * a unique index) and switched back on at the end. Nothing else of the seed is touched.
 *
 * STOP gate: without PROOF_URL_APPROVED=<exact Supabase URL> the script prints the URL it would use
 * and exits before any write or model call. The URL must be 127.0.0.1 or localhost.
 *
 * Run (from the repo root; the Supabase values below are the LOCAL stack's, never .env.local's):
 *   see .fa-proofs/fa-1.73/run.sh
 */

import { it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const URL_IN_USE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const HOST = (() => { try { return new URL(URL_IN_USE).hostname } catch { return '' } })()
const LOCAL = HOST === '127.0.0.1' || HOST === 'localhost'
const APPROVED = LOCAL && process.env.PROOF_URL_APPROVED === URL_IN_USE && process.env.RESEND_DEV_FAKE === '1'

const dir = (f: string) => new URL(f, import.meta.url)
const read = (f: string) => readFileSync(dir(f), 'utf8').trimEnd()

const SEED_KNOWLEDGE_IDS = [
  'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d101',
  'd2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d202',
  'd3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d303',
  'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d404',
]
const RUNS = Number(process.env.PROOF_RUNS ?? 3)
const ONLY = (process.env.PROOF_ONLY ?? '').split(',').filter(Boolean)

// ─── Fixtures ──────────────────────────────────────────────────────────────────

// Fixed uuids: a crashed run can be cleaned by the next one.
const id = {
  kristina:     'fa173001-0000-4000-8000-000000000001',
  alex:         'fa173001-0000-4000-8000-000000000002',
  bergur:       'fa173001-0000-4000-8000-000000000003',
  expNZ:        'fa173002-0000-4000-8000-000000000001',
  expSouthland: 'fa173002-0000-4000-8000-000000000002',
  expCL:        'fa173002-0000-4000-8000-000000000003',
  expIS:        'fa173002-0000-4000-8000-000000000004',
}

const BERGUR_ENTRY =
  '# Bergur — Iceland (fictional proof entry)\n\n' +
  'Guides day trips around the whole Reykjavík area and the south-west, and takes multi-day Highland trips in July and August. ' +
  'Works with one or two anglers. Guide-built offer: his own offer follows the brief.\n'

interface KnowledgeFixture { kind: string; country?: string; guideId?: string; title: string; body: string }

const KNOWLEDGE: KnowledgeFixture[] = [
  { kind: 'instructions', title: 'FA173-PROOF instructions', body: read('../fa-1.72/instructions-prod-after-7-edits.md') },
  { kind: 'tone', title: 'FA173-PROOF tone', body: read('./knowledge-prod/tone.md') },
  { kind: 'destination', country: 'New Zealand', title: 'FA173-PROOF NZ (proposed)', body: read('./knowledge-prod/nz-destination-proposed.md') },
  { kind: 'destination', country: 'Chile', title: 'FA173-PROOF Chile', body: read('./knowledge-prod/chile-destination.md') },
  { kind: 'destination', country: 'Iceland', title: 'FA173-PROOF Iceland (edited)', body: read('./knowledge-prod/iceland-destination-edited.md') },
  { kind: 'guide', guideId: id.kristina, title: 'FA173-PROOF Kristina', body: read('./knowledge-prod/kristina-guide.md') },
  { kind: 'guide', guideId: id.alex, title: 'FA173-PROOF Alex', body: read('./knowledge-prod/alex-prior-guide.md') },
  { kind: 'guide', guideId: id.bergur, title: 'FA173-PROOF Bergur', body: BERGUR_ENTRY },
]

// ─── Cases ─────────────────────────────────────────────────────────────────────

interface Case {
  n: number
  title: string
  expect: string
  judge: boolean
  country: string
  experience: string   // experience_pages key
  guide: keyof typeof id
  message: string
  dates?: string[]
  party?: number
  brief?: Record<string, unknown>
}

const CASES: Case[] = [
  { n: 1, judge: true, country: 'New Zealand', experience: 'expNZ', guide: 'kristina', party: 2,
    title: 'South Island, client in Queenstown, 1 day',
    expect: 'gap stated plainly + Southland ~1–1.5 h + price + question about the drive; no guide name',
    message: "Hi, my partner and I are staying in Queenstown for a week in March and would love one guided day of fly fishing. We'd be based in town. What can you offer and what does it cost?" },
  { n: 2, judge: true, country: 'New Zealand', experience: 'expNZ', guide: 'kristina', party: 3, dates: ['2027-03-03'],
    title: 'South Island, client in Kingston, asks for the 3rd',
    expect: 'Southland + price; may name the guide; "we\'ll check whether she\'s free on the 3rd", never "she is free"',
    message: "Hello, three of us are staying in Kingston and have a rental car. We'd like a guided day on the 3rd of March, is that possible? What would it cost?" },
  { n: 3, judge: false, country: 'New Zealand', experience: 'expNZ', guide: 'kristina', party: 2,
    title: 'South Island, no place given',
    expect: 'asks about the place; no regional price',
    message: "Hi, two of us are coming to New Zealand in March and would like a day of guided fly fishing. What do you offer and what does it cost?" },
  { n: 4, judge: false, country: 'New Zealand', experience: 'expNZ', guide: 'kristina', party: 2,
    title: 'South Island, client in Nelson',
    expect: '"we\'ll check what our available guides can offer in that area and come back to you"; no price, no Southland',
    message: "Hi, we're based in Nelson for two weeks in February and would like one guided day of fly fishing nearby. Can you help?" },
  { n: 5, judge: true, country: 'Chile', experience: 'expCL', guide: 'alex', party: 2,
    dates: ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'],
    title: 'Coyhaique, 10 dates from the form',
    expect: 'refers to the form\'s dates; no availability claim',
    message: "Hello, two of us would like a guided day around Coyhaique. Any of the dates I listed would work for us. What would it cost?" },
  { n: 6, judge: true, country: 'Iceland', experience: 'expIS', guide: 'bergur', party: 2,
    title: 'Iceland, trip "Highland … with Bergur", client names no region',
    expect: 'general answer about Iceland / the guide\'s area; Highlands at most one option; asks about preferences; does NOT assume the Highlands',
    message: 'Hi, we want 2 days of fishing in Iceland in July. Two anglers.' },
  { n: 7, judge: true, country: 'Iceland', experience: 'expIS', guide: 'bergur', party: 2,
    title: 'Same trip, client: "we\'re interested in the Highlands"',
    expect: 'draft about the Highlands (title matches the client)',
    message: "Hi, we're interested in the Highlands. 2 days in July, two anglers." },
  { n: 8, judge: true, country: 'New Zealand', experience: 'expSouthland', guide: 'kristina', party: 2,
    brief: { dates_mode: 'flexible', flex_month: '2027-03', days: 1, anglers: 2, non_anglers: 0, skill_level: 4, priority: 'action', fitness: 'medium', wading_ok: true, budget_ack: true },
    title: 'Form gives party size + skill level, client asks a general question',
    expect: 'does not re-ask party size or skill level',
    message: 'What does a guided day usually include?' },
]

// ─── Run ───────────────────────────────────────────────────────────────────────

const out: string[] = []
const results: unknown[] = []
function log(s = '') { console.log(s); out.push(s) }

type Svc = ReturnType<typeof import('../../src/lib/supabase/server.js').createServiceClient>
async function cleanup(svc: Svc) {
  const { data: inqs } = await svc.from('inquiries').select('id').like('angler_email', '%@fa173.example.test')
  const ids = (inqs ?? []).map(r => r.id as string)
  if (ids.length > 0) {
    await svc.from('messages').delete().in('inquiry_id', ids)
    await svc.from('inquiry_events').delete().in('inquiry_id', ids)
    await svc.from('inquiries').delete().in('id', ids)
  }
  await svc.from('agent_knowledge').delete().like('title', 'FA173-PROOF%')
  await svc.from('experience_pages').delete().in('id', Object.values(id).filter(v => v.startsWith('fa173002')))
  await svc.from('guides').delete().in('id', Object.values(id).filter(v => v.startsWith('fa173001')))
  await svc.from('agent_knowledge').update({ active: true }).in('id', SEED_KNOWLEDGE_IDS)
}

it('FA-1.73 draft cases', async () => {
  if (!LOCAL) throw new Error(`STOP: Supabase URL is "${URL_IN_USE}" — not 127.0.0.1 / localhost. Nothing was written.`)
  if (!APPROVED) {
    console.log(`STOP GATE: the proof would write fixtures to, and call draftReply against: ${URL_IN_USE}`)
    console.log('Re-run with PROOF_URL_APPROVED=<exactly that URL> and RESEND_DEV_FAKE=1 after tj approves. Nothing was written, no model was called.')
    return
  }
  const { createServiceClient } = await import('../../src/lib/supabase/server.js')
  const { draftReply } = await import('../../src/lib/ai/draft-reply.js')
  const { judgeReply } = await import('../../src/lib/ai/judge-reply.js')
  const { decideFromVerdict } = await import('../../src/lib/ai/auto-send-guards.js')
  const { composeBriefMessage } = await import('../../src/lib/inquiries/brief.js')

  const svc = createServiceClient()
  await cleanup(svc)

  // seed knowledge off for the run
  await svc.from('agent_knowledge').update({ active: false }).in('id', SEED_KNOWLEDGE_IDS)

  try {
    for (const [key, name, country] of [['kristina', 'Kristina', 'New Zealand'], ['alex', 'Alex', 'Chile'], ['bergur', 'Bergur', 'Iceland']] as const) {
      const { error } = await svc.from('guides').insert({ id: id[key], full_name: name, country })
      if (error) throw new Error(`guide ${key}: ${error.message}`)
    }

    const exps: [string, string, string, string][] = [
      ['expNZ', 'South Island Day', 'fa173-proof-nz', 'New Zealand'],
      ['expSouthland', 'Southland Rivers Day', 'fa173-proof-southland', 'New Zealand'],
      ['expCL', 'Coyhaique Spring Creeks Day', 'fa173-proof-cl', 'Chile'],
      ['expIS', 'Highland Adventure with Bergur', 'fa173-proof-is', 'Iceland'],
    ]
    for (const [key, name, slug, country] of exps) {
      const { error } = await svc.from('experience_pages').insert({ id: id[key as keyof typeof id], experience_name: name, slug, country })
      if (error) throw new Error(`experience ${key}: ${error.message}`)
    }

    for (const k of KNOWLEDGE) {
      const { error } = await svc.from('agent_knowledge').insert({
        kind: k.kind, country: k.country ?? null, guide_id: k.guideId ?? null, title: k.title, body: k.body, active: true,
      })
      if (error) throw new Error(`knowledge ${k.title}: ${error.message}`)
    }

    log(`FA-1.73 proof · Supabase ${URL_IN_USE} · runs per case ${RUNS} · ${new Date().toISOString()}`)

    for (const c of CASES) {
      if (ONLY.length > 0 && !ONLY.includes(String(c.n))) continue
      log('')
      log('═'.repeat(100))
      log(`CASE ${c.n} — ${c.title}`)
      log(`EXPECT: ${c.expect}`)
      log(`CLIENT: ${c.message}`)
      for (let run = 1; run <= RUNS; run++) {
        const message = c.brief ? composeBriefMessage(c.message, c.brief as never) : c.message
        const inquiryId = randomUUID()
        const { error } = await svc.from('inquiries').insert({
          id: inquiryId,
          angler_name: 'Anna Proof',
          angler_email: `case${c.n}-run${run}@fa173.example.test`,
          message,
          requested_dates: c.dates ?? [],
          party_size: c.party ?? 2,
          trip_country: c.country,
          assigned_guide_id: id[c.guide],
          experience_page_id: id[c.experience as keyof typeof id],
          status: 'new',
          source: 'web_form',
          brief: (c.brief ?? null) as never,
        })
        if (error) throw new Error(`inquiry case ${c.n}: ${error.message}`)

        const draft = await draftReply({ inquiryId, counterpart: 'angler', channel: 'email', allowFormOnly: true })
        let verdict = ''
        let send: boolean | null = null
        if (c.judge) {
          const judged = await judgeReply(draft.conversation, draft.text, draft.usedEntries)
          const decision = decideFromVerdict(judged, draft.text)
          send = decision.send
          verdict = `JUDGE send=${decision.send} score=${judged.score} reasons=${JSON.stringify(decision.reasons ?? judged.reasons ?? [])}`
        }
        log('')
        log(`── case ${c.n} · run ${run}/${RUNS}${send === null ? '' : ` · judge send=${send}`}`)
        log(draft.text)
        if (verdict) log(`   ${verdict}`)
        results.push({ case: c.n, run, send, draft: draft.text })
      }
    }
  } finally {
    await cleanup(svc)
    log('')
    log('cleanup done: fixture rows deleted, seed knowledge rows re-activated')
    writeFileSync(dir('./proof.out.txt'), out.join('\n') + '\n')
    writeFileSync(dir('./proof.results.json'), JSON.stringify(results, null, 2) + '\n')
  }
}, 3_600_000)
