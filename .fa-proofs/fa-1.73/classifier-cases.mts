/**
 * FA-1.73 — the qualifier (src/lib/ai/inquiry-agent.ts) on the 8 case inputs, with the OLD label
 * ("Experience requested: …", main's inquiry-agent + extract-trip) and the NEW one (the branch).
 * Real Anthropic calls; the database is stubbed (no Supabase call, no write). The classification is read
 * from the console line classifyInquiry itself logs.
 * Run: .fa-proofs/fa-1.73/run-classifier.sh   (recreates ./old/ from origin/main first)
 */
import { it, vi } from 'vitest'
import { writeFileSync } from 'node:fs'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: {}, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}))
vi.mock('@/lib/inquiries/qualified', async orig => ({
  ...(await orig<typeof import('../../src/lib/inquiries/qualified.js')>()),
  setQualified: async () => undefined,
}))

import { composeBriefMessage } from '../../src/lib/inquiries/brief.js'

const RUNS = Number(process.env.PROOF_RUNS ?? 3)
const BRIEF = { dates_mode: 'flexible', flex_month: '2027-03', days: 1, anglers: 2, non_anglers: 0, skill_level: 4, priority: 'action', fitness: 'medium', wading_ok: true, budget_ack: true }

const CASES = [
  { n: 1, trip: 'South Island Day', party: 2, dates: [] as string[], message: "Hi, my partner and I are staying in Queenstown for a week in March and would love one guided day of fly fishing. We'd be based in town. What can you offer and what does it cost?" },
  { n: 2, trip: 'South Island Day', party: 3, dates: ['2027-03-03'], message: "Hello, three of us are staying in Kingston and have a rental car. We'd like a guided day on the 3rd of March, is that possible? What would it cost?" },
  { n: 3, trip: 'South Island Day', party: 2, dates: [], message: 'Hi, two of us are coming to New Zealand in March and would like a day of guided fly fishing. What do you offer and what does it cost?' },
  { n: 4, trip: 'South Island Day', party: 2, dates: [], message: "Hi, we're based in Nelson for two weeks in February and would like one guided day of fly fishing nearby. Can you help?" },
  { n: 5, trip: 'Coyhaique Spring Creeks Day', party: 2, dates: ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'], message: 'Hello, two of us would like a guided day around Coyhaique. Any of the dates I listed would work for us. What would it cost?' },
  { n: 6, trip: 'Highland Adventure with Bergur', party: 2, dates: [], message: 'Hi, we want 2 days of fishing in Iceland in July. Two anglers.' },
  { n: 7, trip: 'Highland Adventure with Bergur', party: 2, dates: [], message: "Hi, we're interested in the Highlands. 2 days in July, two anglers." },
  { n: 8, trip: 'Southland Rivers Day', party: 2, dates: [], message: composeBriefMessage('What does a guided day usually include?', BRIEF as never) },
]

it('FA-1.73 qualifier old vs new label', async () => {
  const oldMod = await import('./old/inquiry-agent.js')
  const newMod = await import('../../src/lib/ai/inquiry-agent.js')
  const out: string[] = []
  const rows: { case: number; run: number; old: string; new: string }[] = []
  const log = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { captured.push(a.join(' ')) })
  const captured: string[] = []
  const classify = async (fn: typeof newMod.classifyInquiry, c: (typeof CASES)[number]) => {
    captured.length = 0
    await fn({ inquiryId: 'x', anglerName: 'Anna Proof', tripTitle: c.trip, message: c.message, requestedDates: c.dates, partySize: c.party })
    const line = captured.find(l => l.includes('classification —')) ?? 'NO CLASSIFICATION LINE'
    return line.replace('[inquiry-agent] classification — ', '')
  }
  for (const c of CASES) {
    for (let run = 1; run <= RUNS; run++) {
      const o = await classify(oldMod.classifyInquiry, c)
      const n = await classify(newMod.classifyInquiry, c)
      rows.push({ case: c.n, run, old: o, new: n })
    }
  }
  log.mockRestore()
  for (const r of rows) out.push(`case ${r.case} run ${r.run} | OLD ${r.old} | NEW ${r.new} | ${r.old.replace(/, priority.*/, '') === r.new.replace(/, priority.*/, '') ? 'same country/type' : 'DIFF country/type'}${r.old === r.new ? '' : ' (priority differs or more)'}`)
  console.log(out.join('\n'))
  writeFileSync(new URL('./classifier.out.txt', import.meta.url), out.join('\n') + '\n')
}, 3_600_000)
