// FA-1.61 phase A — POST /api/inquiries stage timings, local only.
// The per-stage numbers come from TEMPORARY [fa161-timing] lines the (since reverted) route.ts
// printed into the dev-server log; this script drives the requests and records the client-side
// round-trip. Usage: RESEND_DEV_FAKE=1 node stage-timings-run.mjs <baseUrl> <pageId> <v1|v2> <runs> <out.jsonl>

if (process.env.RESEND_DEV_FAKE !== '1') {
  console.error('STOP: set RESEND_DEV_FAKE=1 before running this proof script')
  process.exit(1)
}
import { appendFileSync } from 'node:fs'

const [, , baseUrl, pageId, shape, runsArg, outFile] = process.argv
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl ?? '')) {
  console.error('STOP: local base URL only')
  process.exit(1)
}
const RUNS = Number(runsArg)
const stamp = Date.now().toString(36)

const BRIEF = {
  dates_mode: 'flexible', flex_month: '2027-06', days: 1, anglers: 2, non_anglers: 0,
  skill_level: 3, priority: 'trophy', fitness: 'mid', wading_ok: true, budget_ack: true,
}

function body(email, extra = {}) {
  const common = {
    experience_page_id: pageId,
    angler_name: 'Timing Test',
    angler_email: email,
    party_size: 2,
    message: 'FA-1.61 local timing run. Two of us, mid-level, hoping for a good brown trout day.',
    form_elapsed_ms: 45_000,
    ...extra,
  }
  return shape === 'v2'
    ? { ...common, angler_country: 'pl', brief: BRIEF }
    : { ...common, requested_dates: ['2027-06-10', '2027-06-11'], trip_length: '2-3' }
}

async function post(label, email, extra) {
  const t0 = performance.now()
  const res = await fetch(`${baseUrl}/api/inquiries`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body(email, extra)),
  })
  const json = await res.json().catch(() => ({}))
  const ms = Math.round((performance.now() - t0) * 10) / 10
  const row = { shape, label, status: res.status, client_ms: ms, id: json.id ?? null }
  appendFileSync(outFile, JSON.stringify(row) + '\n')
  console.log(JSON.stringify(row))
  return row
}

// Warm-up (discarded): next dev compiles the route on the first request. Trap-filled so it costs no AI.
await post('warmup', `fa161-${shape}-${stamp}-warm@example.invalid`, { trip_notes_extra: 'x' })

for (let i = 0; i < RUNS; i++) {
  await post('a-normal', `fa161-${shape}-${stamp}-a${i}@example.invalid`)
}
for (let i = 0; i < RUNS; i++) {
  await post('b-trap', `fa161-${shape}-${stamp}-b${i}@example.invalid`, { trip_notes_extra: 'x' })
}
for (let i = 0; i < RUNS; i++) {
  const email = `fa161-${shape}-${stamp}-c${i}@example.invalid`
  await post('c0-first-of-pair', email)   // a normal inquiry; makes the next one a repeat
  await post('c-repeat', email)
}
