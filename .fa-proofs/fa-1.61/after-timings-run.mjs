// FA-1.61 phase A re-run on the NEW code (after()) — measured from OUTSIDE the route, no instrumentation.
// Usage: RESEND_DEV_FAKE=1 node after-timings-run.mjs <baseUrl> <pageId> <v1|v2> <runs>
// Writes: client-timings-after.log (one JSON line per request) and after-work-proof.log
// (the SQL used + one JSON line per inquiry). The DB is polled with SELECT only, on the LOCAL stack.
if (process.env.RESEND_DEV_FAKE !== '1') {
  console.error('STOP: set RESEND_DEV_FAKE=1 before running this proof script')
  process.exit(1)
}
import { appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const [, , baseUrl, pageId, shape, runsArg] = process.argv
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl ?? '')) { console.error('STOP: local base URL only'); process.exit(1) }
const RUNS = Number(runsArg)
const DIR = new URL('.', import.meta.url).pathname
const CLIENT_LOG = `${DIR}client-timings-after.log`
const PROOF_LOG = `${DIR}after-work-proof.log`
const stamp = Date.now().toString(36)

const SQL_DECIDED = (id) => `select count(*), coalesce(min(payload->'reasons'->>0),'') from inquiry_events where inquiry_id='${id}' and type='agent.auto_send_decided'`
const SQL_SUMMARY = (id) => `select (select count(*) from inquiry_events where inquiry_id='${id}' and type='agent.auto_send_decided'), (select count(*) from inquiry_events where inquiry_id='${id}' and type='inquiry.qualified_set'), (select count(*) from messages where inquiry_id='${id}'), coalesce((select string_agg(distinct payload->>'sent', ',') from inquiry_events where inquiry_id='${id}' and type='agent.auto_send_decided'),''), coalesce((select payload->'reasons'->>0 from inquiry_events where inquiry_id='${id}' and type='agent.auto_send_decided' limit 1),'')`

function psql(sql) {
  return execFileSync('docker', ['exec', 'supabase_db_fjordanglers', 'psql', '-U', 'postgres', '-tA', '-F', '|', '-c', sql], { encoding: 'utf8' }).trim()
}

if (shape === 'v1') {
  appendFileSync(PROOF_LOG, `# SQL used (SELECT only, local DB supabase_db_fjordanglers)\n# poll: ${SQL_DECIDED('<id>')}\n# summary: ${SQL_SUMMARY('<id>')}\n`)
}

const BRIEF = {
  dates_mode: 'flexible', flex_month: '2027-06', days: 1, anglers: 2, non_anglers: 0,
  skill_level: 3, priority: 'trophy', fitness: 'mid', wading_ok: true, budget_ack: true,
}
function body(email, extra = {}) {
  const common = {
    experience_page_id: pageId, angler_name: 'Timing Test', angler_email: email, party_size: 2,
    message: 'FA-1.61 local timing run. Two of us, mid-level, hoping for a good brown trout day.',
    form_elapsed_ms: 45_000, ...extra,
  }
  return shape === 'v2'
    ? { ...common, angler_country: 'pl', brief: BRIEF }
    : { ...common, requested_dates: ['2027-06-10', '2027-06-11'], trip_length: '2-3' }
}

async function post(label, email, extra) {
  const t0 = performance.now()
  const res = await fetch(`${baseUrl}/api/inquiries`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body(email, extra)) })
  const tResp = performance.now()
  const json = await res.json().catch(() => ({}))
  const row = { shape, label, status: res.status, client_ms: Math.round((tResp - t0) * 10) / 10, id: json.id ?? null }
  appendFileSync(CLIENT_LOG, JSON.stringify(row) + '\n')
  console.log(JSON.stringify(row))
  return { ...row, tResp }
}

// Poll until agent.auto_send_decided exists for the inquiry; ms measured from the moment the response arrived.
async function pollDecided(r, timeoutMs = 60_000) {
  const start = performance.now()
  while (performance.now() - r.tResp < timeoutMs) {
    const [count, reason] = psql(SQL_DECIDED(r.id)).split('|')
    if (Number(count) > 0) {
      const ms = Math.round(performance.now() - r.tResp)
      return { landed: true, ms_after_response: ms, reason, poll_wait_ms: Math.round(performance.now() - start) }
    }
    await new Promise(res => setTimeout(res, 100))
  }
  return { landed: false, ms_after_response: null }
}

const toVerify = []   // (b)/(c) runs, checked after 15 s

await post('warmup', `fa161a-${shape}-${stamp}-warm@example.invalid`, { trip_notes_extra: 'x' })

for (let i = 0; i < RUNS; i++) {
  const r = await post('a-normal', `fa161a-${shape}-${stamp}-a${i}@example.invalid`)
  const p = await pollDecided(r)
  const [dec, qual, msgs, sent] = psql(SQL_SUMMARY(r.id)).split('|')
  const proof = { shape, label: 'a-normal', id: r.id, response_ms: r.client_ms, ...p, decided_events: Number(dec), qualified_set_events: Number(qual), messages: Number(msgs), sent }
  appendFileSync(PROOF_LOG, JSON.stringify(proof) + '\n'); console.log(JSON.stringify(proof))
}
for (let i = 0; i < RUNS; i++) {
  const r = await post('b-trap', `fa161a-${shape}-${stamp}-b${i}@example.invalid`, { trip_notes_extra: 'x' })
  toVerify.push({ ...r, kind: 'b-trap' })
}
const c0s = []
for (let i = 0; i < RUNS; i++) {
  const email = `fa161a-${shape}-${stamp}-c${i}@example.invalid`
  const r0 = await post('c0-first-of-pair', email)
  const r = await post('c-repeat', email)
  toVerify.push({ ...r, kind: 'c-repeat' })
  c0s.push(r0)
}
for (const r0 of c0s) {  // the first of each pair is a normal inquiry: its AI work must land too
  const p = await pollDecided({ ...r0, tResp: r0.tResp })
  const proof = { shape, label: 'c0-first-of-pair', id: r0.id, response_ms: r0.client_ms, ...p }
  appendFileSync(PROOF_LOG, JSON.stringify(proof) + '\n'); console.log(JSON.stringify(proof))
}
await new Promise(res => setTimeout(res, 15_000))
for (const r of toVerify) {
  const [dec, qual, msgs, sent, reason] = psql(SQL_SUMMARY(r.id)).split('|')
  const proof = { shape, label: r.kind, id: r.id, response_ms: r.client_ms, waited_s_after_last_request: 15, decided_events: Number(dec), qualified_set_events: Number(qual), messages: Number(msgs), sent, reason }
  appendFileSync(PROOF_LOG, JSON.stringify(proof) + '\n'); console.log(JSON.stringify(proof))
}
